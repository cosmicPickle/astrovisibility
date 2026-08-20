import {
  equatorialJ2000ToHorizontal,
  type HorizontalCoordinates,
  type ObserverLocation,
} from './horizontalCoordinates';
import {
  addDaysToLocalDate,
  localCivilDateTimeAtInstant,
  resolveLocalCivilDateTime,
} from './localCivilTime';

export type TrajectoryAssessment =
  'belowHorizon' | 'unassessed' | 'visible' | 'blocked';
export type NoMaskAssessment = Extract<
  TrajectoryAssessment,
  'belowHorizon' | 'unassessed'
>;

export interface EquatorialTarget {
  rightAscensionJ2000Hours: number;
  declinationJ2000Degrees: number;
}

export interface TrajectorySample extends HorizontalCoordinates {
  timestampUtc: string;
  unwrappedAzimuthDegrees: number;
  assessment: TrajectoryAssessment;
}

export interface AboveHorizonInterval {
  startTimestampUtc: string;
  endTimestampUtc: string;
  durationMilliseconds: number;
}

export interface ThirtyMinuteMarker {
  timestampUtc: string;
  localTimeLabel: string;
}

export interface TrajectoryMarker
  extends ThirtyMinuteMarker, HorizontalCoordinates {
  assessment: TrajectoryAssessment;
}

export type VisibilityInterval = AboveHorizonInterval;

export interface VisibilityTransition extends HorizontalCoordinates {
  timestampUtc: string;
  localTimeLabel: string;
  displayLabel: string;
  kind: 'becameBlocked' | 'becameVisible';
}

export interface SelectedTargetTrajectory {
  samples: readonly TrajectorySample[];
  markers: readonly TrajectoryMarker[];
  aboveHorizonIntervals: readonly AboveHorizonInterval[];
  visibilityIntervals: readonly VisibilityInterval[];
  blockedIntervals: readonly VisibilityInterval[];
  transitions: readonly VisibilityTransition[];
  totalAboveHorizonMilliseconds: number;
  totalVisibleMilliseconds: number;
}

// Rendering samples are actual evaluated instants, not great-circle
// interpolation between the five-minute visibility-classification samples.
// One minute bounds a sidereal track step to about 0.25 degrees.
const RENDER_SAMPLE_MILLISECONDS = 60 * 1000;
const TRANSITION_TOLERANCE_MILLISECONDS = 30 * 1000;
const MAXIMUM_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1000;

const parseWindow = (window: {
  startTimestampUtc: string;
  endTimestampUtc: string;
}) => {
  const startMilliseconds = Date.parse(window.startTimestampUtc);
  const endMilliseconds = Date.parse(window.endTimestampUtc);
  if (
    !window.startTimestampUtc.endsWith('Z') ||
    !window.endTimestampUtc.endsWith('Z') ||
    Number.isNaN(startMilliseconds) ||
    Number.isNaN(endMilliseconds)
  ) {
    throw new TypeError('Observing window must contain valid UTC instants');
  }
  const durationMilliseconds = endMilliseconds - startMilliseconds;
  if (
    durationMilliseconds <= 0 ||
    durationMilliseconds > MAXIMUM_WINDOW_MILLISECONDS
  ) {
    throw new RangeError(
      'Observing window must be greater than 0 and at most 24 hours',
    );
  }
  return { startMilliseconds, endMilliseconds };
};

export const unwrapTrajectoryAzimuths = (
  azimuthsDegrees: readonly number[],
): number[] => {
  const result: number[] = [];
  for (const azimuthDegrees of azimuthsDegrees) {
    if (!Number.isFinite(azimuthDegrees)) {
      throw new RangeError('azimuthDegrees must be finite');
    }
    const normalized = ((azimuthDegrees % 360) + 360) % 360;
    const previous = result[result.length - 1];
    result.push(
      previous === undefined
        ? normalized
        : normalized + Math.round((previous - normalized) / 360) * 360,
    );
  }
  return result;
};

