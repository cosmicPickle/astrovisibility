import catalogue from '../catalogue/generated/catalogue.json';
import { createBlockedBitset } from '../mask/rasterMask';
import {
  calculateRankedTargetsProgressively,
  type RankedTarget,
} from '../targets/rankedTargetCalculation';
import { VisibilityCalculationCache } from '../astronomy/obstructionVisibility';
import { prepareWindowCorrection } from './windowMask';
import { createWindowGeometry } from './windowGeometry';

it('keeps catalogue estimates fast and identical across absent, displaced, flush and exterior windows', async () => {
  const raster = {
    widthPixels: 2048,
    heightPixels: 2048,
    uri: 'synthetic',
    blockedBitset: createBlockedBitset(2048, 2048, false),
  };
  const preparationStart = performance.now();
  const correction = await prepareWindowCorrection(
    raster,
    createBlockedBitset(2048, 2048, true),
    {
      version: 1,
      leftAzimuthDegrees: 140,
      rightAzimuthDegrees: 220,
      topSlope: 1.5,
      bottomSlope: 0.1,
      rightDistanceRatio: 1.2,
      widthMeters: 1.2,
    },
    async () => undefined,
  );
  const preparationMs = performance.now() - preparationStart;
  expect(preparationMs).toBeLessThan(2000);
  const timings: Record<string, number> = {};
  let baseline: RankedTarget[] | undefined;
  for (const mode of [
    'absent',
    'zero',
    'displaced',
    'flush',
    'exterior',
  ] as const) {
    const activeCorrection =
      mode === 'flush' || mode === 'exterior'
        ? {
            ...correction,
            geometry: createWindowGeometry({
              ...correction.geometry.definition,
              leftAzimuthDegrees: mode === 'flush' ? 90 : 80,
              rightAzimuthDegrees: mode === 'flush' ? 270 : 280,
              rightDistanceRatio: 1,
              topSlope: 1,
              bottomSlope: -1,
            }),
          }
        : correction;
    const started = performance.now();
    const result = await calculateRankedTargetsProgressively(
      {
        targets: catalogue.targets,
        equipment: {
          id: 'optics',
          name: 'Synthetic',
          focalLengthMillimeters: 150,
          apertureMillimeters: 35,
          sensorWidthPixels: 3840,
          sensorHeightPixels: 2160,
          pixelSizeMicrometers: 2,
          trackingMode: 'altaz',
          lensOffsetMillimeters:
            mode === 'displaced' || mode === 'flush' || mode === 'exterior'
              ? 120
              : 0,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        },
        observer: {
          latitudeDegreesNorth: 42,
          longitudeDegreesEast: 23,
          elevationMetersAboveMeanSeaLevel: 500,
        },
        window: {
          startTimestampUtc: '2026-08-19T18:00:00.000Z',
          endTimestampUtc: '2026-08-20T06:00:00.000Z',
        },
        timeZoneId: 'UTC',
        profileId: 'synthetic',
        panoramaRevisionId: 'p',
        maskRevision: {
          id: 'm',
          profileId: 'synthetic',
          panoramaRevisionId: 'p',
          formatVersion: 2,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          coveragePolygons: [],
          operations: [],
          raster,
          ...(mode === 'absent' ? {} : { windowCorrection: activeCorrection }),
        },
      },
      {
        cache: new VisibilityCalculationCache(),
        yieldToEventLoop: async () => undefined,
      },
    );
    timings[mode] = performance.now() - started;
    console.info(
      'window_catalogue_benchmark',
      mode,
      Math.round(timings[mode]!),
    );
    expect(result.length).toBeGreaterThan(100);
    expect(timings[mode]).toBeLessThan(process.env.CI ? 4000 : 2000);
    if (baseline) expect(result).toEqual(baseline);
    else baseline = result;
  }
  // Synthetic workload timings only; no observing data or device identifiers.
  console.info('window_benchmark_ms', {
    preparation: Math.round(preparationMs),
    ...Object.fromEntries(
      Object.entries(timings).map(([key, value]) => [key, Math.round(value)]),
    ),
  });
}, 60000);
