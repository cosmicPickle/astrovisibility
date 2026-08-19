import { z } from 'zod';

import type { SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

const profileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  latitudeDegreesNorth: z.number().min(-90).max(90),
  longitudeDegreesEast: z.number().min(-180).max(180),
  elevationMetersAboveMeanSeaLevel: z.number().finite(),
  timeZoneId: z.string().trim().min(1).max(80),
  locationAccuracyMeters: z.number().nonnegative().nullable().optional(),
  createdAtUtc: z.iso.datetime({ offset: true }),
  updatedAtUtc: z.iso.datetime({ offset: true }),
});

export type ProfileRecord = z.infer<typeof profileSchema>;

interface ProfileRow {
  id: string;
  name: string;
  latitudeDegreesNorth: number;
  longitudeDegreesEast: number;
  elevationMetersAboveMeanSeaLevel: number;
  timeZoneId: string;
  locationAccuracyMeters: number | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

const selectProfileSql = `
  SELECT
    id,
    name,
    latitude_degrees_north AS latitudeDegreesNorth,
    longitude_degrees_east AS longitudeDegreesEast,
    elevation_meters_above_mean_sea_level AS elevationMetersAboveMeanSeaLevel,
    time_zone_id AS timeZoneId,
    location_accuracy_meters AS locationAccuracyMeters,
    created_at_utc AS createdAtUtc,
    updated_at_utc AS updatedAtUtc
  FROM profiles
`;

function toProfile(row: ProfileRow): ProfileRecord {
  return profileSchema.parse(row);
}

export class ProfileRepository {
  private readonly database: SqlDatabase;

  constructor(database: SqlDatabase) {
    this.database = database;
  }

  async create(input: ProfileRecord): Promise<void> {
    const profile = profileSchema.parse(input);
    await inImmediateTransaction(this.database, async () => {
      await this.database.runAsync(
        `INSERT INTO profiles (
          id, name, latitude_degrees_north, longitude_degrees_east,
          elevation_meters_above_mean_sea_level, time_zone_id,
          location_accuracy_meters, created_at_utc, updated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profile.id,
          profile.name,
          profile.latitudeDegreesNorth,
          profile.longitudeDegreesEast,
          profile.elevationMetersAboveMeanSeaLevel,
          profile.timeZoneId,
          profile.locationAccuracyMeters ?? null,
          profile.createdAtUtc,
          profile.updatedAtUtc,
        ],
      );
      await this.database.runAsync(
        `INSERT INTO profile_equipment_selections (
          profile_id, equipment_configuration_id
        )
        SELECT ?, id
        FROM equipment_configurations
        ORDER BY created_at_utc, id
        LIMIT 1`,
        [profile.id],
      );
    });
  }

  async getById(id: string): Promise<ProfileRecord | null> {
    const row = await this.database.getFirstAsync<ProfileRow>(
      `${selectProfileSql} WHERE id = ?`,
      [id],
    );
    return row ? toProfile(row) : null;
  }

  async list(): Promise<ProfileRecord[]> {
    const rows = await this.database.getAllAsync<ProfileRow>(
      `${selectProfileSql} ORDER BY created_at_utc, id`,
    );
    return rows.map(toProfile);
  }

  async update(
    id: string,
    changes: Omit<ProfileRecord, 'id' | 'createdAtUtc'>,
  ): Promise<void> {
    const values = profileSchema
      .omit({ id: true, createdAtUtc: true })
      .parse(changes);
    const result = await this.database.runAsync(
      `UPDATE profiles SET
        name = ?,
        latitude_degrees_north = ?,
        longitude_degrees_east = ?,
        elevation_meters_above_mean_sea_level = ?,
        time_zone_id = ?,
        location_accuracy_meters = ?,
        updated_at_utc = ?
      WHERE id = ?`,
      [
        values.name,
        values.latitudeDegreesNorth,
        values.longitudeDegreesEast,
        values.elevationMetersAboveMeanSeaLevel,
        values.timeZoneId,
        values.locationAccuracyMeters ?? null,
        values.updatedAtUtc,
        id,
      ],
    );
    if (result.changes !== 1) {
      throw new Error(`Profile not found: ${id}`);
    }
  }

  async delete(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM profiles WHERE id = ?', [id]);
  }
}
