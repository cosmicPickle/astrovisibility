import { z } from 'zod';

import {
  canonicalizeMaskOperations,
  createVisibilityMask,
  type AngularPointDegrees,
  type VisibilityMask,
  type VisibilityMaskOperation,
} from '../mask/visibilityMask';
import type { OwnedFileStore, SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const utcInstant = z.iso.datetime({ offset: true });
const angularPointSchema = z.object({
  azimuthDegrees: z.number().finite(),
  altitudeDegrees: z.number().min(0).max(90),
});
const polygonSchema = z.array(angularPointSchema).min(3).max(10_000);
const persistedCoverageSchema = z.array(polygonSchema).max(200);
const operationSchema = z.discriminatedUnion('kind', [
  z.object({
    id: safeId,
    kind: z.literal('visiblePolygon'),
    points: polygonSchema,
  }),
  z.object({
    id: safeId,
    kind: z.enum(['blockedStroke', 'visibleStroke']),
    angularRadiusDegrees: z.number().positive().max(180),
    points: z.array(angularPointSchema).min(1).max(10_000),
  }),
]);
const saveInputSchema = z.object({
  id: safeId,
  profileId: safeId,
  panoramaRevisionId: safeId,
  createdAtUtc: utcInstant,
  operations: z.array(operationSchema).max(10_000),
});

export type SaveMaskRevisionInput = Readonly<{
  id: string;
  profileId: string;
  panoramaRevisionId: string;
  createdAtUtc: string;
  operations: readonly VisibilityMaskOperation[];
}>;

export type ActiveMaskRevision = Readonly<{
  id: string;
  profileId: string;
  panoramaRevisionId: string;
  formatVersion: number;
  createdAtUtc: string;
  coveragePolygons: VisibilityMask['coveragePolygons'];
  operations: VisibilityMask['operations'];
}>;

type ActiveRevisionRow = {
  id: string;
  profileId: string;
  panoramaRevisionId: string;
  formatVersion: number;
  coverageJson: string;
  createdAtUtc: string;
};

type OperationRow = {
  id: string;
  kind: 'visiblePolygon' | 'blockedStroke' | 'visibleStroke';
  geometryJson: string;
};

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}

function parseCoverageJson(value: string): AngularPointDegrees[][] {
  return persistedCoverageSchema.parse(parseJson(value, 'Mask coverage'));
}

function serializeOperation(operation: VisibilityMaskOperation): string {
  return operation.kind === 'visiblePolygon'
    ? JSON.stringify({ points: operation.points })
    : JSON.stringify({
        points: operation.points,
        angularRadiusDegrees: operation.angularRadiusDegrees,
      });
}

function parseOperation(row: OperationRow): VisibilityMaskOperation {
  const geometry = parseJson(row.geometryJson, `Mask operation ${row.id}`);
  if (row.kind === 'visiblePolygon') {
    const parsed = z.object({ points: polygonSchema }).parse(geometry);
    return { id: row.id, kind: row.kind, points: parsed.points };
  }
  const parsed = z
    .object({
      angularRadiusDegrees: z.number().positive().max(180),
      points: z.array(angularPointSchema).min(1).max(10_000),
    })
    .parse(geometry);
  return {
    id: row.id,
    kind: row.kind,
    angularRadiusDegrees: parsed.angularRadiusDegrees,
    points: parsed.points,
  };
}

export class MaskRepository {
  private readonly database: SqlDatabase;
  private readonly files: OwnedFileStore;

  constructor(database: SqlDatabase, files: OwnedFileStore) {
    this.database = database;
    this.files = files;
  }

