import type { VisibilityMask } from '../mask/visibilityMask';
import {
  classifyMaskDirection,
  maskSegmentMayCrossBoundary,
} from '../mask/visibilityMask';
import {
  equatorialJ2000ToHorizontal,
  type HorizontalCoordinates,
  type ObserverLocation,
} from './horizontalCoordinates';
import { localCivilDateTimeAtInstant } from './localCivilTime';
import {
  createThirtyMinuteMarkers,
  unwrapTrajectoryAzimuths,
  type EquatorialTarget,
  type SelectedTargetTrajectory,
  type TrajectoryAssessment,
  type TrajectoryMarker,
  type TrajectorySample,
  type VisibilityInterval,
  type VisibilityTransition,
} from './trajectory';

export const ASTRONOMY_ADAPTER_VERSION =
  'astronomy-engine-2.1.19-horizontal-adapter-v1';
export const VISIBILITY_CALCULATION_VERSION = 'obstruction-visibility-v1';

const COARSE_STEP_MILLISECONDS = 5 * 60 * 1000;
// The all-target summary path may start coarser because every segment whose
// endpoints change classification or whose angular bounds can meet a mask
// boundary is still refined to the same 30-second/0.05-degree tolerances. This
// avoids performing three times as many mask classifications far from any
// boundary while preserving the authoritative selected-target trajectory.
const SUMMARY_COARSE_STEP_MILLISECONDS = 15 * 60 * 1000;
const TRANSITION_TOLERANCE_MILLISECONDS = 30 * 1000;
const SPATIAL_TOLERANCE_DEGREES = 0.05;
const MAXIMUM_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAXIMUM_REFINED_SAMPLES = 100_000;
const DEFAULT_YIELD_EVERY_SAMPLES = 128;

export type ObstructionVisibilityInput = Readonly<{
  profileId: string;
  target: EquatorialTarget & { id: string };
  observer: ObserverLocation;
  timeZoneId: string;
  window: Readonly<{
    startTimestampUtc: string;
    endTimestampUtc: string;
  }>;
  panoramaRevisionId: string | null;
  maskRevision: Readonly<{
    id: string;
    panoramaRevisionId: string;
    mask: VisibilityMask;
  }> | null;
}>;

type ProjectionFunction = (timestampUtc: string) => HorizontalCoordinates;

export type VisibilityCalculationOptions = Readonly<{
  projectAt?: ProjectionFunction;
  signal?: AbortSignal;
  yieldEverySamples?: number;
  yieldToEventLoop?: () => Promise<void>;
}>;

export type ObstructionVisibilitySummary = Readonly<{
  aboveHorizonIntervals: readonly VisibilityInterval[];
  visibilityIntervals: readonly VisibilityInterval[];
  totalAboveHorizonMilliseconds: number;
  totalVisibleMilliseconds: number;
}>;

export type VisibilitySummaryCalculationOptions = Readonly<{
  projectAt?: ProjectionFunction;
  projectAtMilliseconds?: (
    timestampMilliseconds: number,
  ) => HorizontalCoordinates;
  signal?: AbortSignal;
}>;

type EvaluatedSample = HorizontalCoordinates & {
  timestampMilliseconds: number;
  assessment: TrajectoryAssessment;
};

type AssessmentRun = {
  assessment: TrajectoryAssessment;
  startMilliseconds: number;
  endMilliseconds: number;
};

export class VisibilityCalculationCancelledError extends Error {
  constructor() {
    super('Visibility calculation was cancelled.');
    this.name = 'VisibilityCalculationCancelledError';
  }
}

function parseWindow(window: ObstructionVisibilityInput['window']) {
  const startMilliseconds = Date.parse(window.startTimestampUtc);
  const endMilliseconds = Date.parse(window.endTimestampUtc);
  const durationMilliseconds = endMilliseconds - startMilliseconds;
  if (
    !window.startTimestampUtc.endsWith('Z') ||
    !window.endTimestampUtc.endsWith('Z') ||
    Number.isNaN(startMilliseconds) ||
    Number.isNaN(endMilliseconds)
  ) {
    throw new TypeError('Observing window must contain valid UTC instants.');
  }
  if (
    durationMilliseconds <= 0 ||
    durationMilliseconds > MAXIMUM_WINDOW_MILLISECONDS
  ) {
    throw new RangeError(
      'Observing window must be greater than 0 and at most 24 hours.',
    );
  }
  return { startMilliseconds, endMilliseconds };
}

