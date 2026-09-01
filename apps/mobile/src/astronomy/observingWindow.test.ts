import {
  clampNoonCenteredTrackEndTimestamp,
  createDateObservingWindow,
  createDefaultObservingContext,
  createTonightObservingWindow,
  getNoonCenteredObservingDate,
  getNoonCenteredSliderMinute,
  resolveNoonCenteredSliderTimestamp,
} from './observingWindow';

const sofiaObserver = {
  latitudeDegreesNorth: 42.6977,
  longitudeDegreesEast: 23.3219,
  elevationMetersAboveMeanSeaLevel: 550,
};

describe('Tonight observing window', () => {
  it('uses astronomical dusk through following astronomical dawn across midnight', () => {
    const result = createTonightObservingWindow({
      civilDate: { year: 2026, month: 8, day: 19 },
      timeZoneId: 'Europe/Sofia',
      observer: {
        latitudeDegreesNorth: 42.6977,
        longitudeDegreesEast: 23.3219,
        elevationMetersAboveMeanSeaLevel: 550,
      },
    });

    expect(result.kind).toBe('astronomicalDarkness');
    expect(result.note).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.startTimestampUtc).toMatch(/^2026-08-19T/);
    expect(result.endTimestampUtc).toMatch(/^2026-08-20T/);
    expect(
      Date.parse(result.endTimestampUtc) - Date.parse(result.startTimestampUtc),
    ).toBeGreaterThan(4 * 60 * 60 * 1000);
  });

  it('falls back to sunset and sunrise when a high-latitude night has no astronomical darkness', () => {
    const result = createTonightObservingWindow({
      civilDate: { year: 2026, month: 6, day: 1 },
      timeZoneId: 'Europe/Helsinki',
      observer: {
        latitudeDegreesNorth: 60.1699,
        longitudeDegreesEast: 24.9384,
        elevationMetersAboveMeanSeaLevel: 20,
      },
    });

    expect(result.kind).toBe('sunsetSunrise');
    expect(result.note).toBe('No astronomical darkness');
    expect(result.warnings).toEqual([]);
    expect(Date.parse(result.endTimestampUtc)).toBeGreaterThan(
      Date.parse(result.startTimestampUtc),
    );
  });

  it('uses the explicit local 18:00–06:00 warning fallback during polar day', () => {
    const result = createTonightObservingWindow({
      civilDate: { year: 2026, month: 6, day: 21 },
      timeZoneId: 'Europe/Oslo',
      observer: {
        latitudeDegreesNorth: 69.6492,
        longitudeDegreesEast: 18.9553,
        elevationMetersAboveMeanSeaLevel: 10,
      },
    });

    expect(result).toEqual({
      kind: 'civilFallback',
      startTimestampUtc: '2026-06-21T16:00:00.000Z',
      endTimestampUtc: '2026-06-22T04:00:00.000Z',
      note: 'No astronomical darkness',
      warnings: [
        'Sunset and sunrise are unavailable; using 18:00–06:00 local time.',
      ],
    });
  });
});

