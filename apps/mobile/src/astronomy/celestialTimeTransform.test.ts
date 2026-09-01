import { equatorialJ2000ToHorizontal } from './horizontalCoordinates';
import {
  createCelestialObservedFrame,
  createCelestialTimeTransform,
  equatorialJ2000ToUnitVector,
  observedHorizontalVectorToJ2000,
  normalRefractionDegrees,
  projectPreparedJ2000ToObservedHorizontalVector,
  projectJ2000ToObservedHorizontalVector,
} from './celestialTimeTransform';

const MAXIMUM_PREVIEW_ERROR_DEGREES = 0.0001;

const circularDifferenceDegrees = (left: number, right: number) =>
  Math.abs(((left - right + 540) % 360) - 180);

const directionFromObservedVector = (vector: {
  x: number;
  y: number;
  z: number;
}) => ({
  altitudeDegrees:
    Math.asin(Math.max(-1, Math.min(1, vector.y))) * (180 / Math.PI),
  azimuthDegrees:
    (((Math.atan2(vector.x, vector.z) * (180 / Math.PI)) % 360) + 360) % 360,
});

const angularSeparationDegrees = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
) => {
  const dot = Math.max(
    -1,
    Math.min(1, left.x * right.x + left.y * right.y + left.z * right.z),
  );
  return Math.acos(dot) * (180 / Math.PI);
};

const cases = [
  {
    observer: {
      elevationMetersAboveMeanSeaLevel: 550,
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
    },
    timestampsUtc: [
      '2026-09-01T09:00:00.000Z',
      '2026-09-01T15:17:00.000Z',
      '2026-09-01T21:00:00.000Z',
      '2026-09-02T03:43:00.000Z',
      '2026-09-02T09:00:00.000Z',
    ],
  },
  {
    observer: {
      elevationMetersAboveMeanSeaLevel: 20,
      latitudeDegreesNorth: 69.65,
      longitudeDegreesEast: 18.96,
    },
    timestampsUtc: [
      '2026-10-24T10:00:00.000Z',
      '2026-10-24T16:15:00.000Z',
      '2026-10-24T22:30:00.000Z',
      '2026-10-25T04:45:00.000Z',
      '2026-10-25T11:00:00.000Z',
    ],
  },
  {
    observer: {
      elevationMetersAboveMeanSeaLevel: 35,
      latitudeDegreesNorth: -33.87,
      longitudeDegreesEast: 151.21,
    },
    timestampsUtc: [
      '2026-12-20T01:00:00.000Z',
      '2026-12-20T07:00:00.000Z',
      '2026-12-20T13:00:00.000Z',
      '2026-12-20T19:00:00.000Z',
      '2026-12-21T01:00:00.000Z',
    ],
  },
] as const;

const coordinates = [
  { rightAscensionJ2000Hours: 0.001, declinationJ2000Degrees: 89.9 },
  { rightAscensionJ2000Hours: 23.999, declinationJ2000Degrees: -89.9 },
  { rightAscensionJ2000Hours: 6.7525, declinationJ2000Degrees: -16.7161 },
  { rightAscensionJ2000Hours: 12, declinationJ2000Degrees: 0 },
  { rightAscensionJ2000Hours: 0.712, declinationJ2000Degrees: 41.269 },
] as const;

