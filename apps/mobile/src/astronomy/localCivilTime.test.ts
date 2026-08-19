import {
  createCustomObservingWindow,
  resolveLocalCivilDateTime,
} from './localCivilTime';

describe('local civil time', () => {
  it('resolves local midnight through an IANA timezone into an explicit UTC instant', () => {
    expect(
      resolveLocalCivilDateTime(
        { year: 2026, month: 8, day: 19, hour: 0, minute: 0 },
        'Europe/Sofia',
      ),
    ).toEqual({
      kind: 'unique',
      timestampUtc: '2026-08-18T21:00:00.000Z',
    });
  });

  it('preserves non-hour IANA offsets', () => {
    expect(
      resolveLocalCivilDateTime(
        { year: 2026, month: 1, day: 5, hour: 0, minute: 0 },
        'Asia/Kathmandu',
      ),
    ).toEqual({
      kind: 'unique',
      timestampUtc: '2026-01-04T18:15:00.000Z',
    });
  });

  it('detects a spring-forward gap instead of changing the requested wall time', () => {
    expect(
      resolveLocalCivilDateTime(
        { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
        'America/New_York',
      ),
    ).toEqual({ kind: 'gap' });
  });

  it('returns both fall-back instants in chronological order', () => {
    expect(
      resolveLocalCivilDateTime(
        { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
        'America/New_York',
      ),
    ).toEqual({
      kind: 'ambiguous',
      earlierTimestampUtc: '2026-11-01T05:30:00.000Z',
      laterTimestampUtc: '2026-11-01T06:30:00.000Z',
    });
  });

  it('requires explicit ambiguity choices and rejects gaps and intervals over 24 hours', () => {
    const ambiguousStart = createCustomObservingWindow({
      timeZoneId: 'America/New_York',
      start: { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      end: { year: 2026, month: 11, day: 1, hour: 2, minute: 30 },
    });
    expect(ambiguousStart).toEqual({
      success: false,
      issue: 'startAmbiguous',
      candidatesUtc: ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'],
    });

    expect(
      createCustomObservingWindow({
        timeZoneId: 'America/New_York',
        start: { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
        end: { year: 2026, month: 3, day: 8, hour: 4, minute: 0 },
      }),
    ).toEqual({ success: false, issue: 'startGap' });

    expect(
      createCustomObservingWindow({
        timeZoneId: 'UTC',
        start: { year: 2026, month: 1, day: 1, hour: 18, minute: 0 },
        end: { year: 2026, month: 1, day: 2, hour: 18, minute: 1 },
      }),
    ).toEqual({ success: false, issue: 'durationExceeds24Hours' });
  });

  it('uses the selected repeated-time occurrence and measures the real elapsed duration', () => {
    expect(
      createCustomObservingWindow({
        timeZoneId: 'America/New_York',
        start: { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
        startAmbiguity: 'later',
        end: { year: 2026, month: 11, day: 1, hour: 2, minute: 30 },
      }),
    ).toEqual({
      success: true,
      window: {
        kind: 'custom',
        startTimestampUtc: '2026-11-01T06:30:00.000Z',
        endTimestampUtc: '2026-11-01T07:30:00.000Z',
        note: null,
        warnings: [],
      },
    });
  });

  it('rejects an invalid civil calendar date', () => {
    expect(() =>
      resolveLocalCivilDateTime(
        { year: 2026, month: 2, day: 30, hour: 20, minute: 0 },
        'UTC',
      ),
    ).toThrow('Invalid local civil date/time');
  });
});
