import {
  createVisibilityCalculationContextKey,
  type ObstructionVisibilitySummary,
} from '../astronomy/obstructionVisibility';
import type { VisibilityCalculationCacheRepository } from '../storage/visibilityCalculationCacheRepository';
import {
  calculateRankedTargetsProgressively,
  TargetListCalculationCancelledError,
  type RankedTargetCalculationInput,
  type RankedTargetCalculationOptions,
} from './rankedTargetCalculation';

/** Both discovery surfaces use the same cache context and bulk summary lifecycle. */
export async function calculateCachedRankedTargets(
  input: RankedTargetCalculationInput,
  persistentCache: VisibilityCalculationCacheRepository | undefined,
  options: RankedTargetCalculationOptions,
) {
  let contextKey: string | null = null;
  let summaryCache:
    ReadonlyMap<string, ObstructionVisibilitySummary> | undefined;
  if (persistentCache) {
    contextKey = createVisibilityCalculationContextKey({
      ...input,
      maskRevision: input.maskRevision
        ? {
            id: input.maskRevision.id,
            mask: input.maskRevision,
            panoramaRevisionId: input.maskRevision.panoramaRevisionId,
          }
        : null,
    });
    try {
      await persistentCache.activateContext(input.profileId, contextKey);
      summaryCache = await persistentCache.getSummaries(contextKey);
    } catch {
      // Derived-cache failure falls back to calculation without losing user data.
      summaryCache = undefined;
    }
  }
  if (options.signal?.aborted) throw new TargetListCalculationCancelledError();
  return calculateRankedTargetsProgressively(input, {
    ...options,
    summaryCache,
    onSummaryBatch:
      persistentCache && contextKey
        ? (entries) =>
            persistentCache.putSummaries(input.profileId, contextKey, entries)
        : undefined,
  });
}
