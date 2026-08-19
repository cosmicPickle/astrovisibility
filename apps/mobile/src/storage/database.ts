import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from './migrations';
import type { SqlDatabase, SqlRunResult, SqlValue } from './types';

class ExpoSqlDatabase implements SqlDatabase {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async execAsync(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  async runAsync(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<SqlRunResult> {
    const result = await this.database.runAsync(sql, [...parameters]);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  async getFirstAsync<T>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql, [...parameters]);
  }

  async getAllAsync<T>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, [...parameters]);
  }
}

export async function openAstrovisibilityDatabase(): Promise<SqlDatabase> {
  const database = new ExpoSqlDatabase(
    await openDatabaseAsync('astrovisibility.db'),
  );
  await migrateDatabase(database);
  return database;
}