function classifyCoordinates(
  horizontal: HorizontalCoordinates,
  mask: VisibilityMask | null,
): TrajectoryAssessment {
  if (horizontal.refractedAltitudeDegrees < 0) return 'belowHorizon';
  if (!mask) return 'unassessed';
  return classifyMaskDirection(mask, {
    altitudeDegrees: horizontal.refractedAltitudeDegrees,
    azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
  });
}

function sphericalSeparationDegrees(
  left: HorizontalCoordinates,
  right: HorizontalCoordinates,
): number {
  const toRadians = Math.PI / 180;
  const leftAltitude = left.refractedAltitudeDegrees * toRadians;
  const rightAltitude = right.refractedAltitudeDegrees * toRadians;
  const azimuthDelta =
    (right.azimuthDegreesClockwiseFromNorth -
      left.azimuthDegreesClockwiseFromNorth) *
    toRadians;
  const cosine =
    Math.sin(leftAltitude) * Math.sin(rightAltitude) +
    Math.cos(leftAltitude) * Math.cos(rightAltitude) * Math.cos(azimuthDelta);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) / Math.PI) * 180;
}

const createSpatialRefinementPredicate = (mask: VisibilityMask | null) =>
  mask
    ? (left: EvaluatedSample, right: EvaluatedSample) =>
        maskSegmentMayCrossBoundary(
          mask,
          {
            azimuthDegrees: left.azimuthDegreesClockwiseFromNorth,
            altitudeDegrees: left.refractedAltitudeDegrees,
          },
          {
            azimuthDegrees: right.azimuthDegreesClockwiseFromNorth,
            altitudeDegrees: right.refractedAltitudeDegrees,
          },
        )
    : () => false;

const defaultYieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

function createEvaluator(
  input: ObstructionVisibilityInput,
  options: VisibilityCalculationOptions,
) {
  const projectAt =
    options.projectAt ??
    ((timestampUtc: string) =>
      equatorialJ2000ToHorizontal({
        ...input.target,
        observer: input.observer,
        timestampUtc,
      }));
  const mask = input.maskRevision?.mask ?? null;
  const yieldEverySamples =
    options.yieldEverySamples ?? DEFAULT_YIELD_EVERY_SAMPLES;
  if (!Number.isInteger(yieldEverySamples) || yieldEverySamples < 1) {
    throw new RangeError('yieldEverySamples must be a positive integer.');
  }
  const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
  let evaluationCount = 0;

  const throwIfCancelled = () => {
    if (options.signal?.aborted) {
      throw new VisibilityCalculationCancelledError();
    }
  };
  const evaluate = async (
    timestampMilliseconds: number,
  ): Promise<EvaluatedSample> => {
    throwIfCancelled();
    const horizontal = projectAt(new Date(timestampMilliseconds).toISOString());
    evaluationCount += 1;
    if (evaluationCount > MAXIMUM_REFINED_SAMPLES) {
      throw new RangeError(
        `Visibility calculation exceeds the ${MAXIMUM_REFINED_SAMPLES} sample limit.`,
      );
    }
    if (evaluationCount % yieldEverySamples === 0) {
      await yieldToEventLoop();
      throwIfCancelled();
    }
    return {
      ...horizontal,
      timestampMilliseconds,
      assessment: classifyCoordinates(horizontal, mask),
    };
  };
  return { evaluate, throwIfCancelled };
}

