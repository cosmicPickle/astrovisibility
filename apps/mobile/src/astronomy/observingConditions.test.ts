import {
  createDateObservingWindow,
  getNoonCenteredSliderMinute,
} from './observingWindow';
import {
  createAstronomicalDarknessSpan,
  createMoonConditions,
  createSkyConditionTrack,
} from './observingConditions';

const sofiaObserver = {
  latitudeDegreesNorth: 42.6977,
  longitudeDegreesEast: 23.3219,
  elevationMetersAboveMeanSeaLevel: 550,
};

describe('observing conditions', () => {
  it('builds a bounded moon-aware track once per half hour', () => {
    const fullMoonWindow = createDateObservingWindow({
      civilDate: { year: 2026, month: 5, day: 1 },
      timeZoneId: 'Europe/Sofia',
    });
    const newMoonWindow = createDateObservingWindow({
      civilDate: { year: 2026, month: 5, day: 16 },
      timeZoneId: 'Europe/Sofia',
    });
    const fullMoonTrack = createSkyConditionTrack({
      observer: sofiaObserver,
      timeZoneId: 'Europe/Sofia',
      window: fullMoonWindow,
    });
    const newMoonTrack = createSkyConditionTrack({
      observer: sofiaObserver,
      timeZoneId: 'Europe/Sofia',
      window: newMoonWindow,
    });

    expect(fullMoonTrack).toHaveLength(49);
    expect(fullMoonTrack[0]!.condition).toBe('Daylight');
    expect(fullMoonTrack[24]!.condition).toBe('Moonlight');
    expect(newMoonTrack[24]!.condition).toBe('Dark night');
    expect(fullMoonTrack[24]!.color).not.toBe(newMoonTrack[24]!.color);
    expect(fullMoonTrack.some(({ condition }) => condition === 'Dusk')).toBe(
      true,
    );
    expect(fullMoonTrack.some(({ condition }) => condition === 'Dawn')).toBe(
      true,
    );
  });

  it('reports exact astronomical darkness independently of moonlight', () => {
    const window = createDateObservingWindow({
      civilDate: { year: 2026, month: 5, day: 1 },
      timeZoneId: 'Europe/Sofia',
    });
    const span = createAstronomicalDarknessSpan(sofiaObserver, window);

    expect(span.kind).toBe('bounded');
    if (span.kind !== 'bounded') throw new Error('Expected bounded darkness');
    expect(span.startTimestampUtc).toMatch(/^2026-05-01T19:/);
    expect(span.endTimestampUtc).toMatch(/^2026-05-02T01:/);
  });

  it('keeps Sofia darkness markers inside a Kyiv-zoned live observing day', () => {
    const civilDate = { year: 2026, month: 8, day: 31 };
    const timeZoneId = 'Europe/Kiev';
    const window = createDateObservingWindow({ civilDate, timeZoneId });
    const span = createAstronomicalDarknessSpan(sofiaObserver, window);

    expect(span.kind).toBe('bounded');
    if (span.kind !== 'bounded') throw new Error('Expected bounded darkness');
    expect(
      [span.startTimestampUtc, span.endTimestampUtc].map((timestampUtc) =>
        getNoonCenteredSliderMinute({
          civilDate,
          timestampUtc,
          timeZoneId,
        }),
      ),
    ).toEqual([expect.any(Number), expect.any(Number)]);
  });

  it('describes phase, illumination, and bounded moon rise/set', () => {
    const window = createDateObservingWindow({
      civilDate: { year: 2026, month: 5, day: 1 },
      timeZoneId: 'Europe/Sofia',
    });
    const moon = createMoonConditions({
      observer: sofiaObserver,
      timestampUtc: '2026-05-01T21:00:00.000Z',
      timeZoneId: 'Europe/Sofia',
      window,
    });

    expect(moon.phaseName).toBe('Full Moon');
    expect(moon.illuminatedPercent).toBeGreaterThanOrEqual(99);
    expect(moon.riseLocalTime).toMatch(/^\d{2}:\d{2}$/);
    expect(moon.setLocalTime).toMatch(/^\d{2}:\d{2}$/);
    expect(moon.phaseDegrees).toBeGreaterThan(180);
  });
});
