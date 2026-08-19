import { createVisibilityMask } from '../mask/visibilityMask';
import type { HorizontalCoordinates } from './horizontalCoordinates';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  createVisibilityCalculationCacheKey,
  VisibilityCalculationCache,
  VisibilityCalculationCancelledError,
  type ObstructionVisibilityInput,
} from './obstructionVisibility';

const startTimestampUtc = '2026-01-01T00:00:00.000Z';
const endTimestampUtc = '2026-01-01T00:10:00.000Z';
const startMilliseconds = Date.parse(startTimestampUtc);

const completeCoverage = [
  [
    { azimuthDegrees: 350, altitudeDegrees: 0 },
    { azimuthDegrees: 370, altitudeDegrees: 0 },
    { azimuthDegrees: 370, altitudeDegrees: 40 },
    { azimuthDegrees: 350, altitudeDegrees: 40 },
  ],
] as const;

const fullVisibleRegion = {
  id: 'visible-region',
  kind: 'visiblePolygon' as const,
  points: [
    { azimuthDegrees: 350, altitudeDegrees: 0 },
    { azimuthDegrees: 370, altitudeDegrees: 0 },
    { azimuthDegrees: 370, altitudeDegrees: 40 },
    { azimuthDegrees: 350, altitudeDegrees: 40 },
  ],
};

const baseMask = createVisibilityMask(completeCoverage, [fullVisibleRegion]);

const baseInput = (
  overrides: Partial<ObstructionVisibilityInput> = {},
): ObstructionVisibilityInput => ({
  profileId: 'profile-1',
  target: {
    id: 'target-1',
    rightAscensionJ2000Hours: 1,
    declinationJ2000Degrees: 2,
  },
  observer: {
    latitudeDegreesNorth: 42.7,
    longitudeDegreesEast: 23.3,
    elevationMetersAboveMeanSeaLevel: 550,
  },
  timeZoneId: 'UTC',
  window: { startTimestampUtc, endTimestampUtc },
  panoramaRevisionId: 'panorama-1',
  maskRevision: {
    id: 'mask-1',
    panoramaRevisionId: 'panorama-1',
    mask: baseMask,
  },
  ...overrides,
});

const linearProjector =
  (
    startAzimuthDegrees: number,
    endAzimuthDegrees: number,
    altitudeDegrees = 20,
  ) =>
  (timestampUtc: string): HorizontalCoordinates => {
    const progress =
      (Date.parse(timestampUtc) - startMilliseconds) /
      (Date.parse(endTimestampUtc) - startMilliseconds);
    return {
      azimuthDegreesClockwiseFromNorth:
        startAzimuthDegrees +
        (endAzimuthDegrees - startAzimuthDegrees) * progress,
      refractedAltitudeDegrees: altitudeDegrees,
    };
  };

