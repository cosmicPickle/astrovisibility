export type SqlValue = string | number | null | Uint8Array;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    parameters?: readonly SqlValue[],
  ): Promise<SqlRunResult>;
  getFirstAsync<T>(
    sql: string,
    parameters?: readonly SqlValue[],
  ): Promise<T | null>;
  getAllAsync<T>(sql: string, parameters?: readonly SqlValue[]): Promise<T[]>;
}

export interface OwnedFileStore {
  promoteTemporaryFile(
    sourceUri: string,
    destinationRelativePath: string,
  ): Promise<void>;
  deleteOwnedFile(relativePath: string): Promise<void>;
  listOwnedFiles(): Promise<string[]>;
  copyOwnedFile(
    sourceRelativePath: string,
    destinationRelativePath: string,
  ): Promise<void>;
  resolveOwnedFileUri(relativePath: string): string;
}

export async function inImmediateTransaction<T>(
  database: SqlDatabase,
  operation: () => Promise<T>,
): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE');
  try {
    const result = await operation();
    await database.execAsync('COMMIT');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }
}
