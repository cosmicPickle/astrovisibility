/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { VisibilityMaskOperation } from '../mask/visibilityMask';
import { MaskRepository } from './maskRepository';
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
  async getFirstAsync<T>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<T | null> {
    return (
      (this.native.prepare(sql).get(...parameters) as T | undefined) ?? null
    );
  }
  async getAllAsync<T>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<T[]> {
    return this.native.prepare(sql).all(...parameters) as T[];
  }
}

class MemoryOwnedFileStore implements OwnedFileStore {
  readonly durable = new Set<string>();
  beforeDelete: (() => Promise<void>) | undefined;
  failDelete = false;

  async promoteTemporaryFile() {
    throw new Error('not used');
  }
  async copyOwnedFile() {
    throw new Error('not used');
  }
  async deleteOwnedFile(relativePath: string) {
    await this.beforeDelete?.();
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

const coverage = [
  { azimuthDegrees: 350, altitudeDegrees: 10 },
  { azimuthDegrees: 370, altitudeDegrees: 10 },
  { azimuthDegrees: 370, altitudeDegrees: 60 },
  { azimuthDegrees: 350, altitudeDegrees: 60 },
];

const operations: VisibilityMaskOperation[] = [
  {
    id: 'visible-1',
    kind: 'visiblePolygon',
    points: [
      { azimuthDegrees: 355, altitudeDegrees: 20 },
      { azimuthDegrees: 365, altitudeDegrees: 20 },
      { azimuthDegrees: 365, altitudeDegrees: 50 },
      { azimuthDegrees: 355, altitudeDegrees: 50 },
    ],
  },
  {
    id: 'blocked-1',
    kind: 'blockedStroke',
    angularRadiusDegrees: 0.05,
    points: [{ azimuthDegrees: 360, altitudeDegrees: 30 }],
  },
];

async function setup(databasePath = ':memory:') {
  const native = new DatabaseSync(databasePath);
  const database = new NodeSqliteDatabase(native);
  const files = new MemoryOwnedFileStore();
  await migrateDatabase(database);
  await new ProfileRepository(database).create(profile);
  await database.runAsync(
    `INSERT INTO panorama_revisions (id, profile_id, status, format_version, created_at_utc)
     VALUES ('panorama-1', ?, 'complete', 1, ?)`,
    [profile.id, profile.createdAtUtc],
  );
  const relativePath =
    'profiles/profile-1/panoramas/panorama-1/tiles/tile-1.jpg';
  await database.runAsync(
    `INSERT INTO panorama_tiles (
      id, panorama_revision_id, ordinal, file_relative_path, width_pixels,
      height_pixels, center_azimuth_degrees, center_altitude_degrees,
      roll_degrees, horizontal_fov_degrees, vertical_fov_degrees,
      captured_at_utc, coverage_polygon_json
    ) VALUES ('tile-1', 'panorama-1', 0, ?, 1600, 1200, 0, 35, 0, 20, 50, ?, ?)`,
    [relativePath, profile.createdAtUtc, JSON.stringify(coverage)],
  );
  await database.runAsync(
    `UPDATE profiles SET active_panorama_revision_id = 'panorama-1' WHERE id = ?`,
    [profile.id],
  );
  files.durable.add(relativePath);
  return {
    native,
    database,
    files,
    repository: new MaskRepository(database, files),
  };
}

describe('MaskRepository', () => {
  it('migrates schema v2 masks to revision-scoped operation identity without losing geometry', async () => {
    const native = new DatabaseSync(':memory:');
    native.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE mask_revisions (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE mask_operations (
        id TEXT PRIMARY KEY NOT NULL,
        mask_revision_id TEXT NOT NULL REFERENCES mask_revisions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        kind TEXT NOT NULL CHECK(kind IN ('visiblePolygon', 'blockedStroke', 'visibleStroke')),
        geometry_json TEXT NOT NULL,
        UNIQUE(mask_revision_id, ordinal)
      );
      CREATE INDEX mask_operations_revision_idx ON mask_operations(mask_revision_id);
      INSERT INTO mask_revisions (id) VALUES ('mask-v2'), ('mask-v3');
      INSERT INTO mask_operations (
        id, mask_revision_id, ordinal, kind, geometry_json
      ) VALUES ('stable-region', 'mask-v2', 0, 'visiblePolygon', '{"points":[]}');
      PRAGMA user_version = 2;
    `);
    const database = new NodeSqliteDatabase(native);

    await migrateDatabase(database);
    await database.runAsync(
      `INSERT INTO mask_operations (
        id, mask_revision_id, ordinal, kind, geometry_json
      ) VALUES ('stable-region', 'mask-v3', 0, 'visiblePolygon', '{"points":[]}')`,
    );

    expect(
      await database.getFirstAsync<{ version: number }>(
        'SELECT user_version AS version FROM pragma_user_version',
      ),
    ).toEqual({ version: 3 });
    expect(
      await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM mask_operations
         WHERE id = 'stable-region'`,
      ),
    ).toEqual({ count: 2 });
    native.close();
  });

  it('saves immutable revisions atomically, preserves history, and reloads exact panorama coverage', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'astro-mask-restart-'));
    const databasePath = path.join(directory, 'mask.sqlite');
    const { native, database, files, repository } = await setup(databasePath);
    await repository.saveRevision({
      id: 'mask-1',
      profileId: profile.id,
      panoramaRevisionId: 'panorama-1',
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      operations,
    });
    await repository.saveRevision({
      id: 'mask-2',
      profileId: profile.id,
      panoramaRevisionId: 'panorama-1',
      createdAtUtc: '2026-08-19T13:05:00.000Z',
      operations: operations.slice(0, 1),
    });

    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM mask_revisions',
      ),
    ).toEqual({ count: 2 });
    native.close();
    const restartedNative = new DatabaseSync(databasePath);
    const restartedDatabase = new NodeSqliteDatabase(restartedNative);
    await migrateDatabase(restartedDatabase);
    const active = await new MaskRepository(
      restartedDatabase,
      files,
    ).getActiveForProfile(profile.id);
    expect(active).toMatchObject({
      id: 'mask-2',
      panoramaRevisionId: 'panorama-1',
      coveragePolygons: [coverage],
      operations: [operations[0]],
    });
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(active?.operations)).toBe(true);
    restartedNative.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rolls back a partially inserted revision and leaves the previous active mask unchanged', async () => {
    const { native, database, repository } = await setup();
    await repository.saveRevision({
      id: 'mask-1',
      profileId: profile.id,
      panoramaRevisionId: 'panorama-1',
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      operations: operations.slice(0, 1),
    });
    await database.execAsync(`
      CREATE TRIGGER fail_second_mask_operation BEFORE INSERT ON mask_operations
      WHEN NEW.mask_revision_id = 'mask-2' AND NEW.ordinal = 1 BEGIN
        SELECT RAISE(ABORT, 'simulated operation failure');
      END;
    `);
    await expect(
      repository.saveRevision({
        id: 'mask-2',
        profileId: profile.id,
        panoramaRevisionId: 'panorama-1',
        createdAtUtc: '2026-08-19T13:05:00.000Z',
        operations,
      }),
    ).rejects.toThrow('simulated operation failure');

    expect((await repository.getActiveForProfile(profile.id))?.id).toBe(
      'mask-1',
    );
    expect(
      await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM mask_revisions WHERE id = 'mask-2'`,
      ),
    ).toEqual({ count: 0 });
    native.close();
  });

  it('rejects a mask for any panorama other than the profile active panorama', async () => {
    const { native, database, repository } = await setup();
    await database.runAsync(
      `INSERT INTO panorama_revisions (id, profile_id, status, format_version, created_at_utc)
       VALUES ('panorama-old', ?, 'complete', 1, ?)`,
      [profile.id, profile.createdAtUtc],
    );
    await expect(
      repository.saveRevision({
        id: 'mask-old',
        profileId: profile.id,
        panoramaRevisionId: 'panorama-old',
        createdAtUtc: '2026-08-19T13:00:00.000Z',
        operations,
      }),
    ).rejects.toThrow('active panorama');
    native.close();
  });

  it('does not load an incompatible active-mask pointer after the panorama changes', async () => {
    const { native, database, repository } = await setup();
    await repository.saveRevision({
      id: 'mask-1',
      profileId: profile.id,
      panoramaRevisionId: 'panorama-1',
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      operations,
    });
    await database.runAsync(
      `INSERT INTO panorama_revisions (id, profile_id, status, format_version, created_at_utc)
       VALUES ('panorama-2', ?, 'complete', 1, ?)`,
      [profile.id, profile.createdAtUtc],
    );
    await database.runAsync(
      `UPDATE profiles SET active_panorama_revision_id = 'panorama-2' WHERE id = ?`,
      [profile.id],
    );
    expect(await repository.getActiveForProfile(profile.id)).toBeNull();
    native.close();
  });

  it('commits pair deletion before owned-file cleanup and removes every mask revision', async () => {
    const { native, database, files, repository } = await setup();
    for (const [id, createdAtUtc] of [
      ['mask-1', '2026-08-19T13:00:00.000Z'],
      ['mask-2', '2026-08-19T13:05:00.000Z'],
    ]) {
      await repository.saveRevision({
        id,
        profileId: profile.id,
        panoramaRevisionId: 'panorama-1',
        createdAtUtc,
        operations,
      });
    }
    files.beforeDelete = async () => {
      expect(
        await database.getFirstAsync(
          `SELECT id FROM panorama_revisions WHERE id = 'panorama-1'`,
        ),
      ).toBeNull();
      expect(
        await database.getFirstAsync<{ panorama: string | null }>(
          `SELECT active_panorama_revision_id AS panorama FROM profiles WHERE id = ?`,
          [profile.id],
        ),
      ).toEqual({ panorama: null });
    };

    const result = await repository.deleteActivePanoramaAndMasks(
      profile.id,
      '2026-08-19T13:10:00.000Z',
    );
    expect(result.fileCleanupFailures).toEqual([]);
    expect(files.durable.size).toBe(0);
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM mask_revisions',
      ),
    ).toEqual({ count: 0 });
    native.close();
  });

  it('keeps database records and files when pair deletion fails before commit', async () => {
    const { native, database, files, repository } = await setup();
    await database.execAsync(`
      CREATE TRIGGER fail_panorama_delete BEFORE DELETE ON panorama_revisions BEGIN
        SELECT RAISE(ABORT, 'simulated delete failure');
      END;
    `);
    await expect(
      repository.deleteActivePanoramaAndMasks(
        profile.id,
        '2026-08-19T13:10:00.000Z',
      ),
    ).rejects.toThrow('simulated delete failure');
    expect(files.durable.size).toBe(1);
    expect(
      await database.getFirstAsync(
        `SELECT id FROM panorama_revisions WHERE id = 'panorama-1'`,
      ),
    ).not.toBeNull();
    native.close();
  });

  it('reports post-commit cleanup failures for restart orphan recovery', async () => {
    const { native, database, files, repository } = await setup();
    files.failDelete = true;
    const result = await repository.deleteActivePanoramaAndMasks(
      profile.id,
      '2026-08-19T13:10:00.000Z',
    );
    expect(result.fileCleanupFailures).toEqual([
      'profiles/profile-1/panoramas/panorama-1/tiles/tile-1.jpg',
    ]);
    expect(
      await database.getFirstAsync(
        `SELECT id FROM panorama_revisions WHERE id = 'panorama-1'`,
      ),
    ).toBeNull();
    expect(files.durable.size).toBe(1);
    native.close();
  });
});
