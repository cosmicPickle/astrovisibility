import {
  createCelestialTimeTransform,
  equatorialJ2000ToUnitVector,
} from '../astronomy/celestialTimeTransform';
import { equatorialJ2000ToHorizontal } from '../astronomy/horizontalCoordinates';
import {
  createPlanetariumCamera,
  createPlanetariumProjectionContext,
  horizontalDirectionToVector,
  projectUnitVectorToCanvas,
} from './planetariumProjection';
import { projectJ2000UnitVectorToCanvas } from './celestialPlanetariumProjection';

describe('celestial planetarium projection', () => {
  it('matches the committed horizontal renderer within half a pixel at maximum zoom', () => {
    const observer = {
      elevationMetersAboveMeanSeaLevel: 550,
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
    };
    const window = {
      startTimestampUtc: '2026-09-01T09:00:00.000Z',
      endTimestampUtc: '2026-09-02T09:00:00.000Z',
    };
    const transform = createCelestialTimeTransform({ observer, window });
    const canvas = { heightPixels: 1920, widthPixels: 1080 };

    for (const timestampUtc of [
      window.startTimestampUtc,
      '2026-09-01T21:17:00.000Z',
      window.endTimestampUtc,
    ]) {
      for (const coordinate of [
        { rightAscensionJ2000Hours: 0.712, declinationJ2000Degrees: 41.269 },
        { rightAscensionJ2000Hours: 6.7525, declinationJ2000Degrees: -16.7161 },
        { rightAscensionJ2000Hours: 23.99, declinationJ2000Degrees: 89.5 },
      ]) {
        const horizontal = equatorialJ2000ToHorizontal({
          ...coordinate,
          observer,
          timestampUtc,
        });
        const camera = createPlanetariumCamera({
          centerAltitudeDegrees: horizontal.refractedAltitudeDegrees,
          centerAzimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
          fieldOfViewDegrees: 0.25,
        });
        const context = createPlanetariumProjectionContext(camera, canvas);
        const expected = projectUnitVectorToCanvas(
          horizontalDirectionToVector({
            altitudeDegrees: horizontal.refractedAltitudeDegrees,
            azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
          }),
          context,
        );
        const actual = projectJ2000UnitVectorToCanvas(
          equatorialJ2000ToUnitVector(coordinate),
          transform,
          Date.parse(timestampUtc),
          context,
        );

        expect(
          Math.hypot(
            actual.xPixels - expected.xPixels,
            actual.yPixels - expected.yPixels,
          ),
        ).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
