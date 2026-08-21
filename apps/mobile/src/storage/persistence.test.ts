/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter.ts';
import { seedCatalogue } from './catalogueSeed';
import { EquipmentRepository } from './equipmentRepository';
import {
  deleteAllLocalUserData,
  reconcileMissingOwnedFileReferences,
} from './localDataMaintenance';
import { migrateDatabase } from './migrations';
import {
  removeOrphanedOwnedFiles,
  saveCompletedMask,
  saveCompletedPanorama,
} from './panoramaPersistence';
import { ProfileRepository } from './profileRepository';
import type { OwnedFileStore, SqlDatabase, SqlValue } from './types';

class NodeSqliteDatabase implements SqlDatabase {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async runAsync(sql: string, parameters: readonly SqlValue[] = []) {
    const result = this.database.prepare(sql).run(...parameters);
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
      (this.database.prepare(sql).get(...parameters) as T | undefined) ?? null
    );
  }

  async getAllAsync<T>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<T[]> {
    return this.database.prepare(sql).all(...parameters) as T[];
  }
}

class MemoryOwnedFileStore implements OwnedFileStore {
  readonly temporary = new Set<string>();
  readonly durable = new Set<string>();
  failPromotionAt: number | undefined;
  private promotionCount = 0;

  async promoteTemporaryFile(
    sourceUri: string,
    destinationRelativePath: string,
  ): Promise<void> {
    this.promotionCount += 1;
    if (this.promotionCount === this.failPromotionAt) {
      throw new Error('simulated storage exhaustion');
    }
    if (!this.temporary.delete(sourceUri)) {
      throw new Error(`Missing temporary file: ${sourceUri}`);
    }
    this.durable.add(destinationRelativePath);
  }

  async deleteOwnedFile(relativePath: string): Promise<void> {
    this.durable.delete(relativePath);
  }

  async listOwnedFiles(): Promise<string[]> {
    return [...this.durable];
  }

  async copyOwnedFile(
    sourceRelativePath: string,
    destinationRelativePath: string,
  ): Promise<void> {
    if (!this.durable.has(sourceRelativePath)) {
      throw new Error(`Missing owned file: ${sourceRelativePath}`);
    }
    this.durable.add(destinationRelativePath);
  }

  resolveOwnedFileUri(relativePath: string): string {
    return `owned://${relativePath}`;
  }
}

function createDatabase(): {
  native: DatabaseSync;
  database: NodeSqliteDatabase;
} {
  const native = new DatabaseSync(':memory:');
  return { native, database: new NodeSqliteDatabase(native) };
}

const profile = {
  id: 'profile-1',
  name: 'Bedroom window',
  latitudeDegreesNorth: 42.6977,
  longitudeDegreesEast: 23.3219,
  elevationMetersAboveMeanSeaLevel: 550,
  timeZoneId: 'Europe/Sofia',
  locationAccuracyMeters: 8,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
};

const equipment = {
  id: 'equipment-1',
  name: 'Wide-field refractor',
  focalLengthMillimeters: 400,
  apertureMillimeters: 80,
  sensorWidthMillimeters: 23.5,
  sensorHeightMillimeters: 15.6,
  pixelSizeMicrometers: 3.76,
  frameRotationDegrees: 0,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
};

