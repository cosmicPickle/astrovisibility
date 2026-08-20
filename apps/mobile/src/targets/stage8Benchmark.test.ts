import catalogue from '../catalogue/generated/catalogue.json';
import { VisibilityCalculationCache } from '../astronomy/obstructionVisibility';
import { createVisibilityMask } from '../mask/visibilityMask';
import { calculateRankedTargetsProgressively } from './rankedTargetCalculation';

const REFERENCE_DESKTOP_BUDGET_MILLISECONDS = 5_000;
// GitHub's shared hosted runners do not provide reference-device CPU
// performance. Keep a bounded CI regression guard while preserving the actual
// five-second product budget on developer/reference desktop measurements.
const performanceBudgetMilliseconds = process.env.CI
  ? 10_000
  : REFERENCE_DESKTOP_BUDGET_MILLISECONDS;

it('calculates the full production catalogue within the Stage 8 desktop guardrail', async () => {
  const targets = catalogue.targets;
  const startedAt = performance.now();
  const result = await calculateRankedTargetsProgressively(
    {
      equipment: null,
      maskRevision: null,
      observer: {
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
        elevationMetersAboveMeanSeaLevel: 550,
      },
      panoramaRevisionId: null,
      profileId: 'benchmark',
      targets,
      timeZoneId: 'Europe/Sofia',
      window: {
        startTimestampUtc: '2026-08-19T18:00:00.000Z',
        endTimestampUtc: '2026-08-20T06:00:00.000Z',
      },
    },
    { cache: new VisibilityCalculationCache(100) },
  );
  const durationMilliseconds = performance.now() - startedAt;
  expect(result.length).toBeGreaterThan(1_000);
  expect(durationMilliseconds).toBeLessThan(performanceBudgetMilliseconds);
}, 10_000);

it('keeps the first representative-mask batch inside the one-second budget', async () => {
  const mask = createVisibilityMask(
    [
      [
        { azimuthDegrees: 150, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 60 },
        { azimuthDegrees: 150, altitudeDegrees: 60 },
      ],
    ],
    [
      {
        id: 'visible',
        kind: 'visiblePolygon',
        points: [
          { azimuthDegrees: 150, altitudeDegrees: 15 },
          { azimuthDegrees: 210, altitudeDegrees: 15 },
          { azimuthDegrees: 210, altitudeDegrees: 60 },
          { azimuthDegrees: 150, altitudeDegrees: 60 },
        ],
      },
      {
        id: 'branch',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.2,
        points: [
          { azimuthDegrees: 175, altitudeDegrees: 15 },
          { azimuthDegrees: 180, altitudeDegrees: 50 },
        ],
      },
    ],
  );
  const startedAt = performance.now();
  await calculateRankedTargetsProgressively(
    {
      equipment: {
        id: 'equipment-1',
        name: '400 mm full-frame refractor',
        focalLengthMillimeters: 400,
        apertureMillimeters: 80,
        sensorWidthMillimeters: 36,
        sensorHeightMillimeters: 24,
        pixelSizeMicrometers: 4,
        frameRotationDegrees: 0,
        createdAtUtc: '2026-08-19T12:00:00.000Z',
        updatedAtUtc: '2026-08-19T12:00:00.000Z',
      },
      maskRevision: {
        ...mask,
        id: 'mask-1',
        profileId: 'benchmark',
        panoramaRevisionId: 'panorama-1',
        formatVersion: 1,
        createdAtUtc: '2026-08-19T12:00:00.000Z',
      },
      observer: {
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
        elevationMetersAboveMeanSeaLevel: 550,
      },
      panoramaRevisionId: 'panorama-1',
      profileId: 'benchmark',
      targets: catalogue.targets.slice(0, 256),
      timeZoneId: 'Europe/Sofia',
      window: {
        startTimestampUtc: '2026-08-19T18:00:00.000Z',
        endTimestampUtc: '2026-08-20T06:00:00.000Z',
      },
    },
    { yieldToEventLoop: async () => undefined },
  );
  expect(performance.now() - startedAt).toBeLessThan(1_000);
});

it('completes the production catalogue with a representative mask inside the Stage 9 budget', async () => {
  const mask = createVisibilityMask(
    [
      [
        { azimuthDegrees: 150, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 60 },
        { azimuthDegrees: 150, altitudeDegrees: 60 },
      ],
    ],
    [
      {
        id: 'visible',
        kind: 'visiblePolygon',
        points: [
          { azimuthDegrees: 150, altitudeDegrees: 15 },
          { azimuthDegrees: 210, altitudeDegrees: 15 },
          { azimuthDegrees: 210, altitudeDegrees: 60 },
          { azimuthDegrees: 150, altitudeDegrees: 60 },
        ],
      },
      {
        id: 'branch',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.2,
        points: [
          { azimuthDegrees: 175, altitudeDegrees: 15 },
          { azimuthDegrees: 180, altitudeDegrees: 50 },
        ],
      },
    ],
  );
  const startedAt = performance.now();
  const results = await calculateRankedTargetsProgressively(
    {
      equipment: null,
      maskRevision: {
        ...mask,
        id: 'mask-full-catalogue',
        profileId: 'benchmark',
        panoramaRevisionId: 'panorama-1',
        formatVersion: 1,
        createdAtUtc: '2026-08-19T12:00:00.000Z',
      },
      observer: {
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
        elevationMetersAboveMeanSeaLevel: 550,
      },
      panoramaRevisionId: 'panorama-1',
      profileId: 'benchmark',
      targets: catalogue.targets,
      timeZoneId: 'Europe/Sofia',
      window: {
        startTimestampUtc: '2026-08-19T18:00:00.000Z',
        endTimestampUtc: '2026-08-20T06:00:00.000Z',
      },
    },
    {
      cache: new VisibilityCalculationCache(100),
      yieldToEventLoop: async () => undefined,
    },
  );

  expect(results.length).toBeGreaterThan(1_000);
  expect(performance.now() - startedAt).toBeLessThan(
    performanceBudgetMilliseconds,
  );
}, 15_000);
