import { useEffect, useState } from 'react';
import type { VisibilityCalculationCacheRepository } from '../storage/visibilityCalculationCacheRepository';
import { calculateCachedRankedTargets } from './cachedRankedTargets';
import type {
  RankedTarget,
  RankedTargetCalculationInput,
} from './rankedTargetCalculation';

type CalculationState = Readonly<{
  attempt: number;
  input: RankedTargetCalculationInput | null;
  results: readonly RankedTarget[];
  status: 'idle' | 'calculating' | 'complete' | 'error';
  processedCount: number;
  totalCount: number;
}>;
const emptyState: CalculationState = {
  attempt: 0,
  input: null,
  results: [],
  status: 'idle',
  processedCount: 0,
  totalCount: 0,
};

/** Calculate once per observing context, independently of editable filter limits. */
export function useSkyTargetDurations(
  input: RankedTargetCalculationInput | null,
  cache: VisibilityCalculationCacheRepository | undefined,
  enabled: boolean,
) {
  const [state, setState] = useState<CalculationState>(emptyState);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !input) return;
    const controller = new AbortController();
    void calculateCachedRankedTargets(input, cache, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (controller.signal.aborted) return;
        setState({
          attempt,
          input,
          results: progress.results,
          status: progress.complete ? 'complete' : 'calculating',
          processedCount: progress.processedCount,
          totalCount: progress.eligibleTargetCount,
        });
      },
    }).then(
      (results) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            attempt,
            input,
            results,
            status: 'complete',
          }));
      },
      () => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...(current.input === input && current.attempt === attempt
              ? current
              : emptyState),
            input,
            attempt,
            status: 'error',
          }));
      },
    );
    return () => controller.abort();
  }, [attempt, cache, enabled, input]);
  let current = emptyState;
  if (enabled && input) {
    current =
      state.input === input && state.attempt === attempt
        ? state
        : { ...emptyState, input, attempt, status: 'calculating' };
  }
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