async function refineSegment(
  left: EvaluatedSample,
  right: EvaluatedSample,
  evaluate: (timestampMilliseconds: number) => Promise<EvaluatedSample>,
  shouldRefineSpatially: (
    left: EvaluatedSample,
    right: EvaluatedSample,
  ) => boolean,
): Promise<EvaluatedSample[]> {
  const durationMilliseconds =
    right.timestampMilliseconds - left.timestampMilliseconds;
  const classificationChanged = left.assessment !== right.assessment;
  const needsTemporalRefinement =
    classificationChanged &&
    durationMilliseconds > TRANSITION_TOLERANCE_MILLISECONDS;
  const needsMaskRefinement =
    shouldRefineSpatially(left, right) &&
    (durationMilliseconds > TRANSITION_TOLERANCE_MILLISECONDS ||
      sphericalSeparationDegrees(left, right) > SPATIAL_TOLERANCE_DEGREES);
  if (!needsTemporalRefinement && !needsMaskRefinement) return [right];
  const middleMilliseconds = Math.floor(
    (left.timestampMilliseconds + right.timestampMilliseconds) / 2,
  );
  if (
    middleMilliseconds <= left.timestampMilliseconds ||
    middleMilliseconds >= right.timestampMilliseconds
  ) {
    return [right];
  }
  const middle = await evaluate(middleMilliseconds);
  return [
    ...(await refineSegment(left, middle, evaluate, shouldRefineSpatially)),
    ...(await refineSegment(middle, right, evaluate, shouldRefineSpatially)),
  ];
}

function refineSegmentSynchronously(
  left: EvaluatedSample,
  right: EvaluatedSample,
  evaluate: (timestampMilliseconds: number) => EvaluatedSample,
  shouldRefineSpatially: (
    left: EvaluatedSample,
    right: EvaluatedSample,
  ) => boolean,
): EvaluatedSample[] {
  const durationMilliseconds =
    right.timestampMilliseconds - left.timestampMilliseconds;
  const classificationChanged = left.assessment !== right.assessment;
  const needsTemporalRefinement =
    classificationChanged &&
    durationMilliseconds > TRANSITION_TOLERANCE_MILLISECONDS;
  const needsMaskRefinement =
    shouldRefineSpatially(left, right) &&
    (durationMilliseconds > TRANSITION_TOLERANCE_MILLISECONDS ||
      sphericalSeparationDegrees(left, right) > SPATIAL_TOLERANCE_DEGREES);
  if (!needsTemporalRefinement && !needsMaskRefinement) return [right];
  const middleMilliseconds = Math.floor(
    (left.timestampMilliseconds + right.timestampMilliseconds) / 2,
  );
  if (
    middleMilliseconds <= left.timestampMilliseconds ||
    middleMilliseconds >= right.timestampMilliseconds
  ) {
    return [right];
  }
  const middle = evaluate(middleMilliseconds);
  return [
    ...refineSegmentSynchronously(
      left,
      middle,
      evaluate,
      shouldRefineSpatially,
    ),
    ...refineSegmentSynchronously(
      middle,
      right,
      evaluate,
      shouldRefineSpatially,
    ),
  ];
}

function createRuns(
  samples: readonly EvaluatedSample[],
  startMilliseconds: number,
  endMilliseconds: number,
): AssessmentRun[] {
  const runs: AssessmentRun[] = [];
  let assessment = samples[0]!.assessment;
  let runStart = startMilliseconds;
  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]!;
    if (sample.assessment === assessment) continue;
    runs.push({
      assessment,
      startMilliseconds: runStart,
      endMilliseconds: sample.timestampMilliseconds,
    });
    assessment = sample.assessment;
    runStart = sample.timestampMilliseconds;
  }
  runs.push({
    assessment,
    startMilliseconds: runStart,
    endMilliseconds,
  });
  return runs;
}

function mergeNumericalFlicker(runs: readonly AssessmentRun[]) {
  const merged = runs.map((run) => ({ ...run }));
  let index = 1;
  while (index < merged.length - 1) {
    const previous = merged[index - 1]!;
    const current = merged[index]!;
    const next = merged[index + 1]!;
    const currentDuration = current.endMilliseconds - current.startMilliseconds;
    const obstructionStates =
      (current.assessment === 'visible' || current.assessment === 'blocked') &&
      (previous.assessment === 'visible' || previous.assessment === 'blocked');
    if (
      obstructionStates &&
      previous.assessment === next.assessment &&
      currentDuration < TRANSITION_TOLERANCE_MILLISECONDS
    ) {
      previous.endMilliseconds = next.endMilliseconds;
      merged.splice(index, 2);
      if (index > 1) index -= 1;
      continue;
    }
    index += 1;
  }
  return merged;
}

