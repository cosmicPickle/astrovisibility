import referenceFixtures from './__fixtures__/horizontal-reference.json';
import {
  createInstantHorizontalProjector,
  createWindowHorizontalProjector,
  equatorialJ2000ToHorizontal,
} from './horizontalCoordinates';

const circularDifferenceDegrees = (left: number, right: number) =>
  Math.abs(((left - right + 540) % 360) - 180);

describe('equatorialJ2000ToHorizontal', () => {
  it('matches the authoritative adapter when projecting a fixed sky in batch', () => {
    const timestampUtc = '2026-08-29T21:15:00.000Z';
    const observer = {
      elevationMetersAboveMeanSeaLevel: 540,
      latitudeDegreesNorth: 42.6977,
      longitudeDegreesEast: 23.3219,
    };
    const project = createInstantHorizontalProjector({
      observer,
      timestampUtc,
    });

    for (const coordinate of [
      { rightAscensionJ2000Hours: 0.001, declinationJ2000Degrees: 89.9 },
      { rightAscensionJ2000Hours: 6.7525, declinationJ2000Degrees: -16.7161 },
      { rightAscensionJ2000Hours: 23.999, declinationJ2000Degrees: -45 },
    ]) {
      const expected = equatorialJ2000ToHorizontal({
        ...coordinate,
        observer,
        timestampUtc,
      });
      const actual = project(coordinate);
      expect(actual.azimuthDegreesClockwiseFromNorth).toBeCloseTo(
        expected.azimuthDegreesClockwiseFromNorth,
        7,
      );
      expect(actual.refractedAltitudeDegrees).toBeCloseTo(
        expected.refractedAltitudeDegrees,
        7,
      );
    }
  });

  it.each(referenceFixtures)(
    'matches the independent $id reference',
    (fixture) => {
      const result = equatorialJ2000ToHorizontal({
        rightAscensionJ2000Hours: fixture.rightAscensionJ2000Hours,
        declinationJ2000Degrees: fixture.declinationJ2000Degrees,
        timestampUtc: fixture.timestampUtc,
        observer: {
          latitudeDegreesNorth: fixture.latitudeDegreesNorth,
          longitudeDegreesEast: fixture.longitudeDegreesEast,
          elevationMetersAboveMeanSeaLevel:
            fixture.elevationMetersAboveMeanSeaLevel,
        },
      });

      expect(
        circularDifferenceDegrees(
          result.azimuthDegreesClockwiseFromNorth,
          fixture.expectedAzimuthDegreesClockwiseFromNorth,
        ),
      ).toBeLessThanOrEqual(fixture.toleranceDegrees);
      expect(
        Math.abs(
          result.refractedAltitudeDegrees -
            fixture.expectedRefractedAltitudeDegrees,
        ),
      ).toBeLessThanOrEqual(fixture.toleranceDegrees);
    },
  );

  it('rejects invalid coordinate units and timestamps', () => {
    expect(() =>
      equatorialJ2000ToHorizontal({
        rightAscensionJ2000Hours: 24,
        declinationJ2000Degrees: 0,
        timestampUtc: '2026-01-01T00:00:00.000Z',
        observer: {
          latitudeDegreesNorth: 0,
          longitudeDegreesEast: 0,
          elevationMetersAboveMeanSeaLevel: 0,
        },
      }),
    ).toThrow('rightAscensionJ2000Hours');

    expect(() =>
      equatorialJ2000ToHorizontal({
        rightAscensionJ2000Hours: 0,
        declinationJ2000Degrees: 0,
        timestampUtc: 'not-a-date',
        observer: {
          latitudeDegreesNorth: 0,
          longitudeDegreesEast: 0,
          elevationMetersAboveMeanSeaLevel: 0,
        },
      }),
    ).toThrow('timestampUtc');
  });
});

describe('window-optimized horizontal projection', () => {
  it('accepts a 25-hour noon window across a fall daylight-saving transition', () => {
    expect(() =>
      createWindowHorizontalProjector({
        observer: {
          latitudeDegreesNorth: 42.7,
          longitudeDegreesEast: 23.3,
          elevationMetersAboveMeanSeaLevel: 550,
        },
        target: {
          rightAscensionJ2000Hours: 2,
          declinationJ2000Degrees: 40,
        },
        window: {
          startTimestampUtc: '2026-10-24T09:00:00.000Z',
          endTimestampUtc: '2026-10-25T10:00:00.000Z',
        },
      }),
    ).not.toThrow();
  });

  it('matches the authoritative adapter across a twelve-hour observing window', () => {
    const observer = {
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
      elevationMetersAboveMeanSeaLevel: 550,
    };
    const target = {
      rightAscensionJ2000Hours: 23.99,
      declinationJ2000Degrees: 41.269,
    };
    const window = {
      startTimestampUtc: '2026-08-19T18:00:00.000Z',
      endTimestampUtc: '2026-08-20T06:00:00.000Z',
    };
    const project = createWindowHorizontalProjector({
      observer,
      target,
      window,
    });

    for (const timestampUtc of [
      window.startTimestampUtc,
      '2026-08-20T00:00:00.000Z',
      window.endTimestampUtc,
    ]) {
      const expected = equatorialJ2000ToHorizontal({
        ...target,
        observer,
        timestampUtc,
      });
      const actual = project(timestampUtc);
      expect(
        circularDifferenceDegrees(
          actual.azimuthDegreesClockwiseFromNorth,
          expected.azimuthDegreesClockwiseFromNorth,
        ),
      ).toBeLessThan(0.01);
      expect(
        Math.abs(
          actual.refractedAltitudeDegrees - expected.refractedAltitudeDegrees,
        ),
      ).toBeLessThan(0.01);
    }
  });
});
