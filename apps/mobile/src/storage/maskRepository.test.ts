/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import { createBlockedBitset } from '../mask/rasterMask';
import { DIRECTIONAL_ATLAS_PROJECTION } from '../panorama/directionalAtlas';
import { MaskRepository, type SaveMaskRevisionInput } from './maskRepository';
import { migrateDatabase } from './migrations';
import { ProfileRepository } from './profileRepository';
import type { OwnedFileStore, SqlDatabase, SqlValue } from './types';

class NodeSqliteDatabase implements SqlDatabase {
  readonly native: DatabaseSync;
  constructor(native: DatabaseSync) {
    this.native = native;
  }
  async execAsync(sql: string) {
    this.native.exec(sql);
  }
  async runAsync(sql: string, parameters: readonly SqlValue[] = []) {
    const result = this.native.prepare(sql).run(...parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }
  async getFirstAsync<T>(sql: string, parameters: readonly SqlValue[] = []) {
    return (
      (this.native.prepare(sql).get(...parameters) as T | undefined) ?? null
    );
  }
  async getAllAsync<T>(sql: string, parameters: readonly SqlValue[] = []) {
    return this.native.prepare(sql).all(...parameters) as T[];
  }
}

class MemoryOwnedFileStore implements OwnedFileStore {
  readonly durable = new Set<string>();
  failDelete = false;
  async promoteTemporaryFile(_source: string, destination: string) {
    this.durable.add(destination);
  }
  async copyOwnedFile() {
    throw new Error('not used');
  }
  async deleteOwnedFile(relativePath: string) {
    if (this.failDelete) throw new Error('simulated cleanup failure');
    this.durable.delete(relativePath);
  }
  async listOwnedFiles() {
    return [...this.durable];
  }
  resolveOwnedFileUri(relativePath: string) {
    return `owned://${relativePath}`;
  }
}

const profile = {
  id: 'profile-1',
  name: 'Window',
  latitudeDegreesNorth: 42.7,
  longitudeDegreesEast: 23.3,
  elevationMetersAboveMeanSeaLevel: 550,
  timeZoneId: 'Europe/Sofia',
  locationAccuracyMeters: null,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
};

async function setup() {
  const native = new DatabaseSync(':memory:');
  const database = new NodeSqliteDatabase(native);
  const files = new MemoryOwnedFileStore();
  await migrateDatabase(database);
  await new ProfileRepository(database).create(profile);
  const panoramaPath = 'profiles/profile-1/panoramas/panorama-1/panorama.png';
  const coverageBitset = createBlockedBitset(8, 8, true);
  await database.runAsync(
    `INSERT INTO panorama_revisions (
      id, profile_id, status, format_version, created_at_utc,
      file_relative_path, width_pixels, height_pixels, projection, coverage_bits
    ) VALUES ('panorama-1', ?, 'complete', 2, ?, ?, 8, 8, ?, ?)`,
    [
      profile.id,
      profile.createdAtUtc,
      panoramaPath,
      DIRECTIONAL_ATLAS_PROJECTION,
      coverageBitset,
    ],
  );
  await database.runAsync(
    `UPDATE profiles SET active_panorama_revision_id = 'panorama-1'
     WHERE id = ?`,
    [profile.id],
  );
  files.durable.add(panoramaPath);
  return {
    database,
    files,
    native,
    repository: new MaskRepository(database, files),
  };
}

const maskInput = (id = 'mask-1'): SaveMaskRevisionInput => ({
  blockedBitset: createBlockedBitset(8, 8, false),
  createdAtUtc: '2026-08-21T12:00:00.000Z',
  heightPixels: 8,
  id,
  panoramaRevisionId: 'panorama-1',
  profileId: profile.id,
  projection: DIRECTIONAL_ATLAS_PROJECTION,
  temporaryUri: `file:///temporary/${id}.png`,
  widthPixels: 8,
});

describe('single-image mask persistence', () => {
  it('saves and reloads one binary mask image and its pixel evaluator data', async () => {
    const { native, repository } = await setup();
    await repository.saveRevision(maskInput());

    const active = await repository.getActiveForProfile(profile.id);

    expect(active).toMatchObject({
      formatVersion: 2,
      id: 'mask-1',
      operations: [],
      panoramaRevisionId: 'panorama-1',
    });
    expect(active?.raster?.uri).toContain('/masks/mask-1.png');
    expect(active?.raster?.blockedBitset).toEqual(maskInput().blockedBitset);
    native.close();
  });

  it('rejects a raster that does not match the active panorama', async () => {
    const { files, native, repository } = await setup();

    await expect(
      repository.saveRevision({ ...maskInput(), widthPixels: 9 }),
    ).rejects.toThrow(/invalid|match/i);
    expect([...files.durable].some((path) => path.includes('mask-1'))).toBe(
      false,
    );
    native.close();
  });

  it('replaces the prior mask image instead of retaining per-edit files', async () => {
    const { files, native, repository } = await setup();
    await repository.saveRevision(maskInput());
    await repository.saveRevision(maskInput('mask-2'));

    expect((await repository.getActiveForProfile(profile.id))?.id).toBe(
      'mask-2',
    );
    expect([...files.durable].some((path) => path.includes('mask-1'))).toBe(
      false,
    );
    native.close();
  });

  it('deletes the immutable panorama and mask files together', async () => {
    const { files, native, repository } = await setup();
    await repository.saveRevision(maskInput());

    const result = await repository.deleteActivePanoramaAndMasks(
      profile.id,
      '2026-08-21T13:00:00.000Z',
    );

    expect(result).toEqual({ deleted: true, fileCleanupFailures: [] });
    expect(files.durable.size).toBe(0);
    expect(await repository.getActiveForProfile(profile.id)).toBeNull();
    native.close();
  });
});
