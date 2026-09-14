import {
  createCelestialTimeTransform,
  observedHorizontalVectorToJ2000,
} from '../astronomy/celestialTimeTransform';
import type { RegisteredCelestialStarBatch } from './celestialSkyGeometry';
import { projectCelestialStarBatches } from './celestialStarProjection';
import {
  createPlanetariumCamera,
  horizontalDirectionToVector,
} from './planetariumProjection';

describe('celestial star batch projection', () => {
  it('projects every style batch through one shared observed frame', () => {
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
    const createBatch = (
      key: string,
      altitudeDegrees: number,
      azimuthDegrees: number,
    ): RegisteredCelestialStarBatch => ({
      color: '#ffffff',
      coreColor: '#ffffff',
      directions: [
        {
          id: key,
          j2000UnitVector: observedHorizontalVectorToJ2000(
            horizontalDirectionToVector({
              altitudeDegrees,
              azimuthDegrees,
            }),
            transform,
            timestampMilliseconds,
          ),
          magnitude: 1,
        },
      ],
      fadeStartFieldOfViewDegrees: null,
      fullOpacityFieldOfViewDegrees: null,
      haloRadiusPixels: 2,
      key,
      outerHaloRadiusPixels: null,
      radiusPixels: 1,
    });

    const projected = projectCelestialStarBatches(
      [createBatch('visible', 0, 0), createBatch('hidden', 0, 180)],
      transform,
      timestampMilliseconds,
      createPlanetariumCamera({
        centerAltitudeDegrees: 0,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 60,
      }),
      { heightPixels: 800, widthPixels: 400 },
    );

    expect(projected[0]).toHaveLength(1);
    expect(projected[0]![0]!.x).toBeCloseTo(200, 9);
    expect(projected[0]![0]!.y).toBeCloseTo(400, 7);
    expect(projected[1]).toEqual([]);
  });
});
