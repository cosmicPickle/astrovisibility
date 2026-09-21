import { createBlockedBitset, writeBlockedPixel } from '../mask/rasterMask';
import { directionToAtlasPixel } from '../panorama/directionalAtlas';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  createVisibilityCalculationCacheKey,
  type ObstructionVisibilityInput,
} from './obstructionVisibility';

const start = '2026-01-01T00:00:00.000Z';
function input(): ObstructionVisibilityInput {
  const raster = {
    widthPixels: 2048,
    heightPixels: 2048,
    uri: 'synthetic',
    blockedBitset: createBlockedBitset(2048, 2048, false),
  };
  const pixel = directionToAtlasPixel(
    { azimuthDegrees: 1, altitudeDegrees: 45.4 },
    raster,
  );
  writeBlockedPixel(
    raster.blockedBitset,
    2048,
    2048,
    Math.round(pixel.xPixels),
    Math.round(pixel.yPixels),
    true,
  );
  return {
    profileId: 'synthetic-profile',
    target: {
      id: 'target',
      rightAscensionJ2000Hours: 0,
      declinationJ2000Degrees: 0,
    },
    observer: {
      latitudeDegreesNorth: 42,
      longitudeDegreesEast: 0,
      elevationMetersAboveMeanSeaLevel: 0,
    },
    timeZoneId: 'UTC',
    window: {
      startTimestampUtc: start,
      endTimestampUtc: '2026-01-01T00:10:00.000Z',
    },
    panoramaRevisionId: 'panorama',
    maskRevision: {
      id: 'mask',
      panoramaRevisionId: 'panorama',
      mask: { coveragePolygons: [], operations: [], raster },
    },
    imagingFrame: {
      horizontalFovDegrees: 4,
      verticalFovDegrees: 2,
      orientationDegrees: 0,
      trackingMode: 'altaz',
    },
  };
}
const stationary = () => ({
  azimuthDegreesClockwiseFromNorth: 0,
  refractedAltitudeDegrees: 45,
});

it('refines rotation near zenith even when center motion is below the spatial tolerance', async () => {
  const request = input();
  const raster = request.maskRevision!.mask.raster!;
  raster.blockedBitset.fill(0);
  const pixel = directionToAtlasPixel(
    { azimuthDegrees: 0, altitudeDegrees: 88.5 },
    raster,
  );
  writeBlockedPixel(
    raster.blockedBitset,
    2048,
    2048,
    Math.round(pixel.xPixels),
    Math.round(pixel.yPixels),
    true,
  );
  const result = await calculateObstructionAwareTrajectory(
    {
      ...request,
      window: {
        startTimestampUtc: start,
        endTimestampUtc: '2026-01-01T00:00:10.000Z',
      },
      imagingFrame: { ...request.imagingFrame!, verticalFovDegrees: 0.2 },
    },
    {
      projectAt: (timestamp) => ({
        azimuthDegreesClockwiseFromNorth:
          ((Date.parse(timestamp) - Date.parse(start)) / 10_000) * 180,
        refractedAltitudeDegrees: 89.999,
      }),
    },
  );
  expect(result.blockedIntervals.length).toBeGreaterThan(0);
  expect(result.visibilityIntervals).toHaveLength(2);
});

it('blocks the full image when its center is clear and an interior pixel is blocked', async () => {
  const request = input();
  const full = await calculateObstructionAwareTrajectory(request, {
    projectAt: stationary,
  });
  const center = await calculateObstructionAwareTrajectory(
    { ...request, imagingFrame: null },
    { projectAt: stationary },
  );
  expect(full.totalVisibleMilliseconds).toBe(0);
  expect(center.totalVisibleMilliseconds).toBe(600_000);
});

it('keeps full trajectory and summary intervals identical through a crossing', async () => {
  const request = input();
  const projectAt = (timestamp: string) => ({
    azimuthDegreesClockwiseFromNorth:
      -8 + ((Date.parse(timestamp) - Date.parse(start)) / 600_000) * 16,
    refractedAltitudeDegrees: 45,
  });
  const trajectory = await calculateObstructionAwareTrajectory(request, {
    projectAt,
  });
  const summary = calculateObstructionVisibilitySummary(request, { projectAt });
  expect(trajectory.blockedIntervals).toHaveLength(1);
  expect(trajectory.visibilityIntervals).toHaveLength(2);
  expect(summary.visibilityIntervals).toEqual(trajectory.visibilityIntervals);
  expect(summary.totalVisibleMilliseconds).toEqual(
    trajectory.totalVisibleMilliseconds,
  );
});

it('leaves no-mask paths unassessed and gives every physical framing a distinct cache identity', async () => {
  const request = input();
  const result = await calculateObstructionAwareTrajectory(
    { ...request, maskRevision: null },
    { projectAt: stationary },
  );
  expect(result.visibilityIntervals).toEqual([]);
  expect(
    result.samples.every(({ assessment }) => assessment === 'unassessed'),
  ).toBe(true);
  const key = createVisibilityCalculationCacheKey(request);
  for (const changes of [
    { orientationDegrees: 90 },
    { trackingMode: 'equatorial' as const },
    { horizontalFovDegrees: 5 },
  ]) {
    expect(
      createVisibilityCalculationCacheKey({
        ...request,
        imagingFrame: { ...request.imagingFrame!, ...changes },
      }),
    ).not.toEqual(key);
  }
});
