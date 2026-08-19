import { z } from 'zod';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { SqlDatabase } from './types';

const catalogueTargetSchema = z.object({
  id: z.string().min(1),
  preferredName: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  rightAscensionJ2000Hours: z.number().min(0).lt(24),
  declinationJ2000Degrees: z.number().min(-90).max(90),
  constellation: z.string(),
  objectType: z.string(),
  majorAxisArcminutes: z.number().positive().optional(),
  minorAxisArcminutes: z.number().positive().optional(),
  positionAngleDegrees: z.number().finite().optional(),
  magnitude: z.number().finite().optional(),
  memberships: z.object({
    messier: z.array(z.number().int().positive()),
    ngc: z.array(z.string()),
    ic: z.array(z.string()),
    caldwell: z.number().int().min(1).max(109).optional(),
  }),
  prominenceTier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
});

export class CatalogueRepository {
  private readonly database: SqlDatabase;

  constructor(database: SqlDatabase) {
    this.database = database;
  }

  async listAll(): Promise<CatalogueTarget[]> {
    const rows = await this.database.getAllAsync<{ targetJson: string }>(
      `SELECT target_json AS targetJson
       FROM catalogue_targets
       ORDER BY id`,
    );
    return rows.map((row, index) => {
      try {
        return catalogueTargetSchema.parse(
          JSON.parse(row.targetJson),
        ) as CatalogueTarget;
      } catch (error) {
        throw new Error(`Invalid catalogue target at row ${index + 1}`, {
          cause: error,
        });
      }
    });
  }
}