function intervalForRun(run: AssessmentRun): VisibilityInterval {
  return {
    startTimestampUtc: new Date(run.startMilliseconds).toISOString(),
    endTimestampUtc: new Date(run.endMilliseconds).toISOString(),
    durationMilliseconds: run.endMilliseconds - run.startMilliseconds,
  };
}

function mergeAboveHorizonRuns(runs: readonly AssessmentRun[]) {
  const intervals: VisibilityInterval[] = [];
  for (const run of runs) {
    if (run.assessment === 'belowHorizon' || run.assessment === 'unassessed') {
      if (run.assessment === 'unassessed') {
        const previous = intervals.at(-1);
        if (
          previous?.endTimestampUtc ===
          new Date(run.startMilliseconds).toISOString()
        ) {
          previous.endTimestampUtc = new Date(
            run.endMilliseconds,
          ).toISOString();
          previous.durationMilliseconds +=
            run.endMilliseconds - run.startMilliseconds;
        } else {
          intervals.push(intervalForRun(run));
        }
      }
      continue;
    }
    const previous = intervals.at(-1);
    if (
      previous?.endTimestampUtc ===
      new Date(run.startMilliseconds).toISOString()
    ) {
      previous.endTimestampUtc = new Date(run.endMilliseconds).toISOString();
      previous.durationMilliseconds +=
        run.endMilliseconds - run.startMilliseconds;
    } else {
      intervals.push(intervalForRun(run));
    }
  }
  return intervals;
}

function roundedLocalTimeLabel(
  timestampMilliseconds: number,
  timeZoneId: string,
) {
  const roundedTimestampUtc = new Date(
    Math.round(timestampMilliseconds / 60_000) * 60_000,
  ).toISOString();
  const local = localCivilDateTimeAtInstant(roundedTimestampUtc, timeZoneId);
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}

function createTransitions(
  runs: readonly AssessmentRun[],
  samples: readonly EvaluatedSample[],
  timeZoneId: string,
): VisibilityTransition[] {
  const transitions: VisibilityTransition[] = [];
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1]!;
    const current = runs[index]!;
    if (!(
      (previous.assessment === 'visible' && current.assessment === 'blocked') ||
      (previous.assessment === 'blocked' && current.assessment === 'visible')
    )) {
      continue;
    }
    const timestampMilliseconds = current.startMilliseconds;
    const coordinates =
      samples.find(
        (sample) => sample.timestampMilliseconds === timestampMilliseconds,
      ) ??
      samples.reduce((closest, sample) =>
        Math.abs(sample.timestampMilliseconds - timestampMilliseconds) <
        Math.abs(closest.timestampMilliseconds - timestampMilliseconds)
          ? sample
          : closest,
      );
    const localTimeLabel = roundedLocalTimeLabel(
      timestampMilliseconds,
      timeZoneId,
    );
    const kind =
      current.assessment === 'visible' ? 'becameVisible' : 'becameBlocked';
    transitions.push({
      azimuthDegreesClockwiseFromNorth:
        coordinates.azimuthDegreesClockwiseFromNorth,
      refractedAltitudeDegrees: coordinates.refractedAltitudeDegrees,
      timestampUtc: new Date(timestampMilliseconds).toISOString(),
      localTimeLabel,
      displayLabel:
        kind === 'becameVisible'
          ? `Visible after ${localTimeLabel}`
          : `Visible until ${localTimeLabel}`,
      kind,
    });
  }
  return transitions;
}

function normalizeSamplesToRuns(
  samples: readonly EvaluatedSample[],
  runs: readonly AssessmentRun[],
): TrajectorySample[] {
  const unwrappedAzimuths = unwrapTrajectoryAzimuths(
    samples.map(
      ({ azimuthDegreesClockwiseFromNorth }) =>
        azimuthDegreesClockwiseFromNorth,
    ),
  );
  let runIndex = 0;
  return samples.map((sample, index) => {
    while (
      runIndex < runs.length - 1 &&
      sample.timestampMilliseconds >= runs[runIndex]!.endMilliseconds
    ) {
      runIndex += 1;
    }
    return {
      azimuthDegreesClockwiseFromNorth: sample.azimuthDegreesClockwiseFromNorth,
      refractedAltitudeDegrees: sample.refractedAltitudeDegrees,
      timestampUtc: new Date(sample.timestampMilliseconds).toISOString(),
      unwrappedAzimuthDegrees: unwrappedAzimuths[index]!,
      assessment: runs[runIndex]!.assessment,
    };
  });
}

