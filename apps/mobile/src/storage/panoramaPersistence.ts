import { z } from 'zod';

import type { OwnedFileStore, SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const utcInstant = z.iso.datetime({ offset: true });
const panoramaSchema = z.object({
  id: safeId,
  profileId: safeId,
  formatVersion: z.number().int().positive(),
  createdAtUtc: utcInstant,
  tiles: z
    .array(
      z.object({
        id: safeId,
        temporaryUri: z.string().min(1),
        fileExtension: z.string().regex(/^[a-z0-9]{1,5}$/),
        widthPixels: z.number().int().positive(),
        heightPixels: z.number().int().positive(),
        centerAzimuthDegrees: z.number().min(0).lt(360),
        centerAltitudeDegrees: z.number().min(-90).max(90),
        rollDegrees: z.number().finite(),
        horizontalFovDegrees: z.number().positive().max(180),
        verticalFovDegrees: z.number().positive().max(180),
        capturedAtUtc: utcInstant,
        headingAccuracyDegrees: z.number().nonnegative().optional(),
        orientationConfidence: z.string().max(40).optional(),
        coveragePolygonJson: z.string().optional(),
      }),
    )
    .min(1)
    .max(200),
});

const maskSchema = z.object({
  id: safeId,
  profileId: safeId,
  panoramaRevisionId: safeId,
  formatVersion: z.number().int().positive(),
  coverageJson: z.string().min(1),
  createdAtUtc: utcInstant,
  operations: z
    .array(
      z.object({
        id: safeId,
        kind: z.enum(['visiblePolygon', 'blockedStroke', 'visibleStroke']),
        geometryJson: z.string().min(1),
      }),
    )
    .max(100_000),
});

export type CompletedPanoramaInput = z.infer<typeof panoramaSchema>;
export type CompletedMaskInput = z.infer<typeof maskSchema>;

export async function saveCompletedPanorama(
  database: SqlDatabase,
  fileStore: OwnedFileStore,
  rawInput: CompletedPanoramaInput,
): Promise<void> {
  const input = panoramaSchema.parse(rawInput);
  const promotedPaths: string[] = [];
  const tiles = input.tiles.map((tile, ordinal) => ({
    ...tile,
    ordinal,
    relativePath: `profiles/${input.profileId}/panoramas/${input.id}/tiles/${tile.id}.${tile.fileExtension}`,
  }));

  try {
    for (const tile of tiles) {
      await fileStore.promoteTemporaryFile(
        tile.temporaryUri,
        tile.relativePath,
      );
      promotedPaths.push(tile.relativePath);
    }
    await inImmediateTransaction(database, async () => {
      await database.runAsync(
        `INSERT INTO panorama_revisions (id, profile_id, status, format_version, created_at_utc)
          VALUES (?, ?, 'complete', ?, ?)`,
        [input.id, input.profileId, input.formatVersion, input.createdAtUtc],
      );
      for (const tile of tiles) {
        await database.runAsync(
          `INSERT INTO panorama_tiles (
            id, panorama_revision_id, ordinal, file_relative_path, width_pixels,
            height_pixels, center_azimuth_degrees, center_altitude_degrees,
            roll_degrees, horizontal_fov_degrees, vertical_fov_degrees,
            captured_at_utc, heading_accuracy_degrees, orientation_confidence,
            coverage_polygon_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tile.id,
            input.id,
            tile.ordinal,
            tile.relativePath,
            tile.widthPixels,
            tile.heightPixels,
            tile.centerAzimuthDegrees,
            tile.centerAltitudeDegrees,
            tile.rollDegrees,
            tile.horizontalFovDegrees,
            tile.verticalFovDegrees,
            tile.capturedAtUtc,
            tile.headingAccuracyDegrees ?? null,
            tile.orientationConfidence ?? null,
            tile.coveragePolygonJson ?? null,
          ],
        );
      }
      const activation = await database.runAsync(
        `UPDATE profiles SET active_panorama_revision_id = ?, active_mask_revision_id = NULL,
          updated_at_utc = ? WHERE id = ?`,
        [input.id, input.createdAtUtc, input.profileId],
      );
      if (activation.changes !== 1) {
        throw new Error(`Profile not found: ${input.profileId}`);
      }
    });
  } catch (error) {
    await Promise.allSettled(
      promotedPaths.map((path) => fileStore.deleteOwnedFile(path)),
    );
    throw error;
  }
}

export async function saveCompletedMask(
  database: SqlDatabase,
  rawInput: CompletedMaskInput,
): Promise<void> {
  const input = maskSchema.parse(rawInput);
  await inImmediateTransaction(database, async () => {
    const panorama = await database.getFirstAsync<{
      profileId: string;
      status: string;
    }>(
      `SELECT profile_id AS profileId, status FROM panorama_revisions WHERE id = ?`,
      [input.panoramaRevisionId],
    );
    if (
      panorama?.profileId !== input.profileId ||
      panorama.status !== 'complete'
    ) {
      throw new Error(
        'A completed mask must reference a completed panorama for the same profile.',
      );
    }
    await database.runAsync(
      `INSERT INTO mask_revisions (
        id, profile_id, panorama_revision_id, status, format_version,
        coverage_json, created_at_utc
      ) VALUES (?, ?, ?, 'complete', ?, ?, ?)`,
      [
        input.id,
        input.profileId,
        input.panoramaRevisionId,
        input.formatVersion,
        input.coverageJson,
        input.createdAtUtc,
      ],
    );
    for (const [ordinal, operation] of input.operations.entries()) {
      await database.runAsync(
        `INSERT INTO mask_operations (
          id, mask_revision_id, ordinal, kind, geometry_json
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          operation.id,
          input.id,
          ordinal,
          operation.kind,
          operation.geometryJson,
        ],
      );
    }
    const activation = await database.runAsync(
      `UPDATE profiles SET active_mask_revision_id = ?, updated_at_utc = ?
        WHERE id = ? AND active_panorama_revision_id = ?`,
      [input.id, input.createdAtUtc, input.profileId, input.panoramaRevisionId],
    );
    if (activation.changes !== 1) {
      throw new Error('The mask panorama is not active for this profile.');
    }
  });
}

export async function removeOrphanedOwnedFiles(
  database: SqlDatabase,
  fileStore: OwnedFileStore,
): Promise<string[]> {
  const referencedRows = await database.getAllAsync<{ relativePath: string }>(
    `SELECT file_relative_path AS relativePath FROM panorama_tiles
     UNION
     SELECT file_relative_path AS relativePath FROM panorama_capture_draft_tiles
     UNION
     SELECT file_relative_path AS relativePath FROM panorama_revisions
       WHERE file_relative_path IS NOT NULL
     UNION
     SELECT file_relative_path AS relativePath FROM mask_revisions
       WHERE file_relative_path IS NOT NULL`,
  );
  const referenced = new Set(referencedRows.map((row) => row.relativePath));
  const orphans = (await fileStore.listOwnedFiles()).filter(
    (path) => !referenced.has(path),
  );
  await Promise.all(orphans.map((path) => fileStore.deleteOwnedFile(path)));
  return orphans;
}
