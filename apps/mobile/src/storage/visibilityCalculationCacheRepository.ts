import type { ObstructionVisibilitySummary } from '../astronomy/obstructionVisibility';
import type {
  SelectedTargetTrajectory,
  VisibilityInterval,
} from '../astronomy/trajectory';
import { inImmediateTransaction, type SqlDatabase } from './types';

export type VisibilitySummaryCacheEntry = Readonly<{
  summary: ObstructionVisibilitySummary;
  targetKey: string;
}>;

type CacheRow = Readonly<{
  result_json: string;
  target_key: string;
}>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isVisibilityInterval = (value: unknown): value is VisibilityInterval => {
  if (!value || typeof value !== 'object') return false;
  const interval = value as Partial<VisibilityInterval>;
  return (
    typeof interval.startTimestampUtc === 'string' &&
    typeof interval.endTimestampUtc === 'string' &&
    isFiniteNumber(interval.durationMilliseconds)
  );
};

const isVisibilitySummary = (
  value: unknown,
): value is ObstructionVisibilitySummary => {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Partial<ObstructionVisibilitySummary>;
  return (
    Array.isArray(summary.aboveHorizonIntervals) &&
    summary.aboveHorizonIntervals.every(isVisibilityInterval) &&
    Array.isArray(summary.visibilityIntervals) &&
    summary.visibilityIntervals.every(isVisibilityInterval) &&
    isFiniteNumber(summary.totalAboveHorizonMilliseconds) &&
    isFiniteNumber(summary.totalVisibleMilliseconds)
  );
};

const isSelectedTargetTrajectory = (
  value: unknown,
): value is SelectedTargetTrajectory => {
  if (!isVisibilitySummary(value)) return false;
  const trajectory = value as Partial<SelectedTargetTrajectory>;
  return (
    Array.isArray(trajectory.samples) &&
    Array.isArray(trajectory.markers) &&
    Array.isArray(trajectory.blockedIntervals) &&
    trajectory.blockedIntervals.every(isVisibilityInterval) &&
    Array.isArray(trajectory.transitions)
  );
};

const summaryFromTrajectory = (
  trajectory: SelectedTargetTrajectory,
): ObstructionVisibilitySummary => ({
  aboveHorizonIntervals: trajectory.aboveHorizonIntervals,
  visibilityIntervals: trajectory.visibilityIntervals,
  totalAboveHorizonMilliseconds: trajectory.totalAboveHorizonMilliseconds,
  totalVisibleMilliseconds: trajectory.totalVisibleMilliseconds,
});

export class VisibilityCalculationCacheRepository {
  private readonly database: SqlDatabase;
  private readonly summaryCapacity: number;
  private readonly trajectoryCapacity: number;

  constructor(
    database: SqlDatabase,
    capacities: Readonly<{
      summaryCapacity?: number;
      trajectoryCapacity?: number;
    }> = {},
  ) {
    this.database = database;
    this.summaryCapacity = capacities.summaryCapacity ?? 20_000;
    this.trajectoryCapacity = capacities.trajectoryCapacity ?? 64;
    if (
      !Number.isInteger(this.summaryCapacity) ||
      this.summaryCapacity < 1 ||
      !Number.isInteger(this.trajectoryCapacity) ||
      this.trajectoryCapacity < 1
    ) {
      throw new RangeError(
        'Visibility cache capacities must be positive integers.',
      );
    }
  }

  async activateContext(profileId: string, contextKey: string): Promise<void> {
    await this.database.runAsync(
      `DELETE FROM visibility_calculation_cache
       WHERE profile_id = ? AND context_key <> ?`,
      [profileId, contextKey],
    );
  }

  async getTrajectory(
    contextKey: string,
    targetKey: string,
  ): Promise<SelectedTargetTrajectory | null> {
    const row = await this.database.getFirstAsync<CacheRow>(
      `SELECT target_key, result_json
       FROM visibility_calculation_cache
       WHERE context_key = ? AND target_key = ? AND result_kind = 'trajectory'`,
      [contextKey, targetKey],
    );
    if (!row) return null;
    try {
      const parsed: unknown = JSON.parse(row.result_json);
      if (!isSelectedTargetTrajectory(parsed))
        throw new TypeError('Invalid cache');
      await this.touch(contextKey, targetKey, 'trajectory');
      return parsed;
    } catch {
      await this.deleteEntry(contextKey, targetKey, 'trajectory');
      return null;
    }
  }

