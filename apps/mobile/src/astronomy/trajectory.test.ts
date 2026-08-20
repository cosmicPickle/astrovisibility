import {
  createSelectedTargetTrajectory,
  createHourlyMarkers,
  unwrapTrajectoryAzimuths,
} from './trajectory';
import { equatorialJ2000ToHorizontal } from './horizontalCoordinates';

const sofiaObserver = {
  latitudeDegreesNorth: 42.6977,
  longitudeDegreesEast: 23.3219,
  elevationMetersAboveMeanSeaLevel: 550,
};

describe('selected-target trajectory', () => {
  it('samples exact one-minute render instants, includes the end, and never claims visibility without a mask', () => {
    const result = createSelectedTargetTrajectory({
      target: {
        rightAscensionJ2000Hours: 5.588,
        declinationJ2000Degrees: -5.391,
      },
      observer: sofiaObserver,
      timeZoneId: 'Europe/Sofia',
      window: {
        startTimestampUtc: '2026-01-10T20:02:00.000Z',
        endTimestampUtc: '2026-01-10T20:14:00.000Z',
      },
    });

    expect(result.samples.map((sample) => sample.timestampUtc)).toEqual([
      '2026-01-10T20:02:00.000Z',
      '2026-01-10T20:03:00.000Z',
      '2026-01-10T20:04:00.000Z',
      '2026-01-10T20:05:00.000Z',
      '2026-01-10T20:06:00.000Z',
      '2026-01-10T20:07:00.000Z',
      '2026-01-10T20:08:00.000Z',
      '2026-01-10T20:09:00.000Z',
      '2026-01-10T20:10:00.000Z',
      '2026-01-10T20:11:00.000Z',
      '2026-01-10T20:12:00.000Z',
      '2026-01-10T20:13:00.000Z',
      '2026-01-10T20:14:00.000Z',
    ]);
    expect(
      result.samples.every(
        (sample) =>
          sample.assessment === 'belowHorizon' ||
          sample.assessment === 'unassessed',
      ),
    ).toBe(true);
  });

  it('unwraps a north-crossing path without a 360-degree drawing jump', () => {
    expect(unwrapTrajectoryAzimuths([358, 1, 4, 359])).toEqual([
      358, 361, 364, 359,
    ]);
  });

  it('reports a circumpolar target as above the horizon for the complete interval', () => {
    const result = createSelectedTargetTrajectory({
      target: {
        rightAscensionJ2000Hours: 2,
        declinationJ2000Degrees: 89,
      },
      observer: {
        latitudeDegreesNorth: 60,
        longitudeDegreesEast: 0,
        elevationMetersAboveMeanSeaLevel: 0,
      },
      timeZoneId: 'UTC',
      window: {
        startTimestampUtc: '2026-01-01T18:00:00.000Z',
        endTimestampUtc: '2026-01-02T06:00:00.000Z',
      },
    });

    expect(result.aboveHorizonIntervals).toEqual([
      {
        startTimestampUtc: '2026-01-01T18:00:00.000Z',
        endTimestampUtc: '2026-01-02T06:00:00.000Z',
        durationMilliseconds: 12 * 60 * 60 * 1000,
      },
    ]);
    expect(result.totalAboveHorizonMilliseconds).toBe(12 * 60 * 60 * 1000);
  });

  it('reports a never-rising target with no above-horizon interval', () => {
    const result = createSelectedTargetTrajectory({
      target: {
        rightAscensionJ2000Hours: 2,
        declinationJ2000Degrees: -89,
      },
      observer: {
        latitudeDegreesNorth: 60,
        longitudeDegreesEast: 0,
        elevationMetersAboveMeanSeaLevel: 0,
      },
      timeZoneId: 'UTC',
      window: {
        startTimestampUtc: '2026-01-01T18:00:00.000Z',
        endTimestampUtc: '2026-01-02T06:00:00.000Z',
      },
    });

    expect(result.aboveHorizonIntervals).toEqual([]);
    expect(result.totalAboveHorizonMilliseconds).toBe(0);
    expect(
      result.samples.every((sample) => sample.assessment === 'belowHorizon'),
    ).toBe(true);
  });

  it('refines real horizon crossings to the 30-second transition tolerance', () => {
    const target = {
      rightAscensionJ2000Hours: 0,
      declinationJ2000Degrees: 0,
    };
    const observer = {
      latitudeDegreesNorth: 0,
      longitudeDegreesEast: 0,
      elevationMetersAboveMeanSeaLevel: 0,
    };
    const result = createSelectedTargetTrajectory({
      target,
      observer,
      timeZoneId: 'UTC',
      window: {
        startTimestampUtc: '2026-01-01T00:00:00.000Z',
        endTimestampUtc: '2026-01-02T00:00:00.000Z',
      },
    });

    expect(result.aboveHorizonIntervals).toHaveLength(1);
    const interval = result.aboveHorizonIntervals[0]!;
    expect(interval.durationMilliseconds).toBeGreaterThan(11 * 60 * 60 * 1000);
    expect(interval.durationMilliseconds).toBeLessThan(13 * 60 * 60 * 1000);
    const altitudeAt = (timestampMilliseconds: number) =>
      equatorialJ2000ToHorizontal({
        ...target,
        observer,
        timestampUtc: new Date(timestampMilliseconds).toISOString(),
      }).refractedAltitudeDegrees;
    const riseMilliseconds = Date.parse(interval.startTimestampUtc);
    const setMilliseconds = Date.parse(interval.endTimestampUtc);
    expect(altitudeAt(riseMilliseconds - 31_000)).toBeLessThan(0);
    expect(altitudeAt(riseMilliseconds)).toBeGreaterThanOrEqual(0);
    expect(altitudeAt(setMilliseconds - 31_000)).toBeGreaterThanOrEqual(0);
    expect(altitudeAt(setMilliseconds)).toBeLessThan(0);
  });

  it('places markers on exact local hour boundaries across midnight', () => {
    expect(
      createHourlyMarkers({
        startTimestampUtc: '2026-08-19T20:07:00.000Z',
        endTimestampUtc: '2026-08-19T22:08:00.000Z',
        timeZoneId: 'Europe/Sofia',
      }).map(({ timestampUtc, localTimeLabel }) => ({
        timestampUtc,
        localTimeLabel,
      })),
    ).toEqual([
      {
        timestampUtc: '2026-08-19T21:00:00.000Z',
        localTimeLabel: '00:00',
      },
      {
        timestampUtc: '2026-08-19T22:00:00.000Z',
        localTimeLabel: '01:00',
      },
    ]);
  });

  it('keeps both occurrences of a repeated hourly marker', () => {
    expect(
      createHourlyMarkers({
        startTimestampUtc: '2026-11-01T05:00:00.000Z',
        endTimestampUtc: '2026-11-01T07:01:00.000Z',
        timeZoneId: 'America/New_York',
      })
        .filter(({ localTimeLabel }) => localTimeLabel === '01:00')
        .map(({ timestampUtc }) => timestampUtc),
    ).toEqual(['2026-11-01T05:00:00.000Z', '2026-11-01T06:00:00.000Z']);
  });

  it('skips nonexistent spring-forward clock markers', () => {
    const markers = createHourlyMarkers({
      startTimestampUtc: '2026-03-08T06:00:00.000Z',
      endTimestampUtc: '2026-03-08T08:01:00.000Z',
      timeZoneId: 'America/New_York',
    });

    expect(markers.map(({ localTimeLabel }) => localTimeLabel)).toEqual([
      '01:00',
      '03:00',
      '04:00',
    ]);
  });
});