describe('obstruction-aware trajectory classification', () => {
  it('produces the same ranked-list interval summary without render allocations', async () => {
    const input = baseInput();
    const projectAt = linearProjector(352, 368);
    const full = await calculateObstructionAwareTrajectory(input, {
      projectAt,
    });
    const summary = calculateObstructionVisibilitySummary(input, { projectAt });

    expect(summary).toEqual({
      aboveHorizonIntervals: full.aboveHorizonIntervals,
      visibilityIntervals: full.visibilityIntervals,
      totalAboveHorizonMilliseconds: full.totalAboveHorizonMilliseconds,
      totalVisibleMilliseconds: full.totalVisibleMilliseconds,
    });
  });

  it('keeps a fully visible path as one interval with zero obstruction crossings', async () => {
    const result = await calculateObstructionAwareTrajectory(baseInput(), {
      projectAt: linearProjector(352, 368),
    });

    expect(result.transitions).toEqual([]);
    expect(result.visibilityIntervals).toEqual([
      {
        startTimestampUtc,
        endTimestampUtc,
        durationMilliseconds: 10 * 60 * 1000,
      },
    ]);
    expect(result.blockedIntervals).toEqual([]);
    expect(result.totalVisibleMilliseconds).toBe(10 * 60 * 1000);
    for (let index = 1; index < result.samples.length; index += 1) {
      const previous = result.samples[index - 1]!;
      const current = result.samples[index]!;
      expect(
        Date.parse(current.timestampUtc) - Date.parse(previous.timestampUtc),
      ).toBeLessThanOrEqual(30_000);
      expect(
        Math.abs(
          current.unwrappedAzimuthDegrees - previous.unwrappedAzimuthDegrees,
        ),
      ).toBeLessThanOrEqual(0.05);
    }
  });

  it('resolves one crossing within 30 seconds and rounds its visible-until label to the nearest minute', async () => {
    const mask = createVisibilityMask(completeCoverage, [
      {
        ...fullVisibleRegion,
        points: [
          { azimuthDegrees: 350, altitudeDegrees: 0 },
          { azimuthDegrees: 359.1, altitudeDegrees: 0 },
          { azimuthDegrees: 359.1, altitudeDegrees: 40 },
          { azimuthDegrees: 350, altitudeDegrees: 40 },
        ],
      },
    ]);
    const result = await calculateObstructionAwareTrajectory(
      baseInput({
        maskRevision: {
          id: 'mask-one-crossing',
          panoramaRevisionId: 'panorama-1',
          mask,
        },
      }),
      { projectAt: linearProjector(354, 365) },
    );

    expect(result.transitions).toHaveLength(1);
    const crossing = result.transitions[0]!;
    expect(crossing.kind).toBe('becameBlocked');
    expect(
      Math.abs(
        Date.parse(crossing.timestampUtc) - (startMilliseconds + 278_182),
      ),
    ).toBeLessThanOrEqual(30_000);
    expect(crossing.localTimeLabel).toBe('00:05');
    expect(crossing.displayLabel).toBe('Visible until 00:05');
  });

  it('preserves multiple branch crossings and a short real blocked gap', async () => {
    const mask = createVisibilityMask(completeCoverage, [
      fullVisibleRegion,
      {
        id: 'branch-one',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.5,
        points: [{ azimuthDegrees: 356, altitudeDegrees: 20 }],
      },
      {
        id: 'branch-two',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.45,
        points: [{ azimuthDegrees: 364, altitudeDegrees: 20 }],
      },
    ]);
    const result = await calculateObstructionAwareTrajectory(
      baseInput({
        maskRevision: {
          id: 'mask-branches',
          panoramaRevisionId: 'panorama-1',
          mask,
        },
      }),
      { projectAt: linearProjector(352, 368) },
    );

    expect(result.transitions.map(({ kind }) => kind)).toEqual([
      'becameBlocked',
      'becameVisible',
      'becameBlocked',
      'becameVisible',
    ]);
    expect(result.visibilityIntervals).toHaveLength(3);
    expect(result.blockedIntervals).toHaveLength(2);
    expect(result.blockedIntervals[1]!.durationMilliseconds).toBeGreaterThan(
      30_000,
    );
  });

  it('treats a path tangent to an inclusive polygon boundary as visible without flicker', async () => {
    const result = await calculateObstructionAwareTrajectory(baseInput(), {
      projectAt: linearProjector(352, 368, 40),
    });

    expect(result.transitions).toEqual([]);
    expect(result.visibilityIntervals).toHaveLength(1);
    expect(
      result.samples.every(({ assessment }) => assessment === 'visible'),
    ).toBe(true);
  });

  it('classifies continuously through the north seam without a drawing or interval split', async () => {
    const result = await calculateObstructionAwareTrajectory(baseInput(), {
      projectAt: linearProjector(358, 362),
    });

    expect(result.transitions).toEqual([]);
    expect(result.visibilityIntervals).toHaveLength(1);
    expect(result.samples.at(-1)?.unwrappedAzimuthDegrees).toBeGreaterThan(360);
  });

  it('blocks every above-horizon direction outside completed partial coverage', async () => {
    const result = await calculateObstructionAwareTrajectory(baseInput(), {
      projectAt: linearProjector(345, 349),
    });

    expect(result.visibilityIntervals).toEqual([]);
    expect(result.blockedIntervals).toEqual([
      {
        startTimestampUtc,
        endTimestampUtc,
        durationMilliseconds: 10 * 60 * 1000,
      },
    ]);
    expect(
      result.samples.every(({ assessment }) => assessment === 'blocked'),
    ).toBe(true);
  });

  it('keeps an above-horizon no-mask path unassessed with no obstruction intervals or labels', async () => {
    const result = await calculateObstructionAwareTrajectory(
      baseInput({ maskRevision: null, panoramaRevisionId: null }),
      { projectAt: linearProjector(352, 368) },
    );

    expect(
      result.samples.every(({ assessment }) => assessment === 'unassessed'),
    ).toBe(true);
    expect(result.visibilityIntervals).toEqual([]);
    expect(result.blockedIntervals).toEqual([]);
    expect(result.transitions).toEqual([]);
    expect(result.totalVisibleMilliseconds).toBe(0);
  });

  it('cooperatively yields and rejects cancellation without publishing a partial result', async () => {
    const controller = new AbortController();
    let yieldCount = 0;
    const calculation = calculateObstructionAwareTrajectory(baseInput(), {
      projectAt: linearProjector(352, 368),
      signal: controller.signal,
      yieldEverySamples: 1,
      yieldToEventLoop: async () => {
        yieldCount += 1;
        controller.abort();
      },
    });

    await expect(calculation).rejects.toBeInstanceOf(
      VisibilityCalculationCancelledError,
    );
    expect(yieldCount).toBe(1);
  });

  it('keeps a representative twelve-hour production calculation within the selected-target CPU budget', async () => {
    const startedAt = performance.now();
    const result = await calculateObstructionAwareTrajectory(
      baseInput({
        window: {
          startTimestampUtc: '2026-01-01T18:00:00.000Z',
          endTimestampUtc: '2026-01-02T06:00:00.000Z',
        },
      }),
      { yieldToEventLoop: async () => undefined },
    );
    const durationMilliseconds = performance.now() - startedAt;

    expect(result.samples.length).toBeGreaterThan(1_000);
    expect(durationMilliseconds).toBeLessThan(500);
  });
});