export async function calculateObstructionAwareTrajectory(
  input: ObstructionVisibilityInput,
  options: VisibilityCalculationOptions = {},
): Promise<SelectedTargetTrajectory> {
  const { startMilliseconds, endMilliseconds } = parseWindow(input.window);
  if (
    input.maskRevision &&
    input.maskRevision.panoramaRevisionId !== input.panoramaRevisionId
  ) {
    throw new Error(
      'The visibility mask is not aligned to the active panorama.',
    );
  }
  const { evaluate, throwIfCancelled } = createEvaluator(input, options);
  const shouldRefineSpatially = input.maskRevision ? () => true : () => false;
  const coarseMilliseconds: number[] = [];
  for (
    let timestampMilliseconds = startMilliseconds;
    timestampMilliseconds < endMilliseconds;
    timestampMilliseconds += COARSE_STEP_MILLISECONDS
  ) {
    coarseMilliseconds.push(timestampMilliseconds);
  }
  coarseMilliseconds.push(endMilliseconds);
  const coarseSamples: EvaluatedSample[] = [];
  for (const timestampMilliseconds of coarseMilliseconds) {
    coarseSamples.push(await evaluate(timestampMilliseconds));
  }
  const refinedSamples: EvaluatedSample[] = [coarseSamples[0]!];
  for (let index = 1; index < coarseSamples.length; index += 1) {
    refinedSamples.push(
      ...(await refineSegment(
        coarseSamples[index - 1]!,
        coarseSamples[index]!,
        evaluate,
        shouldRefineSpatially,
      )),
    );
  }
  throwIfCancelled();
  const runs = mergeNumericalFlicker(
    createRuns(refinedSamples, startMilliseconds, endMilliseconds),
  );
  const samples = normalizeSamplesToRuns(refinedSamples, runs);
  const visibilityIntervals = runs
    .filter(({ assessment }) => assessment === 'visible')
    .map(intervalForRun);
  const blockedIntervals = runs
    .filter(({ assessment }) => assessment === 'blocked')
    .map(intervalForRun);
  const aboveHorizonIntervals = mergeAboveHorizonRuns(runs);
  const markerCoordinates = await Promise.all(
    createThirtyMinuteMarkers({
      ...input.window,
      timeZoneId: input.timeZoneId,
    }).map(async (marker): Promise<TrajectoryMarker> => {
      const sample = await evaluate(Date.parse(marker.timestampUtc));
      return {
        ...marker,
        azimuthDegreesClockwiseFromNorth:
          sample.azimuthDegreesClockwiseFromNorth,
        refractedAltitudeDegrees: sample.refractedAltitudeDegrees,
        assessment: sample.assessment,
      };
    }),
  );
  throwIfCancelled();
  return {
    samples,
    markers: markerCoordinates,
    aboveHorizonIntervals,
    visibilityIntervals,
    blockedIntervals,
    transitions: createTransitions(runs, refinedSamples, input.timeZoneId),
    totalAboveHorizonMilliseconds: aboveHorizonIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
    totalVisibleMilliseconds: visibilityIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
  };
}

/**
 * Computes the exact Stage 7 interval contract without allocating render
 * samples, markers, or transitions. Stage 8 runs this synchronously per target
 * and yields between bounded target batches, avoiding millions of Promise
 * continuations while preserving the same temporal/spatial refinement rules.
 */