  async saveRevision(rawInput: SaveMaskRevisionInput): Promise<void> {
    const input = saveInputSchema.parse(rawInput);
    const operations = canonicalizeMaskOperations(input.operations);
    await inImmediateTransaction(this.database, async () => {
      const panorama = await this.database.getFirstAsync<{
        id: string;
      }>(
        `SELECT panorama_revisions.id
         FROM profiles
         JOIN panorama_revisions
           ON panorama_revisions.id = profiles.active_panorama_revision_id
         WHERE profiles.id = ?
           AND panorama_revisions.id = ?
           AND panorama_revisions.profile_id = profiles.id
           AND panorama_revisions.status = 'complete'`,
        [input.profileId, input.panoramaRevisionId],
      );
      if (!panorama) {
        throw new Error(
          'A mask revision must reference the profile active panorama.',
        );
      }
      const tileRows = await this.database.getAllAsync<{
        coverageJson: string | null;
      }>(
        `SELECT coverage_polygon_json AS coverageJson
         FROM panorama_tiles WHERE panorama_revision_id = ? ORDER BY ordinal`,
        [input.panoramaRevisionId],
      );
      if (
        tileRows.length === 0 ||
        tileRows.some(({ coverageJson }) => !coverageJson)
      ) {
        throw new Error(
          'The active panorama has incomplete directional coverage.',
        );
      }
      const coveragePolygons = tileRows.map(({ coverageJson }) =>
        polygonSchema.parse(parseJson(coverageJson!, 'Panorama tile coverage')),
      );
      const mask = createVisibilityMask(coveragePolygons, operations);

      await this.database.runAsync(
        `INSERT INTO mask_revisions (
          id, profile_id, panorama_revision_id, status, format_version,
          coverage_json, created_at_utc
        ) VALUES (?, ?, ?, 'complete', 1, ?, ?)`,
        [
          input.id,
          input.profileId,
          input.panoramaRevisionId,
          JSON.stringify(mask.coveragePolygons),
          input.createdAtUtc,
        ],
      );
      for (const [ordinal, operation] of mask.operations.entries()) {
        await this.database.runAsync(
          `INSERT INTO mask_operations (
            id, mask_revision_id, ordinal, kind, geometry_json
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            operation.id,
            input.id,
            ordinal,
            operation.kind,
            serializeOperation(operation),
          ],
        );
      }
      const activation = await this.database.runAsync(
        `UPDATE profiles SET active_mask_revision_id = ?, updated_at_utc = ?
         WHERE id = ? AND active_panorama_revision_id = ?`,
        [
          input.id,
          input.createdAtUtc,
          input.profileId,
          input.panoramaRevisionId,
        ],
      );
      if (activation.changes !== 1) {
        throw new Error('The active panorama changed while saving the mask.');
      }
    });
  }

  async getActiveForProfile(
    profileId: string,
  ): Promise<ActiveMaskRevision | null> {
    safeId.parse(profileId);
    const revision = await this.database.getFirstAsync<ActiveRevisionRow>(
      `SELECT mask_revisions.id,
        mask_revisions.profile_id AS profileId,
        mask_revisions.panorama_revision_id AS panoramaRevisionId,
        mask_revisions.format_version AS formatVersion,
        mask_revisions.coverage_json AS coverageJson,
        mask_revisions.created_at_utc AS createdAtUtc
       FROM profiles
       JOIN panorama_revisions
         ON panorama_revisions.id = profiles.active_panorama_revision_id
       JOIN mask_revisions
         ON mask_revisions.id = profiles.active_mask_revision_id
        AND mask_revisions.panorama_revision_id = panorama_revisions.id
       WHERE profiles.id = ?
         AND panorama_revisions.status = 'complete'
         AND mask_revisions.status = 'complete'`,
      [profileId],
    );
    if (!revision) return null;
    if (revision.formatVersion !== 1) {
      throw new Error(
        `Unsupported mask format version: ${revision.formatVersion}.`,
      );
    }
    const rows = await this.database.getAllAsync<OperationRow>(
      `SELECT id, kind, geometry_json AS geometryJson
       FROM mask_operations WHERE mask_revision_id = ? ORDER BY ordinal`,
      [revision.id],
    );
    const mask = createVisibilityMask(
      parseCoverageJson(revision.coverageJson),
      rows.map(parseOperation),
    );
    return Object.freeze({
      id: revision.id,
      profileId: revision.profileId,
      panoramaRevisionId: revision.panoramaRevisionId,
      formatVersion: revision.formatVersion,
      createdAtUtc: revision.createdAtUtc,
      coveragePolygons: mask.coveragePolygons,
      operations: mask.operations,
    });
  }

  async deleteActivePanoramaAndMasks(
    profileId: string,
    updatedAtUtc: string,
  ): Promise<{
    deleted: boolean;
    fileCleanupFailures: string[];
  }> {
    safeId.parse(profileId);
    utcInstant.parse(updatedAtUtc);
    const relativePaths = await inImmediateTransaction(
      this.database,
      async () => {
        const profile = await this.database.getFirstAsync<{
          panoramaRevisionId: string | null;
        }>(
          `SELECT active_panorama_revision_id AS panoramaRevisionId
           FROM profiles WHERE id = ?`,
          [profileId],
        );
        if (!profile) throw new Error(`Profile not found: ${profileId}`);
        if (!profile.panoramaRevisionId) return null;
        const rows = await this.database.getAllAsync<{ relativePath: string }>(
          `SELECT file_relative_path AS relativePath
           FROM panorama_tiles WHERE panorama_revision_id = ?`,
          [profile.panoramaRevisionId],
        );
        const deactivation = await this.database.runAsync(
          `UPDATE profiles SET active_panorama_revision_id = NULL,
            active_mask_revision_id = NULL, updated_at_utc = ?
           WHERE id = ? AND active_panorama_revision_id = ?`,
          [updatedAtUtc, profileId, profile.panoramaRevisionId],
        );
        if (deactivation.changes !== 1) {
          throw new Error('The active panorama changed while deleting it.');
        }
        const deletion = await this.database.runAsync(
          `DELETE FROM panorama_revisions WHERE id = ? AND profile_id = ?`,
          [profile.panoramaRevisionId, profileId],
        );
        if (deletion.changes !== 1) {
          throw new Error('The active panorama could not be deleted.');
        }
        return rows.map(({ relativePath }) => relativePath);
      },
    );
    if (!relativePaths) return { deleted: false, fileCleanupFailures: [] };
    const cleanup = await Promise.allSettled(
      relativePaths.map((relativePath) =>
        this.files.deleteOwnedFile(relativePath),
      ),
    );
    return {
      deleted: true,
      fileCleanupFailures: relativePaths.filter(
        (_, index) => cleanup[index].status === 'rejected',
      ),
    };
  }
}
