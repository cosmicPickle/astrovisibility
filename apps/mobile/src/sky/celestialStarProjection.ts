import {
  createCelestialObservedFrame,
  projectPreparedJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
} from '../astronomy/celestialTimeTransform';
import type { RegisteredCelestialStarBatch } from './celestialSkyGeometry';
import {
  createPlanetariumProjectionContext,
  projectUnitVectorToCanvas,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { CanvasSizePixels } from './projection';
import { clampCelestialTimestampMilliseconds } from './celestialPlanetariumProjection';

export const projectCelestialStarBatches = (
  batches: readonly RegisteredCelestialStarBatch[],
  timeTransform: CelestialTimeTransform,
  timestampMilliseconds: number,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  const projectionContext = createPlanetariumProjectionContext(camera, canvas);
  const observedFrame = createCelestialObservedFrame(
    timeTransform,
    clampCelestialTimestampMilliseconds(timeTransform, timestampMilliseconds),
  );
  return batches.map((batch) => {
    const visiblePoints: { x: number; y: number }[] = [];
    for (const star of batch.directions) {
      const point = projectUnitVectorToCanvas(
        projectPreparedJ2000ToObservedHorizontalVector(
          star.j2000UnitVector,
          observedFrame,
        ),
        projectionContext,
      );
      if (point.visible)
        visiblePoints.push({ x: point.xPixels, y: point.yPixels });
    }
    return visiblePoints;
  });
};
