import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSkyTargetDurations } from './useSkyTargetDurations';
import { calculateCachedRankedTargets } from './cachedRankedTargets';
import type {
  RankedTargetCalculationInput,
  RankedTargetProgress,
} from './rankedTargetCalculation';

jest.mock('./cachedRankedTargets', () => ({
  calculateCachedRankedTargets: jest.fn(),
}));
const calculate = jest.mocked(calculateCachedRankedTargets);
const input: RankedTargetCalculationInput = {
  equipment: null,
  maskRevision: null,
  panoramaRevisionId: null,
  profileId: 'fixture',
  targets: [],
  observer: {
    latitudeDegreesNorth: 40,
    longitudeDegreesEast: 20,
    elevationMetersAboveMeanSeaLevel: 0,
  },
  timeZoneId: 'UTC',
  window: {
    startTimestampUtc: '2026-09-17T18:00:00Z',
    endTimestampUtc: '2026-09-18T06:00:00Z',
  },
};
const progress: RankedTargetProgress = {
  complete: true,
  eligibleTargetCount: 0,
  processedCount: 0,
  rejectedByEquipmentCount: 0,
  results: [],
  totalCatalogueCount: 0,
};
beforeEach(() => calculate.mockReset());

it('runs only when needed, reuses results for limit edits, and aborts on context change', async () => {
  calculate.mockImplementation(async (_input, _cache, options) => {
    options.onProgress?.(progress);
    return [];
  });
  const hook = await renderHook(
    ({
      enabled,
      calculationInput,
    }: {
      enabled: boolean;
      calculationInput: RankedTargetCalculationInput;
    }) => useSkyTargetDurations(calculationInput, undefined, enabled),
    { initialProps: { enabled: false, calculationInput: input } },
  );
  expect(calculate).not.toHaveBeenCalled();
  await hook.rerender({ enabled: true, calculationInput: input });
  await waitFor(() => expect(hook.result.current.status).toBe('complete'));
  await hook.rerender({ enabled: true, calculationInput: input });
  expect(calculate).toHaveBeenCalledTimes(1);
  const signal = calculate.mock.calls[0]![2].signal;
  await hook.rerender({
    enabled: true,
    calculationInput: { ...input, panoramaRevisionId: 'changed' },
  });
  expect(signal?.aborted).toBe(true);
  await waitFor(() => expect(calculate).toHaveBeenCalledTimes(2));
  await hook.unmount();
});

it('reports failures and retries without admitting uncalculated results', async () => {
  calculate
    .mockRejectedValueOnce(new Error('fixture failure'))
    .mockResolvedValue([]);
  const hook = await renderHook(() =>
    useSkyTargetDurations(input, undefined, true),
  );
  await waitFor(() => expect(hook.result.current.status).toBe('error'));
  expect(hook.result.current.results).toEqual([]);
  await act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.status).toBe('complete'));
  expect(calculate).toHaveBeenCalledTimes(2);
});
