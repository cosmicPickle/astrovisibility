import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { createWindowHorizontalProjectorAtMilliseconds } from '../astronomy/horizontalCoordinates';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  createVisibilityCalculationCacheKey,
  selectedTrajectoryCache,
  VisibilityCalculationCancelledError,
  type ObstructionVisibilityInput,
  type VisibilityCalculationCache,
  type VisibilityCalculationOptions,
} from '../astronomy/obstructionVisibility';
import type {
  SelectedTargetTrajectory,
  VisibilityInterval,
} from '../astronomy/trajectory';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import {
  evaluateEquipmentSuitability,
  type EquipmentSuitability,
} from './equipmentSuitability';

export type RankedTarget = Readonly<{
  durationKind: 'visible' | 'aboveHorizonUnassessed';
  intervals: readonly VisibilityInterval[];
  longestIntervalMilliseconds: number;
  suitability: EquipmentSuitability | null;
  target: CatalogueTarget;
  totalDurationMilliseconds: number;
}>;

export type RankedTargetCalculationInput = Readonly<{
  equipment: EquipmentRecord | null;
  maskRevision: ActiveMaskRevision | null;
  observer: ObstructionVisibilityInput['observer'];
  panoramaRevisionId: string | null;
  profileId: string;
  targets: readonly CatalogueTarget[];
  timeZoneId: string;
  window: ObstructionVisibilityInput['window'];
}>;

export type RankedTargetProgress = Readonly<{
  complete: boolean;
  eligibleTargetCount: number;
  processedCount: number;
  rejectedByEquipmentCount: number;
  results: readonly RankedTarget[];
  totalCatalogueCount: number;
}>;

type CalculateVisibility = (
  input: ObstructionVisibilityInput,
  options?: VisibilityCalculationOptions,
) => Promise<SelectedTargetTrajectory>;

export type RankedTargetCalculationOptions = Readonly<{
  batchSize?: number;
  cache?: Pick<VisibilityCalculationCache, 'get' | 'set'>;
  calculateVisibility?: CalculateVisibility;
  onProgress?: (progress: RankedTargetProgress) => void;
  signal?: AbortSignal;
  yieldToEventLoop?: () => Promise<void>;
}>;

export class TargetListCalculationCancelledError extends Error {
  constructor() {
    super('Target-list calculation was cancelled.');
    this.name = 'TargetListCalculationCancelledError';
  }
}

const defaultYieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export function compareRankedTargets(
  left: RankedTarget,
  right: RankedTarget,
): number {
  const compareText = (leftText: string, rightText: string) =>
    leftText === rightText ? 0 : leftText < rightText ? -1 : 1;
  return (
    right.totalDurationMilliseconds - left.totalDurationMilliseconds ||
    right.longestIntervalMilliseconds - left.longestIntervalMilliseconds ||
    left.target.prominenceTier - right.target.prominenceTier ||
    compareText(left.target.preferredName, right.target.preferredName) ||
    compareText(left.target.id, right.target.id)
  );
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new TargetListCalculationCancelledError();
}

function toRankedTarget(
  target: CatalogueTarget,
  trajectory: Pick<
    SelectedTargetTrajectory,
    | 'aboveHorizonIntervals'
    | 'visibilityIntervals'
    | 'totalAboveHorizonMilliseconds'
    | 'totalVisibleMilliseconds'
  >,
  suitability: EquipmentSuitability | null,
  hasMask: boolean,
): RankedTarget | null {
  if (trajectory.totalAboveHorizonMilliseconds <= 0) return null;
  const intervals = hasMask
    ? trajectory.visibilityIntervals
    : trajectory.aboveHorizonIntervals;
  return {
    durationKind: hasMask ? 'visible' : 'aboveHorizonUnassessed',
    intervals,
    longestIntervalMilliseconds: intervals.reduce(
      (longest, interval) => Math.max(longest, interval.durationMilliseconds),
      0,
    ),
    suitability,
    target,
    totalDurationMilliseconds: hasMask
      ? trajectory.totalVisibleMilliseconds
      : trajectory.totalAboveHorizonMilliseconds,
  };
}

export async function calculateRankedTargetsProgressively(
  input: RankedTargetCalculationInput,
  options: RankedTargetCalculationOptions = {},
): Promise<RankedTarget[]> {
  const batchSize = options.batchSize ?? 256;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  const calculateVisibility =
    options.calculateVisibility ?? calculateObstructionAwareTrajectory;
  const cache = options.cache ?? selectedTrajectoryCache;
  const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
  const candidates = input.targets
    .map((target) => ({
      suitability: input.equipment
        ? evaluateEquipmentSuitability(target, input.equipment)
        : null,
      target,
    }))
    .filter(({ suitability }) => suitability?.eligible !== false);
  const rejectedByEquipmentCount = input.targets.length - candidates.length;
  const results: RankedTarget[] = [];
  let processedCount = 0;

  const publish = (complete: boolean) => {
    options.onProgress?.({
      complete,
      eligibleTargetCount: candidates.length,
      processedCount,
      rejectedByEquipmentCount,
      results: [...results].sort(compareRankedTargets),
      totalCatalogueCount: input.targets.length,
    });
  };

  for (const { suitability, target } of candidates) {
    throwIfCancelled(options.signal);
    const visibilityInput: ObstructionVisibilityInput = {
      profileId: input.profileId,
      target: {
        id: target.id,
        rightAscensionJ2000Hours: target.rightAscensionJ2000Hours,
        declinationJ2000Degrees: target.declinationJ2000Degrees,
      },
      observer: input.observer,
      timeZoneId: input.timeZoneId,
      window: input.window,
      panoramaRevisionId: input.panoramaRevisionId,
      maskRevision: input.maskRevision
        ? {
            id: input.maskRevision.id,
            panoramaRevisionId: input.maskRevision.panoramaRevisionId,
            mask: input.maskRevision,
          }
        : null,
    };
    const cacheKey = createVisibilityCalculationCacheKey(visibilityInput);
    let trajectory: Pick<
      SelectedTargetTrajectory,
      | 'aboveHorizonIntervals'
      | 'visibilityIntervals'
      | 'totalAboveHorizonMilliseconds'
      | 'totalVisibleMilliseconds'
    > | null = cache.get(cacheKey);
    if (!trajectory) {
      try {
        const projectAtMilliseconds =
          createWindowHorizontalProjectorAtMilliseconds({
            observer: input.observer,
            target: visibilityInput.target,
            window: input.window,
          });
        if (options.calculateVisibility === undefined) {
          trajectory = calculateObstructionVisibilitySummary(visibilityInput, {
            projectAtMilliseconds,
            signal: options.signal,
          });
        } else {
          const fullTrajectory = await calculateVisibility(visibilityInput, {
            projectAt: (timestampUtc) =>
              projectAtMilliseconds(Date.parse(timestampUtc)),
            signal: options.signal,
          });
          trajectory = fullTrajectory;
          cache.set(cacheKey, fullTrajectory);
        }
      } catch (error) {
        if (
          options.signal?.aborted ||
          error instanceof VisibilityCalculationCancelledError
        ) {
          throw new TargetListCalculationCancelledError();
        }
        throw error;
      }
      throwIfCancelled(options.signal);
    }
    const result = toRankedTarget(
      target,
      trajectory,
      suitability,
      input.maskRevision !== null,
    );
    if (result) results.push(result);
    processedCount += 1;
    if (processedCount % batchSize === 0) {
      publish(false);
      await yieldToEventLoop();
      throwIfCancelled(options.signal);
    }
  }
  publish(true);
  return results.sort(compareRankedTargets);
}