export function calculateObstructionVisibilitySummary(
  input: ObstructionVisibilityInput,
  options: VisibilitySummaryCalculationOptions = {},
): ObstructionVisibilitySummary {
  const { startMilliseconds, endMilliseconds } = parseWindow(input.window);
  if (
    input.maskRevision &&
    input.maskRevision.panoramaRevisionId !== input.panoramaRevisionId
  ) {
    throw new Error(
      'The visibility mask is not aligned to the active panorama.',
    );
  }
  const projectAt =
    options.projectAt ??
    ((timestampUtc: string) =>
      equatorialJ2000ToHorizontal({
        ...input.target,
        observer: input.observer,
        timestampUtc,
      }));
  const mask = input.maskRevision?.mask ?? null;
  const shouldRefineSpatially = createSpatialRefinementPredicate(mask);
  let evaluationCount = 0;
  const evaluate = (timestampMilliseconds: number): EvaluatedSample => {
    if (options.signal?.aborted) {
      throw new VisibilityCalculationCancelledError();
    }
    evaluationCount += 1;
    if (evaluationCount > MAXIMUM_REFINED_SAMPLES) {
      throw new RangeError(
        `Visibility calculation exceeds the ${MAXIMUM_REFINED_SAMPLES} sample limit.`,
      );
    }
    const horizontal = options.projectAtMilliseconds
      ? options.projectAtMilliseconds(timestampMilliseconds)
      : projectAt(new Date(timestampMilliseconds).toISOString());
    return {
      ...horizontal,
      timestampMilliseconds,
      assessment: classifyCoordinates(horizontal, mask),
    };
  };
  const coarseSamples: EvaluatedSample[] = [];
  for (
    let timestampMilliseconds = startMilliseconds;
    timestampMilliseconds < endMilliseconds;
    timestampMilliseconds += SUMMARY_COARSE_STEP_MILLISECONDS
  ) {
    coarseSamples.push(evaluate(timestampMilliseconds));
  }
  coarseSamples.push(evaluate(endMilliseconds));
  const refinedSamples: EvaluatedSample[] = [coarseSamples[0]!];
  for (let index = 1; index < coarseSamples.length; index += 1) {
    refinedSamples.push(
      ...refineSegmentSynchronously(
        coarseSamples[index - 1]!,
        coarseSamples[index]!,
        evaluate,
        shouldRefineSpatially,
      ),
    );
  }
  const runs = mergeNumericalFlicker(
    createRuns(refinedSamples, startMilliseconds, endMilliseconds),
  );
  const visibilityIntervals = runs
    .filter(({ assessment }) => assessment === 'visible')
    .map(intervalForRun);
  const aboveHorizonIntervals = mergeAboveHorizonRuns(runs);
  return {
    aboveHorizonIntervals,
    visibilityIntervals,
    totalAboveHorizonMilliseconds: aboveHorizonIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
    totalVisibleMilliseconds: visibilityIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
  };
}

export function createVisibilityCalculationCacheKey(
  input: ObstructionVisibilityInput,
): string {
  return `profile=${encodeURIComponent(input.profileId)};${JSON.stringify({
    astronomyAdapterVersion: ASTRONOMY_ADAPTER_VERSION,
    calculationVersion: VISIBILITY_CALCULATION_VERSION,
    observer: {
      latitudeDegreesNorth: input.observer.latitudeDegreesNorth,
      longitudeDegreesEast: input.observer.longitudeDegreesEast,
      elevationMetersAboveMeanSeaLevel:
        input.observer.elevationMetersAboveMeanSeaLevel,
    },
    timeZoneId: input.timeZoneId,
    window: {
      startTimestampUtc: input.window.startTimestampUtc,
      endTimestampUtc: input.window.endTimestampUtc,
    },
    target: {
      id: input.target.id,
      rightAscensionJ2000Hours: input.target.rightAscensionJ2000Hours,
      declinationJ2000Degrees: input.target.declinationJ2000Degrees,
    },
    panoramaRevisionId: input.panoramaRevisionId,
    maskRevisionId: input.maskRevision?.id ?? null,
    maskPanoramaRevisionId: input.maskRevision?.panoramaRevisionId ?? null,
  })}`;
}

export class VisibilityCalculationCache {
  private readonly entries = new Map<string, SelectedTargetTrajectory>();
  private readonly capacity: number;

  constructor(capacity = 24) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Visibility cache capacity must be positive.');
    }
    this.capacity = capacity;
  }

  get size() {
    return this.entries.size;
  }

  get(key: string): SelectedTargetTrajectory | null {
    const value = this.entries.get(key);
    if (!value) return null;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: SelectedTargetTrajectory): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  invalidateProfile(profileId: string): void {
    const prefix = `profile=${encodeURIComponent(profileId)};`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

export const selectedTrajectoryCache = new VisibilityCalculationCache();