describe('fixed selected-date observing window', () => {
  it('runs from local noon to following local noon with midnight centred', () => {
    const ordinary = createDateObservingWindow({
      civilDate: { year: 2026, month: 8, day: 21 },
      timeZoneId: 'Europe/Sofia',
    });

    expect(ordinary.kind).toBe('day');
    expect(ordinary.startTimestampUtc).toBe('2026-08-21T09:00:00.000Z');
    expect(ordinary.endTimestampUtc).toBe('2026-08-22T09:00:00.000Z');
    expect(
      resolveNoonCenteredSliderTimestamp({
        civilDate: { year: 2026, month: 8, day: 21 },
        minuteOfTrack: 720,
        timeZoneId: 'Europe/Sofia',
      }),
    ).toBe('2026-08-21T21:00:00.000Z');
    expect(
      resolveNoonCenteredSliderTimestamp({
        civilDate: { year: 2026, month: 8, day: 21 },
        minuteOfTrack: 1439,
        timeZoneId: 'Europe/Sofia',
      }),
    ).toBe('2026-08-22T08:59:00.000Z');
  });

  it('keeps the civil slider centred while elapsed duration follows DST', () => {
    const springForward = createDateObservingWindow({
      civilDate: { year: 2026, month: 3, day: 28 },
      timeZoneId: 'Europe/Sofia',
    });
    const fallBack = createDateObservingWindow({
      civilDate: { year: 2026, month: 10, day: 24 },
      timeZoneId: 'Europe/Sofia',
    });

    expect(
      Date.parse(springForward.endTimestampUtc) -
        Date.parse(springForward.startTimestampUtc),
    ).toBe(23 * 60 * 60 * 1000);
    expect(
      Date.parse(fallBack.endTimestampUtc) -
        Date.parse(fallBack.startTimestampUtc),
    ).toBe(25 * 60 * 60 * 1000);
    expect(
      resolveNoonCenteredSliderTimestamp({
        civilDate: { year: 2026, month: 3, day: 28 },
        minuteOfTrack: 930,
        timeZoneId: 'Europe/Sofia',
      }),
    ).toBe('2026-03-29T01:00:00.000Z');
    expect(
      resolveNoonCenteredSliderTimestamp({
        civilDate: { year: 2026, month: 10, day: 24 },
        minuteOfTrack: 930,
        timeZoneId: 'Europe/Sofia',
      }),
    ).toBe('2026-10-25T00:30:00.000Z');
  });

  it('clamps an exact day-end condition marker to the last selectable minute', () => {
    expect(
      clampNoonCenteredTrackEndTimestamp({
        civilDate: { year: 2026, month: 8, day: 31 },
        timestampUtc: '2026-09-01T09:00:00.000Z',
        windowEndTimestampUtc: '2026-09-01T09:00:00.000Z',
        timeZoneId: 'Europe/Kiev',
      }),
    ).toBe('2026-09-01T08:59:00.000Z');
  });

  it('assigns pre-noon instants to the previous observing date', () => {
    expect(
      getNoonCenteredObservingDate('2026-05-02T08:00:00.000Z', 'Europe/Sofia'),
    ).toEqual({ year: 2026, month: 5, day: 1 });
    expect(
      getNoonCenteredObservingDate('2026-05-02T09:00:00.000Z', 'Europe/Sofia'),
    ).toEqual({ year: 2026, month: 5, day: 2 });
    expect(
      getNoonCenteredSliderMinute({
        civilDate: { year: 2026, month: 5, day: 1 },
        timestampUtc: '2026-05-01T21:00:00.000Z',
        timeZoneId: 'Europe/Sofia',
      }),
    ).toBe(720);
  });
});

describe('default observing context', () => {
  it('uses the current instant when it lies inside the active night', () => {
    const context = createDefaultObservingContext({
      nowTimestampUtc: '2026-08-20T00:00:00.000Z',
      observer: sofiaObserver,
      timeZoneId: 'Europe/Sofia',
    });

    expect(Date.parse(context.window.startTimestampUtc)).toBeLessThanOrEqual(
      Date.parse(context.sceneTimestampUtc),
    );
    expect(Date.parse(context.window.endTimestampUtc)).toBeGreaterThanOrEqual(
      Date.parse(context.sceneTimestampUtc),
    );
    expect(context.sceneTimestampUtc).toBe('2026-08-20T00:00:00.000Z');
    expect(context.window.startTimestampUtc).toMatch(/^2026-08-19T/);
  });

  it('uses the upcoming night start for a daytime launch', () => {
    const context = createDefaultObservingContext({
      nowTimestampUtc: '2026-08-20T07:31:00.000Z',
      observer: sofiaObserver,
      timeZoneId: 'Europe/Sofia',
    });

    expect(context.window.startTimestampUtc).toMatch(/^2026-08-20T/);
    expect(context.sceneTimestampUtc).toBe(context.window.startTimestampUtc);
  });
});
