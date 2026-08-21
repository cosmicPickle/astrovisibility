import {
  createAstronomicalDarknessIntervals,
  intersectTimeIntervals,
  isTimestampInIntervals,
} from './astronomicalDarkness';

const interval = (startTimestampUtc: string, endTimestampUtc: string) => ({
  startTimestampUtc,
  endTimestampUtc,
  durationMilliseconds:
    Date.parse(endTimestampUtc) - Date.parse(startTimestampUtc),
});

describe('astronomical darkness', () => {
  const sofiaObserver = {
    latitudeDegreesNorth: 42.6977,
    longitudeDegreesEast: 23.3219,
    elevationMetersAboveMeanSeaLevel: 550,
  };

  it('finds the bounded Sun-below-minus-18 interval inside a civil-day window', () => {
    const darkness = createAstronomicalDarknessIntervals(sofiaObserver, {
      startTimestampUtc: '2026-08-20T09:00:00.000Z',
      endTimestampUtc: '2026-08-21T09:00:00.000Z',
    });

    expect(darkness).toHaveLength(1);
    expect(darkness[0]!.startTimestampUtc).toMatch(/^2026-08-20T19:/);
    expect(darkness[0]!.endTimestampUtc).toMatch(/^2026-08-21T01:/);
    expect(darkness[0]!.durationMilliseconds).toBeGreaterThan(
      6.5 * 60 * 60 * 1000,
    );
  });

  it('returns no astronomical darkness during polar day', () => {
    expect(
      createAstronomicalDarknessIntervals(
        {
          latitudeDegreesNorth: 69.6492,
          longitudeDegreesEast: 18.9553,
          elevationMetersAboveMeanSeaLevel: 10,
        },
        {
          startTimestampUtc: '2026-06-21T00:00:00.000Z',
          endTimestampUtc: '2026-06-22T00:00:00.000Z',
        },
      ),
    ).toEqual([]);
  });

  it('intersects multiple visibility and darkness intervals without joining gaps', () => {
    const visibility = [
      interval('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z'),
      interval('2026-01-01T02:00:00.000Z', '2026-01-01T04:00:00.000Z'),
    ];
    const darkness = [
      interval('2026-01-01T00:30:00.000Z', '2026-01-01T02:30:00.000Z'),
      interval('2026-01-01T03:00:00.000Z', '2026-01-01T05:00:00.000Z'),
    ];

    expect(intersectTimeIntervals(visibility, darkness)).toEqual([
      interval('2026-01-01T00:30:00.000Z', '2026-01-01T01:00:00.000Z'),
      interval('2026-01-01T02:00:00.000Z', '2026-01-01T02:30:00.000Z'),
      interval('2026-01-01T03:00:00.000Z', '2026-01-01T04:00:00.000Z'),
    ]);
  });

  it('treats an interval start as dark and its end as outside', () => {
    const darkness = [
      interval('2026-01-01T00:30:00.000Z', '2026-01-01T01:00:00.000Z'),
    ];

    expect(isTimestampInIntervals('2026-01-01T00:30:00.000Z', darkness)).toBe(
      true,
    );
    expect(isTimestampInIntervals('2026-01-01T01:00:00.000Z', darkness)).toBe(
      false,
    );
  });
});