describe('celestial time transform', () => {
  it('keeps lookup refraction inside the renderer angular budget', () => {
    const exactRefractionDegrees = (altitudeDegrees: number) => {
      const boundedAltitudeDegrees = Math.max(-1, altitudeDegrees);
      let refractionDegrees =
        1.02 /
        Math.tan(
          (boundedAltitudeDegrees + 10.3 / (boundedAltitudeDegrees + 5.11)) *
            (Math.PI / 180),
        ) /
        60;
      if (altitudeDegrees < -1) {
        refractionDegrees *= (altitudeDegrees + 90) / 89;
      }
      return refractionDegrees;
    };
    let maximumErrorDegrees = 0;
    for (
      let altitudeDegrees = -90;
      altitudeDegrees <= 90;
      altitudeDegrees += 0.001
    ) {
      maximumErrorDegrees = Math.max(
        maximumErrorDegrees,
        Math.abs(
          normalRefractionDegrees(altitudeDegrees) -
            exactRefractionDegrees(altitudeDegrees),
        ),
      );
    }

    expect(maximumErrorDegrees).toBeLessThan(MAXIMUM_PREVIEW_ERROR_DEGREES);
  });

  it('projects prepared J2000 vectors through one shared frame without changing coordinates', () => {
    const transform = createCelestialTimeTransform({
      observer: {
        elevationMetersAboveMeanSeaLevel: 550,
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
      },
      window: {
        startTimestampUtc: '2026-08-20T09:00:00.000Z',
        endTimestampUtc: '2026-08-21T09:00:00.000Z',
      },
    });
    const timestampMilliseconds = Date.parse('2026-08-20T21:17:00.000Z');
    const frame = createCelestialObservedFrame(
      transform,
      timestampMilliseconds,
    );

    for (const coordinate of [
      { rightAscensionJ2000Hours: 0, declinationJ2000Degrees: 0 },
      { rightAscensionJ2000Hours: 6.7525, declinationJ2000Degrees: -16.7161 },
      { rightAscensionJ2000Hours: 23.99, declinationJ2000Degrees: 89.5 },
    ]) {
      const vector = equatorialJ2000ToUnitVector(coordinate);
      const expected = projectJ2000ToObservedHorizontalVector(
        vector,
        transform,
        timestampMilliseconds,
      );
      const actual = projectPreparedJ2000ToObservedHorizontalVector(
        vector,
        frame,
      );

      expect(
        Math.hypot(
          actual.x - expected.x,
          actual.y - expected.y,
          actual.z - expected.z,
        ),
      ).toBeLessThanOrEqual(1e-12);
    }
  });
  it.each(cases)(
    'matches the authoritative observed-horizontal adapter throughout a window',
    ({ observer, timestampsUtc }) => {
      const transform = createCelestialTimeTransform({
        observer,
        window: {
          startTimestampUtc: timestampsUtc[0],
          endTimestampUtc: timestampsUtc[timestampsUtc.length - 1],
        },
      });

      for (const timestampUtc of timestampsUtc) {
        for (const coordinate of coordinates) {
          const expected = equatorialJ2000ToHorizontal({
            ...coordinate,
            observer,
            timestampUtc,
          });
          const actual = directionFromObservedVector(
            projectJ2000ToObservedHorizontalVector(
              equatorialJ2000ToUnitVector(coordinate),
              transform,
              Date.parse(timestampUtc),
            ),
          );

          expect(
            circularDifferenceDegrees(
              actual.azimuthDegrees,
              expected.azimuthDegreesClockwiseFromNorth,
            ),
          ).toBeLessThanOrEqual(MAXIMUM_PREVIEW_ERROR_DEGREES);
          expect(
            Math.abs(
              actual.altitudeDegrees - expected.refractedAltitudeDegrees,
            ),
          ).toBeLessThanOrEqual(MAXIMUM_PREVIEW_ERROR_DEGREES);
        }
      }
    },
  );

  it('round trips observed directions through the inverse transform', () => {
    const timestampsUtc = [
      '2026-09-01T09:00:00.000Z',
      '2026-09-02T10:00:00.000Z',
    ] as const;
    const transform = createCelestialTimeTransform({
      observer: cases[0].observer,
      window: {
        startTimestampUtc: timestampsUtc[0],
        endTimestampUtc: timestampsUtc[1],
      },
    });

    for (const timestampUtc of timestampsUtc) {
      for (const coordinate of coordinates) {
        const expected = equatorialJ2000ToUnitVector(coordinate);
        const observed = projectJ2000ToObservedHorizontalVector(
          expected,
          transform,
          Date.parse(timestampUtc),
        );
        const actual = observedHorizontalVectorToJ2000(
          observed,
          transform,
          Date.parse(timestampUtc),
        );
        expect(angularSeparationDegrees(actual, expected)).toBeLessThan(1e-5);
      }
    }
  });

  it('rejects timestamps outside its bounded observing window', () => {
    const transform = createCelestialTimeTransform({
      observer: cases[0].observer,
      window: {
        startTimestampUtc: '2026-09-01T09:00:00.000Z',
        endTimestampUtc: '2026-09-02T09:00:00.000Z',
      },
    });
    const vector = equatorialJ2000ToUnitVector(coordinates[0]);

    expect(() =>
      projectJ2000ToObservedHorizontalVector(
        vector,
        transform,
        Date.parse('2026-09-01T08:59:59.999Z'),
      ),
    ).toThrow('observing window');
  });
});
