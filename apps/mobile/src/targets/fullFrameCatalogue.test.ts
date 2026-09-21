import catalogue from '../catalogue/generated/catalogue.json';
import { createBlockedBitset, writeBlockedPixel } from '../mask/rasterMask';
import { calculateRankedTargetsProgressively } from './rankedTargetCalculation';
import { VisibilityCalculationCache } from '../astronomy/obstructionVisibility';

it.each([12, 25])(
  'ranks the production catalogue over %s hours within the desktop budget',
  async (hours) => {
    const raster = {
      widthPixels: 2048,
      heightPixels: 2048,
      uri: 'synthetic',
      blockedBitset: createBlockedBitset(2048, 2048, true),
    };
    for (let y = 500; y < 1100; y += 1)
      for (let x = 750; x < 1300; x += 1) {
        if (x >= 1022 && x <= 1024 && y < 800) continue;
        writeBlockedPixel(raster.blockedBitset, 2048, 2048, x, y, false);
      }
    const started = performance.now();
    let batches = 0;
    const result = await calculateRankedTargetsProgressively(
      {
        targets: catalogue.targets,
        equipment: {
          id: 'equipment',
          name: 'Synthetic 150mm optics',
          focalLengthMillimeters: 150,
          apertureMillimeters: 35,
          sensorWidthPixels: 3840,
          sensorHeightPixels: 2160,
          pixelSizeMicrometers: 2,
          trackingMode: 'equatorial',
          frameOrientationDegrees: 30,
          createdAtUtc: '2026-08-19T12:00:00.000Z',
          updatedAtUtc: '2026-08-19T12:00:00.000Z',
        },
        observer: {
          latitudeDegreesNorth: 42,
          longitudeDegreesEast: 23,
          elevationMetersAboveMeanSeaLevel: 500,
        },
        window: {
          startTimestampUtc: '2026-08-19T18:00:00.000Z',
          endTimestampUtc: new Date(
            Date.parse('2026-08-19T18:00:00.000Z') + hours * 3_600_000,
          ).toISOString(),
        },
        timeZoneId: 'UTC',
        profileId: 'benchmark',
        panoramaRevisionId: 'panorama',
        maskRevision: {
          id: 'mask',
          profileId: 'benchmark',
          panoramaRevisionId: 'panorama',
          createdAtUtc: '2026-08-19T12:00:00.000Z',
          formatVersion: 2,
          coveragePolygons: [],
          operations: [],
          raster,
        },
      },
      {
        cache: new VisibilityCalculationCache(),
        yieldToEventLoop: async () => {
          batches += 1;
        },
      },
    );
    expect(result.length).toBeGreaterThan(100);
    expect(batches).toBeGreaterThan(1);
    expect(performance.now() - started).toBeLessThan(
      process.env.CI ? 10_000 : 5000,
    );
  },
  20_000,
);
