import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter.ts';
import type { SqlDatabase, SqlValue } from './types';
import { inImmediateTransaction } from './types';

const INSERT_BATCH_SIZE = 250;

export async function seedCatalogue(
  database: SqlDatabase,
  targets: readonly CatalogueTarget[],
  dataVersion: string,
  outputSha256: string,
): Promise<'current' | 'imported'> {
  const metadata = await database.getFirstAsync<{
    dataVersion: string;
    outputSha256: string;
    targetCount: number;
  }>(
    `SELECT data_version AS dataVersion, output_sha256 AS outputSha256,
      target_count AS targetCount FROM catalogue_metadata WHERE singleton_id = 1`,
  );
  const count = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM catalogue_targets',
  );
  if (
    metadata?.dataVersion === dataVersion &&
    metadata.outputSha256 === outputSha256 &&
    metadata.targetCount === targets.length &&
    count?.count === targets.length
  ) {
    return 'current';
  }

  await inImmediateTransaction(database, async () => {
    await database.runAsync('DELETE FROM catalogue_targets');
    for (let offset = 0; offset < targets.length; offset += INSERT_BATCH_SIZE) {
      const batch = targets.slice(offset, offset + INSERT_BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?)').join(', ');
      const values: SqlValue[] = batch.flatMap((target) => [
        target.id,
        JSON.stringify(target),
      ]);
      await database.runAsync(
        `INSERT INTO catalogue_targets (id, target_json) VALUES ${placeholders}`,
        values,
      );
    }
    await database.runAsync(
      `INSERT INTO catalogue_metadata (
        singleton_id, data_version, output_sha256, target_count, imported_at_utc
      ) VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(singleton_id) DO UPDATE SET
        data_version = excluded.data_version,
        output_sha256 = excluded.output_sha256,
        target_count = excluded.target_count,
        imported_at_utc = excluded.imported_at_utc`,
      [dataVersion, outputSha256, targets.length, new Date().toISOString()],
    );
  });
  return 'imported';
}
