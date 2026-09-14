import {
  createCelestialTimeTransform,
  observedHorizontalVectorToJ2000,
} from '../astronomy/celestialTimeTransform';
import type { CelestialImageMesh } from './celestialSkyGeometry';
import { projectCelestialImageMeshes } from './celestialImageProjection';
import {
  createPlanetariumCamera,
  horizontalDirectionToVector,
} from './planetariumProjection';

describe('celestial image projection', () => {
  const window = {
    startTimestampUtc: '2026-09-01T09:00:00.000Z',
    endTimestampUtc: '2026-09-02T09:00:00.000Z',
  };
  const transform = createCelestialTimeTransform({
    observer: {
      elevationMetersAboveMeanSeaLevel: 550,
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
    },
    window,
  });
  const timestampMilliseconds = Date.parse('2026-09-01T21:00:00.000Z');
  const canvas = { heightPixels: 800, widthPixels: 400 };
  const camera = createPlanetariumCamera({
    centerAltitudeDegrees: 0,
    centerAzimuthDegrees: 0,
    fieldOfViewDegrees: 60,
  });

  const createMesh = (
    directions: readonly {
      altitudeDegrees: number;
      azimuthDegrees: number;
    }[],
  ): CelestialImageMesh => ({
    angularRadiusDegrees: 2,
    centerJ2000UnitVector: observedHorizontalVectorToJ2000(
      horizontalDirectionToVector(directions[0]!),
      transform,
      timestampMilliseconds,
    ),
    columnCount: 3,
    directionVectors: directions.map((direction) =>
      observedHorizontalVectorToJ2000(
        horizontalDirectionToVector(direction),
        transform,
        timestampMilliseconds,
      ),
    ),
    indices: [0, 1, 2],
    rowCount: 1,
    texturePointsPixels: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  });

  it('drops a triangle crossing the projection antipode instead of flashing it across the canvas', () => {
    const projection = projectCelestialImageMeshes(
      [
        createMesh([
          { altitudeDegrees: 0, azimuthDegrees: 179.999 },
          { altitudeDegrees: 1, azimuthDegrees: 179 },
          { altitudeDegrees: -1, azimuthDegrees: 179 },
        ]),
      ],
      transform,
      timestampMilliseconds,
      camera,
      canvas,
    );

    expect(projection.indices).toEqual([]);
    expect(projection.texturePointsPixels).toEqual([]);
    expect(projection.vertices).toEqual([]);
    const marginPixels = Math.hypot(canvas.widthPixels, canvas.heightPixels);
    for (const point of projection.vertices) {
      expect(Number.isFinite(point.xPixels)).toBe(true);
      expect(Number.isFinite(point.yPixels)).toBe(true);
      expect(point.xPixels).toBeGreaterThanOrEqual(-marginPixels);
      expect(point.xPixels).toBeLessThanOrEqual(
        canvas.widthPixels + marginPixels,
      );
      expect(point.yPixels).toBeGreaterThanOrEqual(-marginPixels);
      expect(point.yPixels).toBeLessThanOrEqual(
        canvas.heightPixels + marginPixels,
      );
    }
  });

  it('retains an ordinary image triangle intersecting the canvas', () => {
    const projection = projectCelestialImageMeshes(
      [
        createMesh([
          { altitudeDegrees: 0, azimuthDegrees: 0 },
          { altitudeDegrees: 1, azimuthDegrees: 1 },
          { altitudeDegrees: -1, azimuthDegrees: 1 },
        ]),
      ],
      transform,
      timestampMilliseconds,
      camera,
      canvas,
    );

    expect(projection.indices).toEqual([0, 1, 2]);
    expect(projection.texturePointsPixels).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('does not allocate vertices or texture coordinates for a culled mesh', () => {
    const visibleMesh = createMesh([
      { altitudeDegrees: 0, azimuthDegrees: 0 },
      { altitudeDegrees: 1, azimuthDegrees: 1 },
      { altitudeDegrees: -1, azimuthDegrees: 1 },
    ]);
    const culledMesh = createMesh([
      { altitudeDegrees: 0, azimuthDegrees: 180 },
      { altitudeDegrees: 1, azimuthDegrees: 179 },
      { altitudeDegrees: -1, azimuthDegrees: 179 },
    ]);

    const projection = projectCelestialImageMeshes(
      [visibleMesh, culledMesh],
      transform,
      timestampMilliseconds,
      camera,
      canvas,
    );

    expect(projection.indices).toEqual([0, 1, 2]);
    expect(projection.vertices).toHaveLength(3);
    expect(projection.texturePointsPixels).toEqual(
      visibleMesh.texturePointsPixels,
    );
  });
});
