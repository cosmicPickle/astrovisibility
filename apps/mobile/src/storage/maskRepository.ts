import { z } from 'zod';

import { blockedBitsetByteLength } from '../mask/rasterMask';
import type { VisibilityMask } from '../mask/visibilityMask';
import { DIRECTIONAL_ATLAS_PROJECTION } from '../panorama/directionalAtlas';
import type { OwnedFileStore, SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const utcInstant = z.iso.datetime({ offset: true });

export type SaveMaskRevisionInput = Readonly<{
  blockedBitset: Uint8Array;
  createdAtUtc: string;
  heightPixels: number;
  id: string;
  panoramaRevisionId: string;
  profileId: string;
  projection: typeof DIRECTIONAL_ATLAS_PROJECTION;
  temporaryUri: string;
  widthPixels: number;
}>;

export type ActiveMaskRevision = Readonly<{
  createdAtUtc: string;
  coveragePolygons: VisibilityMask['coveragePolygons'];
  formatVersion: number;
  id: string;
  operations: VisibilityMask['operations'];
  panoramaRevisionId: string;
  profileId: string;
  raster?: NonNullable<VisibilityMask['raster']>;
}>;

type ActiveRevisionRow = {
  blockedBitset: Uint8Array;
  createdAtUtc: string;
  formatVersion: number;
  heightPixels: number;
  id: string;
  panoramaRevisionId: string;
  profileId: string;
  projection: string;
  relativePath: string;
  widthPixels: number;
};

const validateRaster = (input: SaveMaskRevisionInput) => {
  safeId.parse(input.id);
  safeId.parse(input.profileId);
  safeId.parse(input.panoramaRevisionId);
  utcInstant.parse(input.createdAtUtc);
  if (
    input.projection !== DIRECTIONAL_ATLAS_PROJECTION ||
    !input.temporaryUri ||
    !Number.isInteger(input.widthPixels) ||
    !Number.isInteger(input.heightPixels) ||
    input.widthPixels <= 0 ||
    input.heightPixels <= 0 ||
    input.blockedBitset.length !==
      blockedBitsetByteLength(input.widthPixels, input.heightPixels)
  ) {
    throw new Error('The binary mask image is invalid.');
  }
};

export class MaskRepository {
  private readonly database: SqlDatabase;
  private readonly files: OwnedFileStore;

  constructor(database: SqlDatabase, files: OwnedFileStore) {
    this.database = database;
    this.files = files;
  }

  async saveRevision(input: SaveMaskRevisionInput): Promise<void> {
    validateRaster(input);
    const panorama = await this.database.getFirstAsync<{
      heightPixels: number;
      projection: string;
      widthPixels: number;
    }>(
      `SELECT panorama_revisions.width_pixels AS widthPixels,
        panorama_revisions.height_pixels AS heightPixels,
        panorama_revisions.projection
       FROM profiles
       JOIN panorama_revisions
         ON panorama_revisions.id = profiles.active_panorama_revision_id
       WHERE profiles.id = ?
         AND panorama_revisions.id = ?
         AND panorama_revisions.profile_id = profiles.id
         AND panorama_revisions.status = 'complete'`,
      [input.profileId, input.panoramaRevisionId],
    );
    if (
      !panorama ||
      panorama.projection !== input.projection ||
      panorama.widthPixels !== input.widthPixels ||
      panorama.heightPixels !== input.heightPixels
    ) {
      throw new Error(
        'A mask revision must match the active directional panorama.',
      );
    }
    const previous = await this.database.getFirstAsync<{
      id: string;
      relativePath: string;
    }>(
      `SELECT mask_revisions.id,
        mask_revisions.file_relative_path AS relativePath
       FROM profiles
       JOIN mask_revisions
         ON mask_revisions.id = profiles.active_mask_revision_id
       WHERE profiles.id = ?`,
      [input.profileId],
    );
    const relativePath = `profiles/${input.profileId}/panoramas/${input.panoramaRevisionId}/masks/${input.id}.png`;
    let promoted = false;
    try {
      await this.files.promoteTemporaryFile(input.temporaryUri, relativePath);
      promoted = true;
      await inImmediateTransaction(this.database, async () => {
        await this.database.runAsync(
          `INSERT INTO mask_revisions (
            id, profile_id, panorama_revision_id, status, format_version,
            coverage_json, created_at_utc, file_relative_path, width_pixels,
            height_pixels, projection, blocked_bits
          ) VALUES (?, ?, ?, 'complete', 2, '[]', ?, ?, ?, ?, ?, ?)`,
          [
            input.id,
            input.profileId,
            input.panoramaRevisionId,
            input.createdAtUtc,
            relativePath,
            input.widthPixels,
            input.heightPixels,
            input.projection,
            input.blockedBitset,
          ],
        );
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
        if (previous) {
          await this.database.runAsync(
            'DELETE FROM mask_revisions WHERE id = ?',
            [previous.id],
          );
        }
      });
    } catch (error) {
      if (promoted) await this.files.deleteOwnedFile(relativePath);
      throw error;
    }
    if (previous?.relativePath) {
      await this.files.deleteOwnedFile(previous.relativePath);
    }
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
        mask_revisions.created_at_utc AS createdAtUtc,
        mask_revisions.file_relative_path AS relativePath,
        mask_revisions.width_pixels AS widthPixels,
        mask_revisions.height_pixels AS heightPixels,
        mask_revisions.projection,
        mask_revisions.blocked_bits AS blockedBitset
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
    if (
      revision.formatVersion !== 2 ||
      revision.projection !== DIRECTIONAL_ATLAS_PROJECTION ||
      !revision.relativePath ||
      !(revision.blockedBitset instanceof Uint8Array) ||
      revision.blockedBitset.length !==
        blockedBitsetByteLength(revision.widthPixels, revision.heightPixels)
    ) {
      throw new Error('The active binary mask metadata is invalid.');
    }
    return Object.freeze({
      createdAtUtc: revision.createdAtUtc,
      coveragePolygons: [],
      formatVersion: revision.formatVersion,
      id: revision.id,
      operations: [],
      panoramaRevisionId: revision.panoramaRevisionId,
      profileId: revision.profileId,
      raster: Object.freeze({
        blockedBitset: revision.blockedBitset,
        heightPixels: revision.heightPixels,
        uri: this.files.resolveOwnedFileUri(revision.relativePath),
        widthPixels: revision.widthPixels,
      }),
    });
  }

  async deleteActivePanoramaAndMasks(
    profileId: string,
    updatedAtUtc: string,
  ): Promise<{ deleted: boolean; fileCleanupFailures: string[] }> {
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
        const rows = await this.database.getAllAsync<{
          relativePath: string;
        }>(
          `SELECT file_relative_path AS relativePath
           FROM panorama_revisions WHERE id = ?
           UNION
           SELECT file_relative_path AS relativePath
           FROM mask_revisions WHERE panorama_revision_id = ?`,
          [profile.panoramaRevisionId, profile.panoramaRevisionId],
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
        return rows.map(({ relativePath }) => relativePath).filter(Boolean);
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
