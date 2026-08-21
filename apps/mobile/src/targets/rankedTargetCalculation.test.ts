import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { VisibilityCalculationCache } from '../astronomy/obstructionVisibility';
import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import {
  calculateRankedTargetsProgressively,
  compareRankedTargets,
  TargetListCalculationCancelledError,
  type RankedTarget,
} from './rankedTargetCalculation';

const interval = (startMinutes: number, endMinutes: number) => ({
  startTimestampUtc: new Date(
    Date.parse('2026-01-01T00:00:00.000Z') + startMinutes * 60_000,
  ).toISOString(),
  endTimestampUtc: new Date(
    Date.parse('2026-01-01T00:00:00.000Z') + endMinutes * 60_000,
  ).toISOString(),
  durationMilliseconds: (endMinutes - startMinutes) * 60_000,
});

const catalogueTarget = (
  id: string,
  preferredName: string,
  prominenceTier = 2,
  dimensions: Partial<
    Pick<CatalogueTarget, 'majorAxisArcminutes' | 'minorAxisArcminutes'>
  > = { majorAxisArcminutes: 60, minorAxisArcminutes: 30 },
): CatalogueTarget => ({
  id,
  preferredName,
  aliases: [],
  rightAscensionJ2000Hours: 1,
  declinationJ2000Degrees: 2,
  constellation: 'And',
  objectType: 'Galaxy',
  ...dimensions,
  memberships: { messier: [], ngc: [id], ic: [] },
  prominenceTier: prominenceTier as 1 | 2 | 3 | 4,
});

const trajectory = (
  aboveHorizonIntervals: SelectedTargetTrajectory['aboveHorizonIntervals'],
  visibilityIntervals: SelectedTargetTrajectory['visibilityIntervals'],
): SelectedTargetTrajectory => ({
  samples: [],
  markers: [],
  aboveHorizonIntervals,
  visibilityIntervals,
  blockedIntervals: [],
  transitions: [],
  totalAboveHorizonMilliseconds: aboveHorizonIntervals.reduce(
    (total, item) => total + item.durationMilliseconds,
    0,
  ),
  totalVisibleMilliseconds: visibilityIntervals.reduce(
    (total, item) => total + item.durationMilliseconds,
    0,
  ),
});

const ranked = (
  target: CatalogueTarget,
  totalDurationMinutes: number,
  longestIntervalMinutes: number,
): RankedTarget => ({
  target,
  durationKind: 'visible',
  intervals: [interval(0, longestIntervalMinutes)],
  totalDurationMilliseconds: totalDurationMinutes * 60_000,
  longestIntervalMilliseconds: longestIntervalMinutes * 60_000,
  suitability: null,
});

const equipment: EquipmentRecord = {
  id: 'equipment-1',
  name: 'Wide field',
  focalLengthMillimeters: 400,
  apertureMillimeters: 80,
  sensorWidthMillimeters: 36,
  sensorHeightMillimeters: 24,
  pixelSizeMicrometers: 4,
  frameRotationDegrees: 0,
  createdAtUtc: '2026-01-01T00:00:00.000Z',
  updatedAtUtc: '2026-01-01T00:00:00.000Z',
};

const baseInput = {
  profileId: 'profile-1',
  observer: {
    latitudeDegreesNorth: 42.7,
    longitudeDegreesEast: 23.3,
    elevationMetersAboveMeanSeaLevel: 550,
  },
  timeZoneId: 'Europe/Sofia',
  window: {
    startTimestampUtc: '2026-01-01T00:00:00.000Z',
    endTimestampUtc: '2026-01-01T02:00:00.000Z',
  },
  panoramaRevisionId: null,
  maskRevision: null,
  equipment: null,
} as const;

describe('ranked target ordering', () => {
  it('puts unknown sizes last, then sorts known sizes by dark duration and angular area', () => {
    const results = [
      ranked(catalogueTarget('small', 'Small', 2), 50, 30),
      ranked(
        catalogueTarget('large', 'Large', 2, {
          majorAxisArcminutes: 120,
          minorAxisArcminutes: 60,
        }),
        50,
        20,
      ),
      ranked(catalogueTarget('long', 'Long', 2), 60, 10),
      ranked(catalogueTarget('unknown', 'Unknown', 1, {}), 120, 120),
    ].sort(compareRankedTargets);

    expect(results.map(({ target }) => target.id)).toEqual([
      'long',
      'large',
      'small',
      'unknown',
    ]);
  });
});