const formatLocalTimeLabel = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export const createThirtyMinuteMarkers = (input: {
  startTimestampUtc: string;
  endTimestampUtc: string;
  timeZoneId: string;
}): ThirtyMinuteMarker[] => {
  const { startMilliseconds, endMilliseconds } = parseWindow(input);
  const firstLocal = localCivilDateTimeAtInstant(
    input.startTimestampUtc,
    input.timeZoneId,
  );
  const lastLocal = localCivilDateTimeAtInstant(
    input.endTimestampUtc,
    input.timeZoneId,
  );
  const firstDate = addDaysToLocalDate(firstLocal, -1);
  const lastDate = addDaysToLocalDate(lastLocal, 1);
  const dateCount =
    Math.round(
      (Date.UTC(lastDate.year, lastDate.month - 1, lastDate.day) -
        Date.UTC(firstDate.year, firstDate.month - 1, firstDate.day)) /
        (24 * 60 * 60 * 1000),
    ) + 1;
  const candidates: ThirtyMinuteMarker[] = [];
  for (let dayOffset = 0; dayOffset < dateCount; dayOffset += 1) {
    const localDate = addDaysToLocalDate(firstDate, dayOffset);
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 30] as const) {
        const resolution = resolveLocalCivilDateTime(
          { ...localDate, hour, minute },
          input.timeZoneId,
        );
        const timestamps =
          resolution.kind === 'gap'
            ? []
            : resolution.kind === 'unique'
              ? [resolution.timestampUtc]
              : [resolution.earlierTimestampUtc, resolution.laterTimestampUtc];
        for (const timestampUtc of timestamps) {
          const timestampMilliseconds = Date.parse(timestampUtc);
          if (
            timestampMilliseconds >= startMilliseconds &&
            timestampMilliseconds <= endMilliseconds
          ) {
            candidates.push({
              timestampUtc,
              localTimeLabel: formatLocalTimeLabel(hour, minute),
            });
          }
        }
      }
    }
  }
  return candidates
    .sort(
      (left, right) =>
        Date.parse(left.timestampUtc) - Date.parse(right.timestampUtc),
    )
    .filter(
      (marker, index, all) =>
        index === 0 || marker.timestampUtc !== all[index - 1]!.timestampUtc,
    );
};

const assessmentFor = (horizontal: HorizontalCoordinates): NoMaskAssessment =>
  horizontal.refractedAltitudeDegrees < 0 ? 'belowHorizon' : 'unassessed';

export const createSelectedTargetTrajectory = (input: {
  target: EquatorialTarget;
  observer: ObserverLocation;
  projectAt?: (timestampUtc: string) => HorizontalCoordinates;
  timeZoneId: string;
  window: { startTimestampUtc: string; endTimestampUtc: string };
}): SelectedTargetTrajectory => {
  const { startMilliseconds, endMilliseconds } = parseWindow(input.window);
  const projectAt = (timestampMilliseconds: number) => {
    const timestampUtc = new Date(timestampMilliseconds).toISOString();
    return input.projectAt
      ? input.projectAt(timestampUtc)
      : equatorialJ2000ToHorizontal({
          ...input.target,
          observer: input.observer,
          timestampUtc,
        });
  };
  const sampleMilliseconds: number[] = [];
  for (
    let timestampMilliseconds = startMilliseconds;
    timestampMilliseconds < endMilliseconds;
    timestampMilliseconds += RENDER_SAMPLE_MILLISECONDS
  ) {
    sampleMilliseconds.push(timestampMilliseconds);
  }
  sampleMilliseconds.push(endMilliseconds);
  const sampleCoordinates = sampleMilliseconds.map(projectAt);
  const unwrappedAzimuths = unwrapTrajectoryAzimuths(
    sampleCoordinates.map(
      (coordinates) => coordinates.azimuthDegreesClockwiseFromNorth,
    ),
  );
  const samples = sampleMilliseconds.map((timestampMilliseconds, index) => {
    const coordinates = sampleCoordinates[index]!;
    return {
      ...coordinates,
      timestampUtc: new Date(timestampMilliseconds).toISOString(),
      unwrappedAzimuthDegrees: unwrappedAzimuths[index]!,
      assessment: assessmentFor(coordinates),
    };
  });

  const aboveHorizonIntervals: AboveHorizonInterval[] = [];
  let intervalStartMilliseconds =
    samples[0]!.assessment === 'unassessed' ? startMilliseconds : null;
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1]!;
    const right = samples[index]!;
    if (left.assessment === right.assessment) continue;
    let lowerMilliseconds = Date.parse(left.timestampUtc);
    let upperMilliseconds = Date.parse(right.timestampUtc);
    const lowerAssessment = left.assessment;
    while (
      upperMilliseconds - lowerMilliseconds >
      TRANSITION_TOLERANCE_MILLISECONDS
    ) {
      const middleMilliseconds = Math.floor(
        (lowerMilliseconds + upperMilliseconds) / 2,
      );
      if (assessmentFor(projectAt(middleMilliseconds)) === lowerAssessment) {
        lowerMilliseconds = middleMilliseconds;
      } else {
        upperMilliseconds = middleMilliseconds;
      }
    }
    const transitionMilliseconds = upperMilliseconds;
    if (right.assessment === 'unassessed') {
      intervalStartMilliseconds = transitionMilliseconds;
    } else if (intervalStartMilliseconds !== null) {
      aboveHorizonIntervals.push({
        startTimestampUtc: new Date(intervalStartMilliseconds).toISOString(),
        endTimestampUtc: new Date(transitionMilliseconds).toISOString(),
        durationMilliseconds:
          transitionMilliseconds - intervalStartMilliseconds,
      });
      intervalStartMilliseconds = null;
    }
  }
  if (intervalStartMilliseconds !== null) {
    aboveHorizonIntervals.push({
      startTimestampUtc: new Date(intervalStartMilliseconds).toISOString(),
      endTimestampUtc: new Date(endMilliseconds).toISOString(),
      durationMilliseconds: endMilliseconds - intervalStartMilliseconds,
    });
  }

  const markers = createThirtyMinuteMarkers({
    ...input.window,
    timeZoneId: input.timeZoneId,
  }).map((marker) => {
    const coordinates = projectAt(Date.parse(marker.timestampUtc));
    return {
      ...marker,
      ...coordinates,
      assessment: assessmentFor(coordinates),
    };
  });

  return {
    samples,
    markers,
    aboveHorizonIntervals,
    visibilityIntervals: [],
    blockedIntervals: [],
    transitions: [],
    totalAboveHorizonMilliseconds: aboveHorizonIntervals.reduce(
      (total, interval) => total + interval.durationMilliseconds,
      0,
    ),
    totalVisibleMilliseconds: 0,
  };
};