  async getSummaries(
    contextKey: string,
  ): Promise<ReadonlyMap<string, ObstructionVisibilitySummary>> {
    const rows = await this.database.getAllAsync<CacheRow>(
      `SELECT target_key, result_json
       FROM visibility_calculation_cache
       WHERE context_key = ? AND result_kind = 'summary'`,
      [contextKey],
    );
    const summaries = new Map<string, ObstructionVisibilitySummary>();
    const corruptTargetKeys: string[] = [];
    for (const row of rows) {
      try {
        const parsed: unknown = JSON.parse(row.result_json);
        if (!isVisibilitySummary(parsed)) throw new TypeError('Invalid cache');
        summaries.set(row.target_key, parsed);
      } catch {
        corruptTargetKeys.push(row.target_key);
      }
    }
    await this.database.runAsync(
      `UPDATE visibility_calculation_cache
       SET last_used_at_utc = ?
       WHERE context_key = ? AND result_kind = 'summary'`,
      [new Date().toISOString(), contextKey],
    );
    for (const targetKey of corruptTargetKeys) {
      await this.deleteEntry(contextKey, targetKey, 'summary');
    }
    return summaries;
  }

  async putTrajectory(
    profileId: string,
    contextKey: string,
    targetKey: string,
    trajectory: SelectedTargetTrajectory,
  ): Promise<void> {
    await inImmediateTransaction(this.database, async () => {
      await this.upsert(
        profileId,
        contextKey,
        targetKey,
        'trajectory',
        trajectory,
      );
      await this.upsert(
        profileId,
        contextKey,
        targetKey,
        'summary',
        summaryFromTrajectory(trajectory),
      );
      await this.prune('trajectory', this.trajectoryCapacity);
      await this.prune('summary', this.summaryCapacity);
    });
  }

  async putSummaries(
    profileId: string,
    contextKey: string,
    entries: readonly VisibilitySummaryCacheEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;
    await inImmediateTransaction(this.database, async () => {
      for (const { summary, targetKey } of entries) {
        await this.upsert(profileId, contextKey, targetKey, 'summary', summary);
      }
      await this.prune('summary', this.summaryCapacity);
    });
  }

  async invalidateProfile(profileId: string): Promise<void> {
    await this.database.runAsync(
      'DELETE FROM visibility_calculation_cache WHERE profile_id = ?',
      [profileId],
    );
  }

  private async upsert(
    profileId: string,
    contextKey: string,
    targetKey: string,
    resultKind: 'summary' | 'trajectory',
    result: ObstructionVisibilitySummary | SelectedTargetTrajectory,
  ): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO visibility_calculation_cache (
         profile_id, context_key, target_key, result_kind, result_json,
         last_used_at_utc
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(context_key, target_key, result_kind) DO UPDATE SET
         profile_id = excluded.profile_id,
         result_json = excluded.result_json,
         last_used_at_utc = excluded.last_used_at_utc`,
      [
        profileId,
        contextKey,
        targetKey,
        resultKind,
        JSON.stringify(result),
        new Date().toISOString(),
      ],
    );
  }

  private async prune(
    resultKind: 'summary' | 'trajectory',
    capacity: number,
  ): Promise<void> {
    await this.database.runAsync(
      `DELETE FROM visibility_calculation_cache
       WHERE result_kind = ? AND rowid NOT IN (
         SELECT rowid FROM visibility_calculation_cache
         WHERE result_kind = ?
         ORDER BY last_used_at_utc DESC, rowid DESC
         LIMIT ?
       )`,
      [resultKind, resultKind, capacity],
    );
  }

  private async touch(
    contextKey: string,
    targetKey: string,
    resultKind: 'summary' | 'trajectory',
  ): Promise<void> {
    await this.database.runAsync(
      `UPDATE visibility_calculation_cache SET last_used_at_utc = ?
       WHERE context_key = ? AND target_key = ? AND result_kind = ?`,
      [new Date().toISOString(), contextKey, targetKey, resultKind],
    );
  }

  private async deleteEntry(
    contextKey: string,
    targetKey: string,
    resultKind: 'summary' | 'trajectory',
  ): Promise<void> {
    await this.database.runAsync(
      `DELETE FROM visibility_calculation_cache
       WHERE context_key = ? AND target_key = ? AND result_kind = ?`,
      [contextKey, targetKey, resultKind],
    );
  }
}