describe('visibility calculation cache identity and invalidation', () => {
  it.each([
    [
      'profile location',
      { observer: { ...baseInput().observer, latitudeDegreesNorth: 43 } },
    ],
    ['timezone', { timeZoneId: 'Europe/Sofia' }],
    [
      'observing interval',
      {
        window: {
          startTimestampUtc,
          endTimestampUtc: '2026-01-01T00:11:00.000Z',
        },
      },
    ],
    ['target identity', { target: { ...baseInput().target, id: 'target-2' } }],
    [
      'target coordinates',
      { target: { ...baseInput().target, declinationJ2000Degrees: 3 } },
    ],
    ['panorama revision', { panoramaRevisionId: 'panorama-2' }],
    [
      'mask revision',
      { maskRevision: { ...baseInput().maskRevision!, id: 'mask-2' } },
    ],
  ] as const)('changes when %s changes', (_label, overrides) => {
    expect(createVisibilityCalculationCacheKey(baseInput(overrides))).not.toBe(
      createVisibilityCalculationCacheKey(baseInput()),
    );
  });

  it('includes explicit adapter/calculation versions and excludes visual panorama opacity', () => {
    const key = createVisibilityCalculationCacheKey(baseInput());
    expect(key).toContain('astronomy-engine-2.1.19');
    expect(key).toContain('obstruction-visibility-v1');
    expect(key).not.toContain('opacity');
  });

  it('does not return a stale result after a mask edit and supports profile-family invalidation', async () => {
    const cache = new VisibilityCalculationCache(2);
    const oldInput = baseInput();
    const newInput = baseInput({
      maskRevision: { ...baseInput().maskRevision!, id: 'mask-edited' },
    });
    const oldResult = await calculateObstructionAwareTrajectory(oldInput, {
      projectAt: linearProjector(352, 368),
    });
    cache.set(createVisibilityCalculationCacheKey(oldInput), oldResult);

    expect(cache.get(createVisibilityCalculationCacheKey(newInput))).toBeNull();
    cache.set(createVisibilityCalculationCacheKey(newInput), oldResult);
    cache.invalidateProfile('profile-1');
    expect(cache.size).toBe(0);
  });
});
