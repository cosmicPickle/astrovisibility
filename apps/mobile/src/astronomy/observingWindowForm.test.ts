import {
  createCustomWindowFromForm,
  parseLocalCivilDate,
  parseLocalCivilTime,
} from './observingWindowForm';

describe('observingWindowForm', () => {
  it('parses strict local date and time values', () => {
    expect(parseLocalCivilDate('2026-08-19')).toEqual({
      year: 2026,
      month: 8,
      day: 19,
    });
    expect(parseLocalCivilTime('22:30')).toEqual({ hour: 22, minute: 30 });
    expect(parseLocalCivilDate('2026-02-30')).toBeNull();
    expect(parseLocalCivilTime('24:00')).toBeNull();
  });

  it('creates an explicit cross-midnight UTC interval in the profile timezone', () => {
    expect(
      createCustomWindowFromForm({
        timeZoneId: 'Europe/Sofia',
        startDate: '2026-08-19',
        startTime: '22:00',
        endDate: '2026-08-20',
        endTime: '02:30',
        startAmbiguity: 'earlier',
        endAmbiguity: 'later',
      }),
    ).toEqual({
      success: true,
      window: {
        kind: 'custom',
        startTimestampUtc: '2026-08-19T19:00:00.000Z',
        endTimestampUtc: '2026-08-19T23:30:00.000Z',
        note: null,
        warnings: [],
      },
    });
  });

  it('returns field-specific errors before resolving civil time', () => {
    expect(
      createCustomWindowFromForm({
        timeZoneId: 'Europe/Sofia',
        startDate: 'bad',
        startTime: '22:00',
        endDate: '2026-08-20',
        endTime: '02:30',
      }),
    ).toEqual({ success: false, issue: 'invalidStartDate' });
  });
});
