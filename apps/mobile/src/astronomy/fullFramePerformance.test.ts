import catalogue from '../catalogue/generated/catalogue.json';
import { createBlockedBitset, writeBlockedPixel } from '../mask/rasterMask';
import { calculateObstructionVisibilitySummary } from './obstructionVisibility';
import { createWindowHorizontalProjectorAtMilliseconds } from './horizontalCoordinates';

it('bounds full-frame work for a representative 256-target batch', () => {
  const raster = {
    widthPixels: 2048,
    heightPixels: 2048,
    uri: 'synthetic-window',
    blockedBitset: createBlockedBitset(2048, 2048, true),
  };
  for (let y = 500; y < 1100; y += 1)
    for (let x = 750; x < 1300; x += 1) {
      if (x >= 1022 && x <= 1024 && y < 800) continue;
      writeBlockedPixel(raster.blockedBitset, 2048, 2048, x, y, false);
    }
  const observer = {
    latitudeDegreesNorth: 42,
    longitudeDegreesEast: 23,
    elevationMetersAboveMeanSeaLevel: 500,
  };
  const window = {
    startTimestampUtc: '2026-08-19T18:00:00.000Z',
    endTimestampUtc: '2026-08-20T06:00:00.000Z',
  };
  const started = performance.now();
  let visible = 0;
  for (const target of catalogue.targets.slice(0, 256)) {
    const result = calculateObstructionVisibilitySummary(
      {
        target,
        observer,
        window,
        timeZoneId: 'UTC',
        profileId: 'benchmark',
        panoramaRevisionId: 'panorama',
        maskRevision: {
          id: 'mask',
          panoramaRevisionId: 'panorama',
          mask: { coveragePolygons: [], operations: [], raster },
        },
        imagingFrame: {
          horizontalFovDegrees: 3,
          verticalFovDegrees: 2,
          orientationDegrees: 0,
          trackingMode: 'equatorial',
        },
      },
      {
        projectAtMilliseconds: createWindowHorizontalProjectorAtMilliseconds({
          observer,
          target,
          window,
        }),
      },
    );
    visible += result.totalVisibleMilliseconds;
  }
  expect(visible).toBeGreaterThan(0);
  expect(performance.now() - started).toBeLessThan(1000);
});
