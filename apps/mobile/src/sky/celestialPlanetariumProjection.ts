import {
  projectJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
  type UnitVector3,
} from '../astronomy/celestialTimeTransform';
import {
  projectUnitVectorToCanvas,
  type PlanetariumProjectionContext,
} from './planetariumProjection';

export const clampCelestialTimestampMilliseconds = (
  timeTransform: CelestialTimeTransform,
  timestampMilliseconds: number,
) => {
  'worklet';
  return Math.max(
    timeTransform.startTimestampMilliseconds,
    Math.min(timeTransform.endTimestampMilliseconds, timestampMilliseconds),
  );
};

export const projectJ2000UnitVectorToCanvas = (
  j2000UnitVector: UnitVector3,
  timeTransform: CelestialTimeTransform,
  timestampMilliseconds: number,
  projectionContext: PlanetariumProjectionContext,
) => {
  'worklet';
  const boundedTimestampMilliseconds = clampCelestialTimestampMilliseconds(
    timeTransform,
    timestampMilliseconds,
  );
  return projectUnitVectorToCanvas(
    projectJ2000ToObservedHorizontalVector(
      j2000UnitVector,
      timeTransform,
      boundedTimestampMilliseconds,
    ),
    projectionContext,
  );
};
