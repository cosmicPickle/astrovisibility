import {
  consumeSkySelectionHandoff,
  publishSkySelectionHandoff,
} from './skySelectionHandoff';

describe('target-list to Sky selection handoff', () => {
  it('is profile-scoped and consumed exactly once', () => {
    publishSkySelectionHandoff({
      profileId: 'profile-1',
      targetId: 'NGC0224',
      window: {
        startTimestampUtc: '2026-01-01T18:00:00.000Z',
        endTimestampUtc: '2026-01-02T06:00:00.000Z',
      },
    });

    expect(consumeSkySelectionHandoff('profile-2')).toBeNull();
    expect(consumeSkySelectionHandoff('profile-1')).toEqual({
      profileId: 'profile-1',
      targetId: 'NGC0224',
      window: {
        startTimestampUtc: '2026-01-01T18:00:00.000Z',
        endTimestampUtc: '2026-01-02T06:00:00.000Z',
      },
    });
    expect(consumeSkySelectionHandoff('profile-1')).toBeNull();
  });
});