const assessmentAtTimestamp = (
  samples: readonly TrajectorySample[],
  timestampMilliseconds: number,
): TrajectoryAssessment => {
  let lowerIndex = 0;
  let upperIndex = samples.length - 1;
  while (lowerIndex < upperIndex) {
    const middleIndex = Math.ceil((lowerIndex + upperIndex) / 2);
    if (
      Date.parse(samples[middleIndex]!.timestampUtc) <= timestampMilliseconds
    ) {
      lowerIndex = middleIndex;
    } else {
      upperIndex = middleIndex - 1;
    }
  }
  return samples[lowerIndex]?.assessment ?? 'unassessed';
};

/**
 * Applies asynchronous obstruction results to stable, exact-time render
 * geometry. Only true assessment-boundary samples are added, so classification
 * cannot replace the visible arc with a differently interpolated path.
 */
export const mergeTrajectoryAssessment = (
  base: SelectedTargetTrajectory,
  classified: SelectedTargetTrajectory,
): SelectedTargetTrajectory => {
  if (classified.samples.length === 0) return base;
  const samplesByTimestamp = new Map(
    base.samples.map((sample) => [sample.timestampUtc, sample]),
  );
  for (let index = 1; index < classified.samples.length; index += 1) {
    const previous = classified.samples[index - 1]!;
    const current = classified.samples[index]!;
    if (previous.assessment !== current.assessment) {
      samplesByTimestamp.set(previous.timestampUtc, previous);
      samplesByTimestamp.set(current.timestampUtc, current);
    }
  }
  const ordered = [...samplesByTimestamp.values()].sort(
    (left, right) =>
      Date.parse(left.timestampUtc) - Date.parse(right.timestampUtc),
  );
  const unwrappedAzimuths = unwrapTrajectoryAzimuths(
    ordered.map(
      ({ azimuthDegreesClockwiseFromNorth }) =>
        azimuthDegreesClockwiseFromNorth,
    ),
  );
  const samples = ordered.map((sample, index) => ({
    ...sample,
    assessment:
      sample.assessment === 'belowHorizon'
        ? 'belowHorizon'
        : assessmentAtTimestamp(
            classified.samples,
            Date.parse(sample.timestampUtc),
          ),
    unwrappedAzimuthDegrees: unwrappedAzimuths[index]!,
  }));
  return {
    ...classified,
    samples,
  };
};