describe('progressive all-target calculation', () => {
  it('retains every visibility interval, excludes never-rising targets, and publishes sorted batches', async () => {
    const targets = [
      catalogueTarget('target-a', 'A'),
      catalogueTarget('target-b', 'B'),
      catalogueTarget('target-c', 'C'),
    ];
    const calculations = {
      'target-a': trajectory(
        [interval(0, 60)],
        [interval(0, 20), interval(30, 60)],
      ),
      'target-b': trajectory([interval(0, 120)], [interval(0, 80)]),
      'target-c': trajectory([], []),
    } as const;
    const batches: string[][] = [];

    const results = await calculateRankedTargetsProgressively(
      {
        ...baseInput,
        maskRevision: {
          id: 'mask-1',
          profileId: 'profile-1',
          panoramaRevisionId: 'panorama-1',
          formatVersion: 1,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          coveragePolygons: [],
          operations: [],
        },
        panoramaRevisionId: 'panorama-1',
        targets,
      },
      {
        batchSize: 2,
        cache: new VisibilityCalculationCache(),
        calculateVisibility: async (input) =>
          calculations[input.target.id as keyof typeof calculations],
        onProgress: (progress) =>
          batches.push(progress.results.map(({ target }) => target.id)),
        yieldToEventLoop: async () => undefined,
      },
    );

    expect(results.map(({ target }) => target.id)).toEqual([
      'target-b',
      'target-a',
    ]);
    expect(results[1]!.intervals).toEqual([interval(0, 20), interval(30, 60)]);
    expect(batches.at(-1)).toEqual(['target-b', 'target-a']);
  });

  it('ranks and reports only the astronomical-dark portion of local visibility', async () => {
    const results = await calculateRankedTargetsProgressively(
      {
        ...baseInput,
        maskRevision: {
          id: 'mask-1',
          profileId: 'profile-1',
          panoramaRevisionId: 'panorama-1',
          formatVersion: 1,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          coveragePolygons: [],
          operations: [],
        },
        panoramaRevisionId: 'panorama-1',
        targets: [catalogueTarget('target-a', 'A')],
      },
      {
        astronomicalDarknessIntervals: [interval(15, 45)],
        cache: new VisibilityCalculationCache(),
        calculateVisibility: async () =>
          trajectory([interval(0, 60)], [interval(0, 20), interval(30, 60)]),
        yieldToEventLoop: async () => undefined,
      },
    );

    expect(results[0]!.intervals).toEqual([interval(15, 20), interval(30, 45)]);
    expect(results[0]!.totalDurationMilliseconds).toBe(20 * 60_000);
  });

  it('uses above-horizon duration and truthful unassessed semantics when no mask exists', async () => {
    const results = await calculateRankedTargetsProgressively(
      { ...baseInput, targets: [catalogueTarget('target-a', 'A')] },
      {
        cache: new VisibilityCalculationCache(),
        calculateVisibility: async () =>
          trajectory([interval(0, 20), interval(30, 60)], []),
        yieldToEventLoop: async () => undefined,
      },
    );

    expect(results[0]).toMatchObject({
      durationKind: 'aboveHorizonUnassessed',
      totalDurationMilliseconds: 50 * 60_000,
    });
    expect(results[0]!.intervals).toEqual([interval(0, 20), interval(30, 60)]);
  });

  it('does not construct or probe cache entries when the trajectory cache is empty', async () => {
    const emptyCache = {
      size: 0,
      get: jest.fn(() => null),
      set: jest.fn(),
    };

    await calculateRankedTargetsProgressively(
      { ...baseInput, targets: [catalogueTarget('target-a', 'A')] },
      {
        cache: emptyCache,
        calculateVisibility: async () => trajectory([interval(0, 20)], []),
        yieldToEventLoop: async () => undefined,
      },
    );

    expect(emptyCache.get).not.toHaveBeenCalled();
    expect(emptyCache.set).toHaveBeenCalledTimes(1);
  });

  it('applies equipment suitability before expensive visibility work while retaining unknown sizes', async () => {
    const visibilityCalls: string[] = [];
    const targets = [
      catalogueTarget('suitable', 'Suitable'),
      catalogueTarget('too-large', 'Too large', 2, {
        majorAxisArcminutes: 500,
        minorAxisArcminutes: 400,
      }),
      catalogueTarget('unknown', 'Unknown', 2, {}),
    ];

    const results = await calculateRankedTargetsProgressively(
      { ...baseInput, equipment, targets },
      {
        cache: new VisibilityCalculationCache(),
        calculateVisibility: async (input) => {
          visibilityCalls.push(input.target.id);
          return trajectory([interval(0, 60)], []);
        },
        yieldToEventLoop: async () => undefined,
      },
    );

    expect(visibilityCalls).toEqual(['suitable', 'unknown']);
    expect(results.map(({ target }) => target.id)).toEqual([
      'suitable',
      'unknown',
    ]);
    expect(results[1]!.suitability?.reason).toBe('sizeUnknown');
  });

  it('cooperatively cancels before publishing work after the aborted batch', async () => {
    const controller = new AbortController();
    const progress: number[] = [];
    let calls = 0;
    const calculation = calculateRankedTargetsProgressively(
      {
        ...baseInput,
        targets: [
          catalogueTarget('target-a', 'A'),
          catalogueTarget('target-b', 'B'),
          catalogueTarget('target-c', 'C'),
        ],
      },
      {
        batchSize: 1,
        cache: new VisibilityCalculationCache(),
        calculateVisibility: async () => {
          calls += 1;
          return trajectory([interval(0, 60)], []);
        },
        onProgress: ({ processedCount }) => {
          progress.push(processedCount);
          controller.abort();
        },
        signal: controller.signal,
        yieldToEventLoop: async () => undefined,
      },
    );

    await expect(calculation).rejects.toBeInstanceOf(
      TargetListCalculationCancelledError,
    );
    expect(calls).toBe(1);
    expect(progress).toEqual([1]);
  });
});
