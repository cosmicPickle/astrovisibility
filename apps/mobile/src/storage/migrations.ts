import type { SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
        latitude_degrees_north REAL NOT NULL CHECK(latitude_degrees_north BETWEEN -90 AND 90),
        longitude_degrees_east REAL NOT NULL CHECK(longitude_degrees_east BETWEEN -180 AND 180),
        elevation_meters_above_mean_sea_level REAL NOT NULL DEFAULT 0,
        time_zone_id TEXT NOT NULL,
        location_accuracy_meters REAL,
        active_panorama_revision_id TEXT,
        active_mask_revision_id TEXT,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS equipment_configurations (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
        focal_length_millimeters REAL NOT NULL CHECK(focal_length_millimeters > 0),
        aperture_millimeters REAL NOT NULL CHECK(aperture_millimeters > 0),
        sensor_width_millimeters REAL NOT NULL CHECK(sensor_width_millimeters > 0),
        sensor_height_millimeters REAL NOT NULL CHECK(sensor_height_millimeters > 0),
        pixel_size_micrometers REAL NOT NULL CHECK(pixel_size_micrometers > 0),
        frame_rotation_degrees REAL NOT NULL DEFAULT 0,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile_equipment_selections (
        profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        equipment_configuration_id TEXT NOT NULL REFERENCES equipment_configurations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS panorama_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('draft', 'complete')),
        format_version INTEGER NOT NULL CHECK(format_version > 0),
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS panorama_tiles (
        id TEXT PRIMARY KEY NOT NULL,
        panorama_revision_id TEXT NOT NULL REFERENCES panorama_revisions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        file_relative_path TEXT NOT NULL UNIQUE,
        width_pixels INTEGER NOT NULL CHECK(width_pixels > 0),
        height_pixels INTEGER NOT NULL CHECK(height_pixels > 0),
        center_azimuth_degrees REAL NOT NULL CHECK(center_azimuth_degrees >= 0 AND center_azimuth_degrees < 360),
        center_altitude_degrees REAL NOT NULL CHECK(center_altitude_degrees BETWEEN -90 AND 90),
        roll_degrees REAL NOT NULL,
        horizontal_fov_degrees REAL NOT NULL CHECK(horizontal_fov_degrees > 0 AND horizontal_fov_degrees <= 180),
        vertical_fov_degrees REAL NOT NULL CHECK(vertical_fov_degrees > 0 AND vertical_fov_degrees <= 180),
        captured_at_utc TEXT NOT NULL,
        heading_accuracy_degrees REAL,
        orientation_confidence TEXT,
        correction_azimuth_degrees REAL NOT NULL DEFAULT 0,
        correction_altitude_degrees REAL NOT NULL DEFAULT 0,
        correction_roll_degrees REAL NOT NULL DEFAULT 0,
        coverage_polygon_json TEXT,
        UNIQUE(panorama_revision_id, ordinal)
      );

      CREATE TABLE IF NOT EXISTS mask_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        panorama_revision_id TEXT NOT NULL REFERENCES panorama_revisions(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('draft', 'complete')),
        format_version INTEGER NOT NULL CHECK(format_version > 0),
        coverage_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mask_operations (
        id TEXT PRIMARY KEY NOT NULL,
        mask_revision_id TEXT NOT NULL REFERENCES mask_revisions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        kind TEXT NOT NULL CHECK(kind IN ('visiblePolygon', 'blockedStroke', 'visibleStroke')),
        geometry_json TEXT NOT NULL,
        UNIQUE(mask_revision_id, ordinal)
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS catalogue_targets (
        id TEXT PRIMARY KEY NOT NULL,
        target_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS catalogue_metadata (
        singleton_id INTEGER PRIMARY KEY NOT NULL CHECK(singleton_id = 1),
        data_version TEXT NOT NULL,
        output_sha256 TEXT NOT NULL,
        target_count INTEGER NOT NULL CHECK(target_count >= 0),
        imported_at_utc TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS panorama_revisions_profile_idx ON panorama_revisions(profile_id);
      CREATE INDEX IF NOT EXISTS panorama_tiles_revision_idx ON panorama_tiles(panorama_revision_id);
      CREATE INDEX IF NOT EXISTS mask_revisions_profile_idx ON mask_revisions(profile_id);
      CREATE INDEX IF NOT EXISTS mask_operations_revision_idx ON mask_operations(mask_revision_id);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE panorama_capture_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
        format_version INTEGER NOT NULL CHECK(format_version > 0),
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE panorama_capture_draft_tiles (
        id TEXT PRIMARY KEY NOT NULL,
        draft_id TEXT NOT NULL REFERENCES panorama_capture_drafts(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        file_relative_path TEXT NOT NULL UNIQUE,
        file_extension TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK(source_kind IN ('camera', 'import')),
        width_pixels INTEGER NOT NULL CHECK(width_pixels > 0),
        height_pixels INTEGER NOT NULL CHECK(height_pixels > 0),
        captured_at_utc TEXT NOT NULL,
        orientation_snapshot_json TEXT NOT NULL,
        orientation_confidence TEXT NOT NULL CHECK(orientation_confidence IN ('high', 'medium', 'low', 'manual')),
        center_azimuth_degrees REAL NOT NULL CHECK(center_azimuth_degrees >= 0 AND center_azimuth_degrees < 360),
        center_altitude_degrees REAL NOT NULL CHECK(center_altitude_degrees BETWEEN 0 AND 90),
        roll_degrees REAL NOT NULL,
        horizontal_fov_degrees REAL NOT NULL CHECK(horizontal_fov_degrees > 0 AND horizontal_fov_degrees <= 180),
        vertical_fov_degrees REAL NOT NULL CHECK(vertical_fov_degrees > 0 AND vertical_fov_degrees <= 180),
        coverage_polygon_json TEXT NOT NULL,
        UNIQUE(draft_id, ordinal)
      );

      CREATE INDEX panorama_capture_draft_tiles_draft_idx
        ON panorama_capture_draft_tiles(draft_id);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE mask_operations_v3 (
        id TEXT NOT NULL,
        mask_revision_id TEXT NOT NULL REFERENCES mask_revisions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        kind TEXT NOT NULL CHECK(kind IN ('visiblePolygon', 'blockedStroke', 'visibleStroke')),
        geometry_json TEXT NOT NULL,
        PRIMARY KEY(mask_revision_id, id),
        UNIQUE(mask_revision_id, ordinal)
      );

      INSERT INTO mask_operations_v3 (
        id, mask_revision_id, ordinal, kind, geometry_json
      )
      SELECT id, mask_revision_id, ordinal, kind, geometry_json
      FROM mask_operations;

      DROP TABLE mask_operations;
      ALTER TABLE mask_operations_v3 RENAME TO mask_operations;
      CREATE INDEX mask_operations_revision_idx
        ON mask_operations(mask_revision_id);
    `,
  },
  {
    version: 4,
    sql: `
      UPDATE equipment_configurations
      SET
        sensor_width_millimeters =
          sensor_width_millimeters * pixel_size_micrometers / 1000,
        sensor_height_millimeters =
          sensor_height_millimeters * pixel_size_micrometers / 1000
      WHERE
        sensor_width_millimeters >= 256
        AND sensor_height_millimeters >= 256
        AND pixel_size_micrometers BETWEEN 0.5 AND 20
        AND sensor_width_millimeters * pixel_size_micrometers / 1000 <= 100
        AND sensor_height_millimeters * pixel_size_micrometers / 1000 <= 100;
    `,
  },
  {
    version: 5,
    sql: `
      UPDATE profiles
      SET active_mask_revision_id = NULL,
          active_panorama_revision_id = NULL;

      DELETE FROM panorama_capture_drafts;
      DELETE FROM mask_revisions;
      DELETE FROM panorama_revisions;
    `,
  },
];

export async function migrateDatabase(database: SqlDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON');
  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = row?.user_version ?? 0;
  const newestVersion = migrations.at(-1)?.version ?? 0;
  if (currentVersion > newestVersion) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${newestVersion}.`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    await inImmediateTransaction(database, async () => {
      await database.execAsync(migration.sql);
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
