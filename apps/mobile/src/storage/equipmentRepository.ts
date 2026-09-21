import { z } from 'zod';

import type { SqlDatabase } from './types';
import { inImmediateTransaction } from './types';
import type { TrackingMode } from '../astronomy/imagingFrame';

const framingSchema = z.object({
  trackingMode: z.enum(['altaz', 'equatorial', 'derotatedAltaz']),
  frameOrientationDegrees: z.number().finite().min(0).max(180),
});

const equipmentSchema = z.object({
  lensOffsetMillimeters: z
    .number()
    .finite()
    .min(-10_000)
    .max(10_000)
    .optional(),
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  focalLengthMillimeters: z.number().positive(),
  apertureMillimeters: z.number().positive(),
  sensorWidthPixels: z.number().int().positive().max(100_000),
  sensorHeightPixels: z.number().int().positive().max(100_000),
  pixelSizeMicrometers: z.number().positive(),
  trackingMode: framingSchema.shape.trackingMode.optional(),
  frameOrientationDegrees:
    framingSchema.shape.frameOrientationDegrees.optional(),
  createdAtUtc: z.iso.datetime({ offset: true }),
  updatedAtUtc: z.iso.datetime({ offset: true }),
});

export type EquipmentRecord = z.infer<typeof equipmentSchema>;

const selectEquipmentSql = `
  SELECT
    id,
    name,
    lens_offset_millimeters AS lensOffsetMillimeters,
    focal_length_millimeters AS focalLengthMillimeters,
    aperture_millimeters AS apertureMillimeters,
    sensor_width_pixels AS sensorWidthPixels,
    sensor_height_pixels AS sensorHeightPixels,
    pixel_size_micrometers AS pixelSizeMicrometers,
    tracking_mode AS trackingMode,
    frame_orientation_degrees AS frameOrientationDegrees,
    created_at_utc AS createdAtUtc,
    updated_at_utc AS updatedAtUtc
  FROM equipment_configurations
`;

export class EquipmentRepository {
  private readonly database: SqlDatabase;

  constructor(database: SqlDatabase) {
    this.database = database;
  }

