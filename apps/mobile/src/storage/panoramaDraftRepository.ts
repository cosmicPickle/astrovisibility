import { z } from 'zod';

import {
  createTileCoveragePolygon,
  type PanoramaTilePlacement,
} from '../panorama/tileGeometry';
import type {
  CapturedProofTile,
  OrientationConfidence,
  OrientationSnapshot,
} from '../capture/captureSession';
import { normalizeAzimuthDegrees } from '../sky/projection';
import {
  DIRECTIONAL_ATLAS_PROJECTION,
  type DirectionalAtlasSize,
} from '../panorama/directionalAtlas';
import { blockedBitsetByteLength } from '../mask/rasterMask';
import type { OwnedFileStore, SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const utcInstant = z.iso.datetime({ offset: true });
const fileExtension = z.string().regex(/^[a-z0-9]{1,5}$/);

export type CaptureDraftTileInput = Omit<CapturedProofTile, 'uri'> & {
  temporaryUri: string;
  fileExtension: string;
};

export interface PanoramaCaptureDraft {
  id: string;
  profileId: string;
  formatVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  tiles: CapturedProofTile[];
}

export interface ActivePanoramaTile {
  id: string;
  uri: string;
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  rollDegrees: number;
  horizontalFieldOfViewDegrees: number;
  verticalFieldOfViewDegrees: number;
  coveragePolygon: CapturedProofTile['coveragePolygon'];
  widthPixels: number;
  heightPixels: number;
}

export interface ActivePanorama {
  id: string;
  profileId: string;
  tiles: ActivePanoramaTile[];
  uri?: string;
  widthPixels?: number;
  heightPixels?: number;
  projection?: typeof DIRECTIONAL_ATLAS_PROJECTION;
  coverageBitset?: Uint8Array;
}

export interface CompletedPanoramaAsset extends DirectionalAtlasSize {
  coverageBitset: Uint8Array;
  projection: typeof DIRECTIONAL_ATLAS_PROJECTION;
  temporaryUri: string;
}

interface DraftRow {
  id: string;
  profileId: string;
  formatVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface DraftTileRow {
  id: string;
  fileRelativePath: string;
  sourceKind: 'camera';
  widthPixels: number;
  heightPixels: number;
  capturedAtUtc: string;
  orientationSnapshotJson: string;
  orientationConfidence: OrientationConfidence;
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  rollDegrees: number;
  horizontalFieldOfViewDegrees: number;
  verticalFieldOfViewDegrees: number;
  coveragePolygonJson: string;
  fileExtension: string;
}

const draftSelect = `
  SELECT id, profile_id AS profileId, format_version AS formatVersion,
    created_at_utc AS createdAtUtc, updated_at_utc AS updatedAtUtc
  FROM panorama_capture_drafts`;

const tileSelect = `
  SELECT id, file_relative_path AS fileRelativePath,
    file_extension AS fileExtension, source_kind AS sourceKind,
    width_pixels AS widthPixels, height_pixels AS heightPixels,
    captured_at_utc AS capturedAtUtc,
    orientation_snapshot_json AS orientationSnapshotJson,
    orientation_confidence AS orientationConfidence,
    center_azimuth_degrees AS centerAzimuthDegrees,
    center_altitude_degrees AS centerAltitudeDegrees,
    roll_degrees AS rollDegrees,
    horizontal_fov_degrees AS horizontalFieldOfViewDegrees,
    vertical_fov_degrees AS verticalFieldOfViewDegrees,
    coverage_polygon_json AS coveragePolygonJson
  FROM panorama_capture_draft_tiles`;

const validatePlacement = (
  placement: PanoramaTilePlacement & { rollDegrees: number },
) => {
  if (
    !Number.isFinite(placement.centerAzimuthDegrees) ||
    !Number.isFinite(placement.centerAltitudeDegrees) ||
    !Number.isFinite(placement.rollDegrees)
  ) {
    throw new RangeError('Reviewed tile placement must be finite.');
  }
  createTileCoveragePolygon(placement);
};

export class PanoramaDraftRepository {
  private readonly database: SqlDatabase;
  private readonly files: OwnedFileStore;

  constructor(database: SqlDatabase, files: OwnedFileStore) {
    this.database = database;
    this.files = files;
  }

  async create(
    id: string,
    profileId: string,
    createdAtUtc: string,
  ): Promise<void> {
    safeId.parse(id);
    safeId.parse(profileId);
    utcInstant.parse(createdAtUtc);
    const profile = await this.database.getFirstAsync<{
      activePanoramaRevisionId: string | null;
    }>(
      `SELECT active_panorama_revision_id AS activePanoramaRevisionId
       FROM profiles WHERE id = ?`,
      [profileId],
    );
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    if (profile.activePanoramaRevisionId) {
      throw new Error(
        'Delete the existing panorama and mask before recapturing.',
      );
    }
    await this.database.runAsync(
      `INSERT INTO panorama_capture_drafts (
        id, profile_id, format_version, created_at_utc, updated_at_utc
      ) VALUES (?, ?, 1, ?, ?)`,
      [id, profileId, createdAtUtc, createdAtUtc],
    );
  }

  async getForProfile(profileId: string): Promise<PanoramaCaptureDraft | null> {
    const draft = await this.database.getFirstAsync<DraftRow>(
      `${draftSelect} WHERE profile_id = ?`,
      [profileId],
    );
    return draft ? this.hydrateDraft(draft) : null;
  }

  async getById(id: string): Promise<PanoramaCaptureDraft | null> {
    const draft = await this.database.getFirstAsync<DraftRow>(
      `${draftSelect} WHERE id = ?`,
      [id],
    );
    return draft ? this.hydrateDraft(draft) : null;
  }

  async addTile(
    draftId: string,
    rawTile: CaptureDraftTileInput,
    updatedAtUtc: string,
  ): Promise<void> {
    safeId.parse(draftId);
    safeId.parse(rawTile.id);
    const extension = fileExtension.parse(rawTile.fileExtension.toLowerCase());
    utcInstant.parse(rawTile.capturedAtUtc);
    utcInstant.parse(updatedAtUtc);
    validatePlacement(rawTile.reviewedPlacement);
    const draft = await this.database.getFirstAsync<DraftRow>(
      `${draftSelect} WHERE id = ?`,
      [draftId],
    );
    if (!draft) throw new Error(`Panorama draft not found: ${draftId}`);
    const count = await this.database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM panorama_capture_draft_tiles WHERE draft_id = ?',
      [draftId],
    );
    if ((count?.count ?? 0) >= 200) {
      throw new Error('This panorama draft has reached the 200 tile limit.');
    }
    const relativePath = `profiles/${draft.profileId}/panorama-drafts/${draft.id}/tiles/${rawTile.id}.${extension}`;
    await this.files.promoteTemporaryFile(rawTile.temporaryUri, relativePath);
    try {
      await inImmediateTransaction(this.database, async () => {
        await this.database.runAsync(
          `INSERT INTO panorama_capture_draft_tiles (
            id, draft_id, ordinal, file_relative_path, file_extension,
            source_kind, width_pixels, height_pixels, captured_at_utc,
            orientation_snapshot_json, orientation_confidence,
            center_azimuth_degrees, center_altitude_degrees, roll_degrees,
            horizontal_fov_degrees, vertical_fov_degrees, coverage_polygon_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rawTile.id,
            draftId,
            count?.count ?? 0,
            relativePath,
            extension,
            rawTile.sourceKind,
            rawTile.widthPixels,
            rawTile.heightPixels,
            rawTile.capturedAtUtc,
            JSON.stringify(rawTile.orientationSnapshot),
            rawTile.orientationConfidence,
            normalizeAzimuthDegrees(
              rawTile.reviewedPlacement.centerAzimuthDegrees,
            ),
            rawTile.reviewedPlacement.centerAltitudeDegrees,
            rawTile.reviewedPlacement.rollDegrees,
            rawTile.reviewedPlacement.horizontalFieldOfViewDegrees,
            rawTile.reviewedPlacement.verticalFieldOfViewDegrees,
            JSON.stringify(rawTile.coveragePolygon),
          ],
        );
        await this.database.runAsync(
          'UPDATE panorama_capture_drafts SET updated_at_utc = ? WHERE id = ?',
          [updatedAtUtc, draftId],
        );
      });
    } catch (error) {
      await this.files.deleteOwnedFile(relativePath);
      throw error;
    }
  }

  async updateTilePlacement(
    draftId: string,
    tileId: string,
    placement: PanoramaTilePlacement & { rollDegrees: number },
    updatedAtUtc: string,
  ): Promise<void> {
    validatePlacement(placement);
    utcInstant.parse(updatedAtUtc);
    await inImmediateTransaction(this.database, async () => {
      const result = await this.database.runAsync(
        `UPDATE panorama_capture_draft_tiles SET
          center_azimuth_degrees = ?, center_altitude_degrees = ?,
          roll_degrees = ?, horizontal_fov_degrees = ?, vertical_fov_degrees = ?,
          coverage_polygon_json = ?
         WHERE id = ? AND draft_id = ?`,
        [
          normalizeAzimuthDegrees(placement.centerAzimuthDegrees),
          placement.centerAltitudeDegrees,
          placement.rollDegrees,
          placement.horizontalFieldOfViewDegrees,
          placement.verticalFieldOfViewDegrees,
          JSON.stringify(createTileCoveragePolygon(placement)),
          tileId,
          draftId,
        ],
      );
      if (result.changes !== 1)
        throw new Error(`Draft tile not found: ${tileId}`);
      await this.database.runAsync(
        'UPDATE panorama_capture_drafts SET updated_at_utc = ? WHERE id = ?',
        [updatedAtUtc, draftId],
      );
    });
  }

  async discard(draftId: string): Promise<void> {
    const rows = await this.database.getAllAsync<{ relativePath: string }>(
      `SELECT file_relative_path AS relativePath
       FROM panorama_capture_draft_tiles WHERE draft_id = ?`,
      [draftId],
    );
    await this.database.runAsync(
      'DELETE FROM panorama_capture_drafts WHERE id = ?',
      [draftId],
    );
    await Promise.allSettled(
      rows.map((row) => this.files.deleteOwnedFile(row.relativePath)),
    );
  }

  async complete(
    draftId: string,
    panoramaId: string,
    completedAtUtc: string,
    asset?: CompletedPanoramaAsset,
  ): Promise<void> {
    safeId.parse(panoramaId);
    utcInstant.parse(completedAtUtc);
    const draft = await this.database.getFirstAsync<DraftRow>(
      `${draftSelect} WHERE id = ?`,
      [draftId],
    );
    if (!draft) throw new Error(`Panorama draft not found: ${draftId}`);
    const tiles = await this.database.getAllAsync<DraftTileRow>(
      `${tileSelect} WHERE draft_id = ? ORDER BY ordinal`,
      [draftId],
    );
    if (tiles.length === 0)
      throw new Error('Capture at least one tile before saving.');
    if (!asset) {
      throw new Error('A completed panorama requires one directional image.');
    }
    if (
      asset.projection !== DIRECTIONAL_ATLAS_PROJECTION ||
      !Number.isInteger(asset.widthPixels) ||
      !Number.isInteger(asset.heightPixels) ||
      asset.widthPixels <= 0 ||
      asset.heightPixels <= 0 ||
      asset.coverageBitset.length !==
        blockedBitsetByteLength(asset.widthPixels, asset.heightPixels)
    ) {
      throw new Error('The directional panorama asset is invalid.');
    }
    const relativePath = `profiles/${draft.profileId}/panoramas/${panoramaId}/panorama.png`;
    let promoted = false;
    try {
      await this.files.promoteTemporaryFile(asset.temporaryUri, relativePath);
      promoted = true;
      await inImmediateTransaction(this.database, async () => {
        await this.database.runAsync(
          `INSERT INTO panorama_revisions (
            id, profile_id, status, format_version, created_at_utc,
            file_relative_path, width_pixels, height_pixels, projection,
            coverage_bits
          ) VALUES (?, ?, 'complete', 2, ?, ?, ?, ?, ?, ?)`,
          [
            panoramaId,
            draft.profileId,
            completedAtUtc,
            relativePath,
            asset.widthPixels,
            asset.heightPixels,
            asset.projection,
            asset.coverageBitset,
          ],
        );
        const activation = await this.database.runAsync(
          `UPDATE profiles SET active_panorama_revision_id = ?,
            active_mask_revision_id = NULL, updated_at_utc = ?
           WHERE id = ? AND active_panorama_revision_id IS NULL`,
          [panoramaId, completedAtUtc, draft.profileId],
        );
        if (activation.changes !== 1) {
          throw new Error('The profile already has a panorama.');
        }
        await this.database.runAsync(
          'DELETE FROM panorama_capture_drafts WHERE id = ?',
          [draftId],
        );
      });
    } catch (error) {
      if (promoted) await this.files.deleteOwnedFile(relativePath);
      throw error;
    }
    await Promise.allSettled(
      tiles.map((tile) => this.files.deleteOwnedFile(tile.fileRelativePath)),
    );
  }

  async getActiveForProfile(profileId: string): Promise<ActivePanorama | null> {
    const revision = await this.database.getFirstAsync<{
      id: string;
      profileId: string;
      relativePath: string;
      widthPixels: number;
      heightPixels: number;
      projection: string;
      coverageBitset: Uint8Array;
    }>(
      `SELECT panorama_revisions.id, panorama_revisions.profile_id AS profileId,
        panorama_revisions.file_relative_path AS relativePath,
        panorama_revisions.width_pixels AS widthPixels,
        panorama_revisions.height_pixels AS heightPixels,
        panorama_revisions.projection,
        panorama_revisions.coverage_bits AS coverageBitset
       FROM profiles
       JOIN panorama_revisions
         ON panorama_revisions.id = profiles.active_panorama_revision_id
       WHERE profiles.id = ? AND panorama_revisions.status = 'complete'`,
      [profileId],
    );
    if (!revision) return null;
    if (
      revision.projection !== DIRECTIONAL_ATLAS_PROJECTION ||
      !revision.relativePath ||
      !(revision.coverageBitset instanceof Uint8Array) ||
      revision.coverageBitset.length !==
        blockedBitsetByteLength(revision.widthPixels, revision.heightPixels)
    ) {
      throw new Error('The active panorama image metadata is invalid.');
    }
    return {
      id: revision.id,
      profileId: revision.profileId,
      tiles: [],
      uri: this.files.resolveOwnedFileUri(revision.relativePath),
      widthPixels: revision.widthPixels,
      heightPixels: revision.heightPixels,
      projection: DIRECTIONAL_ATLAS_PROJECTION,
      coverageBitset: revision.coverageBitset,
    };
  }

  private async hydrateDraft(draft: DraftRow): Promise<PanoramaCaptureDraft> {
    const rows = await this.database.getAllAsync<DraftTileRow>(
      `${tileSelect} WHERE draft_id = ? ORDER BY ordinal`,
      [draft.id],
    );
    return {
      ...draft,
      tiles: rows.map((row) => ({
        id: row.id,
        uri: this.files.resolveOwnedFileUri(row.fileRelativePath),
        widthPixels: row.widthPixels,
        heightPixels: row.heightPixels,
        capturedAtUtc: row.capturedAtUtc,
        orientationSnapshot: JSON.parse(
          row.orientationSnapshotJson,
        ) as OrientationSnapshot,
        orientationConfidence: row.orientationConfidence,
        sourceKind: row.sourceKind,
        reviewedPlacement: {
          centerAzimuthDegrees: row.centerAzimuthDegrees,
          centerAltitudeDegrees: row.centerAltitudeDegrees,
          rollDegrees: row.rollDegrees,
          horizontalFieldOfViewDegrees: row.horizontalFieldOfViewDegrees,
          verticalFieldOfViewDegrees: row.verticalFieldOfViewDegrees,
        },
        coveragePolygon: JSON.parse(
          row.coveragePolygonJson,
        ) as CapturedProofTile['coveragePolygon'],
      })),
    };
  }
}
