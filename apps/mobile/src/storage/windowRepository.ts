import { z } from 'zod';
import {
  createWindowGeometry,
  type WindowDefinition,
} from '../window/windowGeometry';
import { inImmediateTransaction, type SqlDatabase } from './types';

const schema = z
  .object({
    version: z.literal(1),
    leftAzimuthDegrees: z.number().finite(),
    rightAzimuthDegrees: z.number().finite(),
    topSlope: z.number().finite(),
    bottomSlope: z.number().finite(),
    rightDistanceRatio: z.number().finite(),
    widthMeters: z.number().finite(),
  })
  .strict();

export function parseWindowDefinition(json: string): WindowDefinition {
  if (json.length > 4096) throw new Error('Invalid window metadata.');
  const definition = schema.parse(JSON.parse(json));
  createWindowGeometry(definition);
  return definition;
}

export class WindowRepository {
  private readonly database: SqlDatabase;

  constructor(database: SqlDatabase) {
    this.database = database;
  }

  async getForProfile(profileId: string): Promise<WindowDefinition | null> {
    const row = await this.database.getFirstAsync<{ definition: string }>(
      `SELECT w.definition_json AS definition FROM panorama_windows w
       JOIN profiles p ON p.active_panorama_revision_id = w.panorama_revision_id WHERE p.id = ?`,
      [profileId],
    );
    return row ? parseWindowDefinition(row.definition) : null;
  }

  async save(
    profileId: string,
    panoramaId: string,
    rawDefinition: WindowDefinition,
  ): Promise<void> {
    const definition = schema.parse(rawDefinition);
    createWindowGeometry(definition);
    await inImmediateTransaction(this.database, async () => {
      const active = await this.database.getFirstAsync<{ id: string }>(
        `SELECT p.id FROM profiles p JOIN mask_revisions m ON m.id = p.active_mask_revision_id
         WHERE p.id = ? AND p.active_panorama_revision_id = ? AND m.panorama_revision_id = ? AND m.status = 'complete'`,
        [profileId, panoramaId, panoramaId],
      );
      if (!active)
        throw new Error(
          'Complete the mask for this panorama before defining a window.',
        );
      await this.database.runAsync(
        `INSERT INTO panorama_windows (panorama_revision_id, definition_json) VALUES (?, ?)
        ON CONFLICT(panorama_revision_id) DO UPDATE SET definition_json = excluded.definition_json`,
        [panoramaId, JSON.stringify(definition)],
      );
      await this.database.runAsync(
        'DELETE FROM visibility_calculation_cache WHERE profile_id = ?',
        [profileId],
      );
    });
  }

  async remove(profileId: string, panoramaId: string): Promise<void> {
    await inImmediateTransaction(this.database, async () => {
      await this.database.runAsync(
        `DELETE FROM panorama_windows WHERE panorama_revision_id = ?
        AND panorama_revision_id = (SELECT active_panorama_revision_id FROM profiles WHERE id = ?)`,
        [panoramaId, profileId],
      );
      await this.database.runAsync(
        'DELETE FROM visibility_calculation_cache WHERE profile_id = ?',
        [profileId],
      );
    });
  }
}