  async create(rawInput: EquipmentRecord): Promise<void> {
    const input = equipmentSchema.parse(rawInput);
    await inImmediateTransaction(this.database, async () => {
      await this.database.runAsync(
        `INSERT INTO equipment_configurations (
          id, name, focal_length_millimeters, aperture_millimeters,
          sensor_width_millimeters, sensor_height_millimeters,
          sensor_width_pixels, sensor_height_pixels,
          pixel_size_micrometers, frame_rotation_degrees, created_at_utc, updated_at_utc,
          tracking_mode, frame_orientation_degrees, lens_offset_millimeters
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.name,
          input.focalLengthMillimeters,
          input.apertureMillimeters,
          (input.sensorWidthPixels * input.pixelSizeMicrometers) / 1000,
          (input.sensorHeightPixels * input.pixelSizeMicrometers) / 1000,
          input.sensorWidthPixels,
          input.sensorHeightPixels,
          input.pixelSizeMicrometers,
          input.createdAtUtc,
          input.updatedAtUtc,
          input.trackingMode ?? 'altaz',
          input.frameOrientationDegrees ?? 0,
          input.lensOffsetMillimeters ?? 0,
        ],
      );
      await this.database.runAsync(
        `INSERT OR IGNORE INTO profile_equipment_selections (
          profile_id, equipment_configuration_id
        ) SELECT id, ? FROM profiles`,
        [input.id],
      );
    });
  }

  async getById(id: string): Promise<EquipmentRecord | null> {
    const row = await this.database.getFirstAsync<EquipmentRecord>(
      `${selectEquipmentSql} WHERE id = ?`,
      [id],
    );
    return row ? equipmentSchema.parse(row) : null;
  }

  async list(): Promise<EquipmentRecord[]> {
    const rows = await this.database.getAllAsync<EquipmentRecord>(
      `${selectEquipmentSql} ORDER BY created_at_utc, id`,
    );
    return rows.map((row) => equipmentSchema.parse(row));
  }

  async listSelectionIdsByProfile(): Promise<Record<string, string>> {
    const rows = await this.database.getAllAsync<{
      equipmentId: string;
      profileId: string;
    }>(
      `SELECT
        profile_id AS profileId,
        equipment_configuration_id AS equipmentId
      FROM profile_equipment_selections`,
    );
    return Object.fromEntries(
      rows.map((row) => [row.profileId, row.equipmentId]),
    );
  }

  async selectForProfile(
    profileId: string,
    equipmentId: string,
  ): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO profile_equipment_selections (profile_id, equipment_configuration_id)
        VALUES (?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET
          equipment_configuration_id = excluded.equipment_configuration_id`,
      [profileId, equipmentId],
    );
  }

  async getSelectedForProfile(
    profileId: string,
  ): Promise<EquipmentRecord | null> {
    const row = await this.database.getFirstAsync<EquipmentRecord>(
      `${selectEquipmentSql}
        INNER JOIN profile_equipment_selections selection
          ON selection.equipment_configuration_id = equipment_configurations.id
        WHERE selection.profile_id = ?`,
      [profileId],
    );
    return row ? equipmentSchema.parse(row) : null;
  }

  async update(
    id: string,
    changes: Omit<EquipmentRecord, 'id' | 'createdAtUtc'>,
  ): Promise<void> {
    const values = equipmentSchema
      .omit({ id: true, createdAtUtc: true })
      .parse(changes);
    const result = await this.database.runAsync(
      `UPDATE equipment_configurations SET
        name = ?,
        focal_length_millimeters = ?,
        aperture_millimeters = ?,
        sensor_width_millimeters = ?,
        sensor_height_millimeters = ?,
        sensor_width_pixels = ?,
        sensor_height_pixels = ?,
        pixel_size_micrometers = ?,
        frame_rotation_degrees = 0,
        updated_at_utc = ?, lens_offset_millimeters = ?
      WHERE id = ?`,
      [
        values.name,
        values.focalLengthMillimeters,
        values.apertureMillimeters,
        (values.sensorWidthPixels * values.pixelSizeMicrometers) / 1000,
        (values.sensorHeightPixels * values.pixelSizeMicrometers) / 1000,
        values.sensorWidthPixels,
        values.sensorHeightPixels,
        values.pixelSizeMicrometers,
        values.updatedAtUtc,
        values.lensOffsetMillimeters ?? 0,
        id,
      ],
    );
    if (result.changes !== 1) {
      throw new Error(`Equipment configuration not found: ${id}`);
    }
  }

  async delete(id: string): Promise<void> {
    await inImmediateTransaction(this.database, async () => {
      const affectedProfiles = await this.database.getAllAsync<{
        profileId: string;
      }>(
        `SELECT profile_id AS profileId
         FROM profile_equipment_selections
         WHERE equipment_configuration_id = ?`,
        [id],
      );
      await this.database.runAsync(
        'DELETE FROM equipment_configurations WHERE id = ?',
        [id],
      );
      for (const { profileId } of affectedProfiles) {
        await this.database.runAsync(
          `INSERT INTO profile_equipment_selections (
            profile_id, equipment_configuration_id
          )
          SELECT ?, id
          FROM equipment_configurations
          ORDER BY created_at_utc, id
          LIMIT 1`,
          [profileId],
        );
      }
    });
  }

  async updateFraming(
    id: string,
    framing: { trackingMode: TrackingMode; frameOrientationDegrees: number },
  ): Promise<void> {
    const values = framingSchema.parse(framing);
    const result = await this.database.runAsync(
      `UPDATE equipment_configurations SET tracking_mode = ?, frame_orientation_degrees = ?, updated_at_utc = ? WHERE id = ?`,
      [
        values.trackingMode,
        values.frameOrientationDegrees,
        new Date().toISOString(),
        id,
      ],
    );
    if (result.changes !== 1)
      throw new Error('The selected optics setup no longer exists.');
  }
}
