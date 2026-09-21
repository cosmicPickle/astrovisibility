import { createBlockedBitset } from '../mask/rasterMask';
import type { ObstructionVisibilityInput } from '../astronomy/obstructionVisibility';
import { calculateCatalogueVisibility } from './catalogueVisibility';

const start = Date.parse('2026-01-01T00:00:00Z');
const interval = (from: number, to: number) => ({
  startTimestampUtc: new Date(start + from * 3_600_000).toISOString(),
  endTimestampUtc: new Date(start + to * 3_600_000).toISOString(),
  durationMilliseconds: (to - from) * 3_600_000,
});
const input: ObstructionVisibilityInput = {
  profileId: 'synthetic',
  panoramaRevisionId: 'p',
  timeZoneId: 'UTC',
  target: { id: 't', rightAscensionJ2000Hours: 1, declinationJ2000Degrees: 20 },
  observer: {
    latitudeDegreesNorth: 42,
    longitudeDegreesEast: 0,
    elevationMetersAboveMeanSeaLevel: 0,
  },
  window: interval(0, 24),
  maskRevision: {
    id: 'm',
    panoramaRevisionId: 'p',
    mask: {
      coveragePolygons: [],
      operations: [],
      raster: {
        widthPixels: 32,
        heightPixels: 32,
        uri: 'synthetic',
        blockedBitset: createBlockedBitset(32, 32, false),
      },
    },
  },
};
const project = (timestamp: number) => ({
  azimuthDegreesClockwiseFromNorth: 0,
  refractedAltitudeDegrees:
    timestamp >= start + 2 * 3_600_000 && timestamp < start + 4 * 3_600_000
      ? -20
      : 20,
});

it('keeps whole-window horizon eligibility but assesses the mask only in dark above-horizon intervals', async () => {
  const projectAtMilliseconds = jest.fn(project);
  const result = await calculateCatalogueVisibility(
    input,
    [interval(1, 3), interval(5, 6)],
    {
      projectAtMilliseconds,
      yieldToEventLoop: async () => undefined,
    },
  );
  expect(result.aboveHorizonIntervals).toEqual([
    interval(0, 2),
    interval(4, 24),
  ]);
  expect(result.totalAboveHorizonMilliseconds).toBe(22 * 3_600_000);
  expect(result.visibilityIntervals).toEqual([interval(1, 2), interval(5, 6)]);
  expect(result.totalVisibleMilliseconds).toBe(2 * 3_600_000);
  expect(projectAtMilliseconds.mock.calls.length).toBeLessThan(240);
});

it('retains above-horizon zero-dark-time targets and unassessed no-mask semantics', async () => {
  const result = await calculateCatalogueVisibility(input, [], {
    projectAtMilliseconds: project,
  });
  expect(result.totalAboveHorizonMilliseconds).toBe(22 * 3_600_000);
  expect(result.totalVisibleMilliseconds).toBe(0);
  const unassessed = await calculateCatalogueVisibility(
    { ...input, maskRevision: null },
    [interval(1, 3)],
    { projectAtMilliseconds: project },
  );
  expect(unassessed.visibilityIntervals).toEqual([]);
  expect(unassessed.totalAboveHorizonMilliseconds).toBe(22 * 3_600_000);
});
