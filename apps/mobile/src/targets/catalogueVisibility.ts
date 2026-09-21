import { intersectTimeIntervals } from '../astronomy/astronomicalDarkness';
import {
  calculateObstructionVisibilitySummaryCooperatively,
  type ObstructionVisibilityInput,
  type ObstructionVisibilitySummary,
  type VisibilitySummaryCalculationOptions,
} from '../astronomy/obstructionVisibility';
import type { VisibilityInterval } from '../astronomy/trajectory';

/** Ranking only uses dark time. Establish horizon eligibility cheaply for the
 * whole window, then sample the original mask only while above it in darkness. */
export async function calculateCatalogueVisibility(
  input: ObstructionVisibilityInput,
  darknessIntervals: readonly VisibilityInterval[],
  options: Pick<
    VisibilitySummaryCalculationOptions,
    'projectAtMilliseconds' | 'signal'
  > & {
    yieldToEventLoop?: () => Promise<void>;
  },
): Promise<ObstructionVisibilitySummary> {
  const horizon = await calculateObstructionVisibilitySummaryCooperatively(
    { ...input, imagingFrame: null, maskRevision: null },
    options,
  );
  if (!input.maskRevision || horizon.totalAboveHorizonMilliseconds <= 0)
    return horizon;
  const visibilityIntervals: VisibilityInterval[] = [];
  for (const interval of intersectTimeIntervals(
    horizon.aboveHorizonIntervals,
    darknessIntervals,
  )) {
    const summary = await calculateObstructionVisibilitySummaryCooperatively(
      {
        ...input,
        window: {
          startTimestampUtc: interval.startTimestampUtc,
          endTimestampUtc: interval.endTimestampUtc,
        },
      },
      { ...options, approximateCentreSampling: true },
    );
    visibilityIntervals.push(...summary.visibilityIntervals);
  }
  return {
    ...horizon,
    visibilityIntervals,
    totalVisibleMilliseconds: visibilityIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
  };
}
