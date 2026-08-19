/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';

import { migrateDatabase } from './migrations';
import { PanoramaDraftRepository } from './panoramaDraftRepository';
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
  failCopyAt: number | undefined;
  private copyCount = 0;

  async promoteTemporaryFile(sourceUri: string, destination: string) {
    if (!this.temporary.delete(sourceUri)) throw new Error('missing source');
    this.durable.add(destination);
  }

  async copyOwnedFile(source: string, destination: string) {
    this.copyCount += 1;
    if (this.copyCount === this.failCopyAt) throw new Error('storage full');
    if (!this.durable.has(source)) throw new Error('missing owned source');
    this.durable.add(destination);
  }

  async deleteOwnedFile(relativePath: string) {
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

const tile = {
  id: 'tile-1',
  temporaryUri: 'temp://tile-1.jpg',
  fileExtension: 'jpg',
  sourceKind: 'camera' as const,
  widthPixels: 1600,
  heightPixels: 1200,
  capturedAtUtc: '2026-08-19T12:01:00.000Z',
  orientationSnapshot: {
    trueHeadingDegrees: 355,
    headingAccuracyDegrees: 12,
    estimatedAltitudeDegrees: 24,
    rollDegrees: 1,
    rawRotation: { alphaRadians: 1, betaRadians: 2, gammaRadians: 3 },
  },
  reviewedPlacement: {
    centerAzimuthDegrees: 355,
    centerAltitudeDegrees: 24,
    rollDegrees: 1,
    horizontalFieldOfViewDegrees: 62,
    verticalFieldOfViewDegrees: 48,
  },
  orientationConfidence: 'high' as const,
  coveragePolygon: [
    { azimuthDegrees: 324, altitudeDegrees: 0 },
    { azimuthDegrees: 386, altitudeDegrees: 0 },
    { azimuthDegrees: 386, altitudeDegrees: 48 },
    { azimuthDegrees: 324, altitudeDegrees: 48 },
  ],
};

async function setup() {
  const native = new DatabaseSync(':memory:');
  const database = new NodeSqliteDatabase(native);
  const files = new MemoryOwnedFileStore();
  await migrateDatabase(database);
  await new ProfileRepository(database).create(profile);
  return { native, database, files };
}

describe('panorama capture drafts', () => {
  it('persists accepted camera/import tiles and reviewed correction across restart', async () => {
    const { native, database, files } = await setup();
    files.temporary.add(tile.temporaryUri);
    files.temporary.add('temp://import.png');
    const repository = new PanoramaDraftRepository(database, files);
    await repository.create('draft-1', profile.id, profile.createdAtUtc);
    await repository.addTile('draft-1', tile, tile.capturedAtUtc);
    await repository.addTile(
      'draft-1',
      {
        ...tile,
        id: 'tile-2',
        temporaryUri: 'temp://import.png',
        fileExtension: 'png',
        sourceKind: 'import',
        orientationConfidence: 'manual',
      },
      '2026-08-19T12:02:00.000Z',
    );
    await repository.updateTilePlacement(
      'draft-1',
      'tile-2',
      {
        centerAzimuthDegrees: 15,
        centerAltitudeDegrees: 72,
        rollDegrees: -4,
        horizontalFieldOfViewDegrees: 58,
        verticalFieldOfViewDegrees: 44,
      },
      '2026-08-19T12:03:00.000Z',
    );

    const restarted = new PanoramaDraftRepository(database, files);
    const draft = await restarted.getForProfile(profile.id);
    expect(draft?.tiles).toHaveLength(2);
    expect(draft?.tiles[1]).toMatchObject({
      sourceKind: 'import',
      orientationConfidence: 'manual',
      uri: expect.stringContaining('panorama-drafts/draft-1'),
      reviewedPlacement: {
        centerAzimuthDegrees: 15,
        centerAltitudeDegrees: 72,
        rollDegrees: -4,
        horizontalFieldOfViewDegrees: 58,
        verticalFieldOfViewDegrees: 44,
      },
    });
    native.close();
  });

  it('atomically activates copied final files and removes the completed draft', async () => {
    const { native, database, files } = await setup();
    files.temporary.add(tile.temporaryUri);
    const repository = new PanoramaDraftRepository(database, files);
    await repository.create('draft-1', profile.id, profile.createdAtUtc);
    await repository.addTile('draft-1', tile, tile.capturedAtUtc);

    await repository.complete(
      'draft-1',
      'panorama-1',
      '2026-08-19T12:04:00.000Z',
    );

    expect(await repository.getForProfile(profile.id)).toBeNull();
    expect(await repository.getActiveForProfile(profile.id)).toMatchObject({
      id: 'panorama-1',
      tiles: [{ id: 'tile-1', centerAzimuthDegrees: 355 }],
    });
    expect(files.durable).toEqual(
      new Set(['profiles/profile-1/panoramas/panorama-1/tiles/tile-1.jpg']),
    );
    native.close();
  });

  it('keeps the durable draft recoverable when final copying runs out of storage', async () => {
    const { native, database, files } = await setup();
    files.temporary.add(tile.temporaryUri);
    const repository = new PanoramaDraftRepository(database, files);
    await repository.create('draft-1', profile.id, profile.createdAtUtc);
    await repository.addTile('draft-1', tile, tile.capturedAtUtc);
    files.failCopyAt = 1;

    await expect(
      repository.complete('draft-1', 'panorama-1', '2026-08-19T12:04:00.000Z'),
    ).rejects.toThrow('storage full');

    expect(await repository.getForProfile(profile.id)).not.toBeNull();
    expect(await repository.getActiveForProfile(profile.id)).toBeNull();
    expect(files.durable).toEqual(
      new Set(['profiles/profile-1/panorama-drafts/draft-1/tiles/tile-1.jpg']),
    );
    native.close();
  });

  it('discards draft records and their app-local images', async () => {
    const { native, database, files } = await setup();
    files.temporary.add(tile.temporaryUri);
    const repository = new PanoramaDraftRepository(database, files);
    await repository.create('draft-1', profile.id, profile.createdAtUtc);
    await repository.addTile('draft-1', tile, tile.capturedAtUtc);

    await repository.discard('draft-1');

    expect(await repository.getForProfile(profile.id)).toBeNull();
    expect(files.durable.size).toBe(0);
    native.close();
  });
});