describe('SQLite migrations and repositories', () => {
  it('applies the versioned schema idempotently and persists profile CRUD', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'astrovisibility-'));
    const databasePath = path.join(directory, 'restart.sqlite');
    const native = new DatabaseSync(databasePath);
    const database = new NodeSqliteDatabase(native);
    await migrateDatabase(database);
    await migrateDatabase(database);

    const version = await database.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(version?.user_version).toBe(5);

    const firstRepository = new ProfileRepository(database);
    await firstRepository.create(profile);
    expect(await firstRepository.getById(profile.id)).toEqual(profile);

    native.close();
    const restartedNative = new DatabaseSync(databasePath);
    const restartedDatabase = new NodeSqliteDatabase(restartedNative);
    await migrateDatabase(restartedDatabase);
    const restartedRepository = new ProfileRepository(restartedDatabase);
    await restartedRepository.update(profile.id, {
      name: 'Back garden',
      latitudeDegreesNorth: 51.5,
      longitudeDegreesEast: -0.12,
      elevationMetersAboveMeanSeaLevel: 35,
      timeZoneId: 'Europe/London',
      locationAccuracyMeters: null,
      updatedAtUtc: '2026-08-19T12:30:00.000Z',
    });
    expect(await restartedRepository.getById(profile.id)).toMatchObject({
      name: 'Back garden',
      latitudeDegreesNorth: 51.5,
      longitudeDegreesEast: -0.12,
      elevationMetersAboveMeanSeaLevel: 35,
      timeZoneId: 'Europe/London',
      locationAccuracyMeters: null,
    });
    expect(await restartedRepository.list()).toHaveLength(1);

    await restartedRepository.delete(profile.id);
    expect(await restartedRepository.getById(profile.id)).toBeNull();
    restartedNative.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('persists equipment and clears profile selections when equipment is deleted', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    const repository = new EquipmentRepository(database);
    await repository.create(equipment);
    await repository.selectForProfile(profile.id, 'equipment-1');
    expect(await repository.getSelectedForProfile(profile.id)).toMatchObject({
      id: 'equipment-1',
      focalLengthMillimeters: 400,
    });

    await repository.delete('equipment-1');
    expect(await repository.getSelectedForProfile(profile.id)).toBeNull();
    native.close();
  });

  it('selects the first equipment by default regardless of creation order', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    const equipmentRepository = new EquipmentRepository(database);
    await equipmentRepository.create(equipment);
    await new ProfileRepository(database).create(profile);

    expect(
      await equipmentRepository.getSelectedForProfile(profile.id),
    ).toMatchObject({ id: equipment.id });
    native.close();
  });

  it('selects the first saved equipment for existing profiles', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    const equipmentRepository = new EquipmentRepository(database);
    await equipmentRepository.create(equipment);

    expect(
      await equipmentRepository.getSelectedForProfile(profile.id),
    ).toMatchObject({ id: equipment.id });
    native.close();
  });

  it('moves every affected selection to the next configuration on deletion', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    const profiles = new ProfileRepository(database);
    await profiles.create(profile);
    await profiles.create({
      ...profile,
      id: 'profile-2',
      name: 'Terrace',
      createdAtUtc: '2026-08-19T12:01:00.000Z',
      updatedAtUtc: '2026-08-19T12:01:00.000Z',
    });
    const repository = new EquipmentRepository(database);
    await repository.create(equipment);
    await repository.create({
      ...equipment,
      id: 'equipment-2',
      name: 'Long-focus reflector',
      focalLengthMillimeters: 1200,
      createdAtUtc: '2026-08-19T12:02:00.000Z',
      updatedAtUtc: '2026-08-19T12:02:00.000Z',
    });

    await repository.delete(equipment.id);

    expect(await repository.getSelectedForProfile(profile.id)).toMatchObject({
      id: 'equipment-2',
    });
    expect(await repository.getSelectedForProfile('profile-2')).toMatchObject({
      id: 'equipment-2',
    });
    native.close();
  });

  it('persists complete equipment edits across restart', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'astrovisibility-'));
    const databasePath = path.join(directory, 'equipment-restart.sqlite');
    const native = new DatabaseSync(databasePath);
    const database = new NodeSqliteDatabase(native);
    await migrateDatabase(database);
    const repository = new EquipmentRepository(database);
    await repository.create(equipment);
    native.close();

    const restartedNative = new DatabaseSync(databasePath);
    const restartedDatabase = new NodeSqliteDatabase(restartedNative);
    await migrateDatabase(restartedDatabase);
    const restartedRepository = new EquipmentRepository(restartedDatabase);
    await restartedRepository.update(equipment.id, {
      name: 'Edited setup',
      focalLengthMillimeters: 420,
      apertureMillimeters: 82,
      sensorWidthMillimeters: 36,
      sensorHeightMillimeters: 24,
      pixelSizeMicrometers: 4.2,
      frameRotationDegrees: 90,
      updatedAtUtc: '2026-08-19T13:00:00.000Z',
    });

    expect(await restartedRepository.getById(equipment.id)).toMatchObject({
      name: 'Edited setup',
      focalLengthMillimeters: 420,
      sensorWidthMillimeters: 36,
      frameRotationDegrees: 90,
    });
    restartedNative.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('repairs unmistakable pixel counts stored as sensor millimetres', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    await database.runAsync(
      `INSERT INTO equipment_configurations (
        id, name, focal_length_millimeters, aperture_millimeters,
        sensor_width_millimeters, sensor_height_millimeters,
        pixel_size_micrometers, frame_rotation_degrees, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'dwarf-3',
        'DWARF 3',
        150,
        35,
        3840,
        2160,
        2,
        0,
        '2026-08-20T00:00:00.000Z',
        '2026-08-20T00:00:00.000Z',
      ],
    );
    await database.execAsync('PRAGMA user_version = 3');

    await migrateDatabase(database);

    const repaired = await new EquipmentRepository(database).getById('dwarf-3');
    expect(repaired).toMatchObject({
      sensorWidthMillimeters: 7.68,
      sensorHeightMillimeters: 4.32,
      pixelSizeMicrometers: 2,
    });
    native.close();
  });

  it('invalidates legacy panorama, mask, and draft data while preserving setup records', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    await new EquipmentRepository(database).create(equipment);
    files.temporary.add('temp://panorama.jpg');
    await saveCompletedPanorama(database, files, {
      id: 'legacy-panorama',
      profileId: profile.id,
      formatVersion: 1,
      createdAtUtc: '2026-08-19T12:01:00.000Z',
      tiles: [
        {
          id: 'legacy-tile',
          temporaryUri: 'temp://panorama.jpg',
          fileExtension: 'jpg',
          widthPixels: 1600,
          heightPixels: 1200,
          centerAzimuthDegrees: 0,
          centerAltitudeDegrees: 45,
          rollDegrees: 0,
          horizontalFovDegrees: 55,
          verticalFovDegrees: 69,
          capturedAtUtc: '2026-08-19T12:01:00.000Z',
          coveragePolygonJson: JSON.stringify([
            { azimuthDegrees: -27.5, altitudeDegrees: 10.5 },
            { azimuthDegrees: 27.5, altitudeDegrees: 10.5 },
            { azimuthDegrees: 27.5, altitudeDegrees: 79.5 },
          ]),
        },
      ],
    });
    await saveCompletedMask(database, {
      id: 'legacy-mask',
      profileId: profile.id,
      panoramaRevisionId: 'legacy-panorama',
      formatVersion: 1,
      coverageJson: JSON.stringify([]),
      createdAtUtc: '2026-08-19T12:02:00.000Z',
      operations: [],
    });
    await database.runAsync(
      `INSERT INTO panorama_capture_drafts (
        id, profile_id, format_version, created_at_utc, updated_at_utc
      ) VALUES (?, ?, 1, ?, ?)`,
      [
        'legacy-draft',
        profile.id,
        '2026-08-19T12:03:00.000Z',
        '2026-08-19T12:03:00.000Z',
      ],
    );
    await database.execAsync('PRAGMA user_version = 4');

    await migrateDatabase(database);
    await removeOrphanedOwnedFiles(database, files);

    expect(
      await new ProfileRepository(database).getById(profile.id),
    ).not.toBeNull();
    expect(
      await new EquipmentRepository(database).getById(equipment.id),
    ).not.toBeNull();
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM panorama_revisions',
      ),
    ).toEqual({ count: 0 });
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM mask_revisions',
      ),
    ).toEqual({ count: 0 });
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM panorama_capture_drafts',
      ),
    ).toEqual({ count: 0 });
    expect(files.durable).toEqual(new Set());
    native.close();
  });

  it('seeds catalogue data idempotently by data version and hash', async () => {
    const { native, database } = createDatabase();
    await migrateDatabase(database);
    const targets = [
      {
        id: 'NGC0224',
        preferredName: 'Andromeda Galaxy',
        aliases: ['M 31', 'NGC 224'],
        rightAscensionJ2000Hours: 0.712,
        declinationJ2000Degrees: 41.269,
        constellation: 'And',
        objectType: 'G',
        memberships: { messier: [31], ngc: ['NGC 224'], ic: [] },
        prominenceTier: 1,
      },
    ] satisfies CatalogueTarget[];

    expect(await seedCatalogue(database, targets, 'v1', 'hash-1')).toBe(
      'imported',
    );
    expect(await seedCatalogue(database, targets, 'v1', 'hash-1')).toBe(
      'current',
    );
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM catalogue_targets',
      ),
    ).toEqual({ count: 1 });
    native.close();
  });
});

describe('coordinated panorama and mask persistence', () => {
  it('promotes files before exposing a complete panorama and saves its mask atomically', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    files.temporary.add('temp://one.jpg');
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);

    await saveCompletedPanorama(database, files, {
      id: 'panorama-1',
      profileId: profile.id,
      formatVersion: 1,
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      tiles: [
        {
          id: 'tile-1',
          temporaryUri: 'temp://one.jpg',
          fileExtension: 'jpg',
          widthPixels: 4000,
          heightPixels: 3000,
          centerAzimuthDegrees: 355,
          centerAltitudeDegrees: 25,
          rollDegrees: 0,
          horizontalFovDegrees: 64,
          verticalFovDegrees: 48,
          capturedAtUtc: '2026-08-19T12:59:00.000Z',
        },
      ],
    });

    expect(files.durable).toEqual(
      new Set(['profiles/profile-1/panoramas/panorama-1/tiles/tile-1.jpg']),
    );
    expect(
      await database.getFirstAsync<{ active: string }>(
        'SELECT active_panorama_revision_id AS active FROM profiles WHERE id = ?',
        [profile.id],
      ),
    ).toEqual({ active: 'panorama-1' });

    await saveCompletedMask(database, {
      id: 'mask-1',
      profileId: profile.id,
      panoramaRevisionId: 'panorama-1',
      formatVersion: 1,
      coverageJson: '{"seam":true}',
      createdAtUtc: '2026-08-19T13:05:00.000Z',
      operations: [
        {
          id: 'operation-1',
          kind: 'visiblePolygon',
          geometryJson: '{"points":[]}',
        },
      ],
    });
    expect(
      await database.getFirstAsync<{ active: string }>(
        'SELECT active_mask_revision_id AS active FROM profiles WHERE id = ?',
        [profile.id],
      ),
    ).toEqual({ active: 'mask-1' });
    native.close();
  });

  it('does not expose or retain a broken panorama when a file promotion fails', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    files.temporary.add('temp://one.jpg');
    files.temporary.add('temp://two.jpg');
    files.failPromotionAt = 2;
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);

    await expect(
      saveCompletedPanorama(database, files, {
        id: 'panorama-failed',
        profileId: profile.id,
        formatVersion: 1,
        createdAtUtc: '2026-08-19T13:00:00.000Z',
        tiles: [
          {
            id: 'tile-1',
            temporaryUri: 'temp://one.jpg',
            fileExtension: 'jpg',
            widthPixels: 4000,
            heightPixels: 3000,
            centerAzimuthDegrees: 10,
            centerAltitudeDegrees: 20,
            rollDegrees: 0,
            horizontalFovDegrees: 64,
            verticalFovDegrees: 48,
            capturedAtUtc: '2026-08-19T12:59:00.000Z',
          },
          {
            id: 'tile-2',
            temporaryUri: 'temp://two.jpg',
            fileExtension: 'jpg',
            widthPixels: 4000,
            heightPixels: 3000,
            centerAzimuthDegrees: 60,
            centerAltitudeDegrees: 20,
            rollDegrees: 0,
            horizontalFovDegrees: 64,
            verticalFovDegrees: 48,
            capturedAtUtc: '2026-08-19T12:59:30.000Z',
          },
        ],
      }),
    ).rejects.toThrow('simulated storage exhaustion');

    expect(files.durable.size).toBe(0);
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM panorama_revisions',
      ),
    ).toEqual({ count: 0 });
    expect(
      await database.getFirstAsync<{ active: string | null }>(
        'SELECT active_panorama_revision_id AS active FROM profiles WHERE id = ?',
        [profile.id],
      ),
    ).toEqual({ active: null });
    native.close();
  });

  it('removes only unreferenced owned files during restart recovery', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    files.temporary.add('temp://one.jpg');
    files.durable.add('profiles/profile-1/panoramas/orphan/tiles/orphan.jpg');
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    await saveCompletedPanorama(database, files, {
      id: 'panorama-1',
      profileId: profile.id,
      formatVersion: 1,
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      tiles: [
        {
          id: 'tile-1',
          temporaryUri: 'temp://one.jpg',
          fileExtension: 'jpg',
          widthPixels: 100,
          heightPixels: 100,
          centerAzimuthDegrees: 0,
          centerAltitudeDegrees: 0,
          rollDegrees: 0,
          horizontalFovDegrees: 30,
          verticalFovDegrees: 30,
          capturedAtUtc: '2026-08-19T13:00:00.000Z',
        },
      ],
    });

    expect(await removeOrphanedOwnedFiles(database, files)).toEqual([
      'profiles/profile-1/panoramas/orphan/tiles/orphan.jpg',
    ]);
    expect(files.durable).toEqual(
      new Set(['profiles/profile-1/panoramas/panorama-1/tiles/tile-1.jpg']),
    );
    native.close();
  });

  it('drops a corrupt completed panorama while preserving its profile and catalogue', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    files.temporary.add('temp://one.jpg');
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    await seedCatalogue(database, [], 'v1', 'hash-1');
    await saveCompletedPanorama(database, files, {
      id: 'panorama-corrupt',
      profileId: profile.id,
      formatVersion: 1,
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      tiles: [
        {
          id: 'tile-corrupt',
          temporaryUri: 'temp://one.jpg',
          fileExtension: 'jpg',
          widthPixels: 100,
          heightPixels: 100,
          centerAzimuthDegrees: 0,
          centerAltitudeDegrees: 20,
          rollDegrees: 0,
          horizontalFovDegrees: 30,
          verticalFovDegrees: 30,
          capturedAtUtc: '2026-08-19T13:00:00.000Z',
        },
      ],
    });
    files.durable.clear();

    const recovery = await reconcileMissingOwnedFileReferences(database, files);

    expect(recovery).toEqual({ discardedDraftTiles: 0, removedPanoramas: 1 });
    expect(
      await new ProfileRepository(database).getById(profile.id),
    ).toMatchObject({
      id: profile.id,
    });
    expect(
      await database.getFirstAsync<{
        panoramaId: string | null;
        maskId: string | null;
      }>(
        `SELECT active_panorama_revision_id AS panoramaId,
          active_mask_revision_id AS maskId FROM profiles WHERE id = ?`,
        [profile.id],
      ),
    ).toEqual({ panoramaId: null, maskId: null });
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM catalogue_metadata',
      ),
    ).toEqual({ count: 1 });
    native.close();
  });

  it('removes missing draft tiles so restart leaves a truthful resumable draft', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    await database.runAsync(
      `INSERT INTO panorama_capture_drafts (
        id, profile_id, format_version, created_at_utc, updated_at_utc
      ) VALUES ('draft-1', ?, 1, ?, ?)`,
      [profile.id, profile.createdAtUtc, profile.updatedAtUtc],
    );
    await database.runAsync(
      `INSERT INTO panorama_capture_draft_tiles (
        id, draft_id, ordinal, file_relative_path, file_extension, source_kind,
        width_pixels, height_pixels, captured_at_utc, orientation_snapshot_json,
        orientation_confidence, center_azimuth_degrees, center_altitude_degrees,
        roll_degrees, horizontal_fov_degrees, vertical_fov_degrees,
        coverage_polygon_json
      ) VALUES ('missing-tile', 'draft-1', 0, ?, 'jpg', 'import', 100, 100,
        ?, '{}', 'manual', 0, 20, 0, 30, 30, '[]')`,
      [
        'profiles/profile-1/panorama-drafts/draft-1/tiles/missing.jpg',
        profile.createdAtUtc,
      ],
    );

    const recovery = await reconcileMissingOwnedFileReferences(database, files);

    expect(recovery).toEqual({ discardedDraftTiles: 1, removedPanoramas: 0 });
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM panorama_capture_draft_tiles',
      ),
    ).toEqual({ count: 0 });
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM panorama_capture_drafts',
      ),
    ).toEqual({ count: 1 });
    native.close();
  });

  it('deletes all user-owned rows and reports post-commit file cleanup failures', async () => {
    const { native, database } = createDatabase();
    const files = new MemoryOwnedFileStore();
    files.temporary.add('temp://one.jpg');
    await migrateDatabase(database);
    await new ProfileRepository(database).create(profile);
    await new EquipmentRepository(database).create(equipment);
    await seedCatalogue(database, [], 'v1', 'hash-1');
    await saveCompletedPanorama(database, files, {
      id: 'panorama-1',
      profileId: profile.id,
      formatVersion: 1,
      createdAtUtc: '2026-08-19T13:00:00.000Z',
      tiles: [
        {
          id: 'tile-1',
          temporaryUri: 'temp://one.jpg',
          fileExtension: 'jpg',
          widthPixels: 100,
          heightPixels: 100,
          centerAzimuthDegrees: 0,
          centerAltitudeDegrees: 20,
          rollDegrees: 0,
          horizontalFovDegrees: 30,
          verticalFovDegrees: 30,
          capturedAtUtc: '2026-08-19T13:00:00.000Z',
        },
      ],
    });
    files.failPromotionAt = undefined;
    const originalDelete = files.deleteOwnedFile.bind(files);
    files.deleteOwnedFile = async () => {
      throw new Error('simulated cleanup denial');
    };

    const result = await deleteAllLocalUserData(database, files);

    expect(result.deletedOwnedFileCount).toBe(0);
    expect(result.fileCleanupFailures).toHaveLength(1);
    expect(await new ProfileRepository(database).list()).toEqual([]);
    expect(await new EquipmentRepository(database).list()).toEqual([]);
    expect(
      await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM catalogue_metadata',
      ),
    ).toEqual({ count: 1 });
    files.deleteOwnedFile = originalDelete;
    native.close();
  });
});
