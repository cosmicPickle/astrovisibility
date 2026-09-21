import {
  createBlockedBitset,
  classifyRasterMaskDirection,
  writeBlockedPixel,
} from '../mask/rasterMask';
import { directionToAtlasPixel } from '../panorama/directionalAtlas';
import { prepareWindowCorrection } from './windowMask';
import { createWindowGeometry } from './windowGeometry';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  createVisibilityCalculationCacheKey,
  type ObstructionVisibilityInput,
} from '../astronomy/obstructionVisibility';

const definition = {
  version: 1 as const,
  leftAzimuthDegrees: 330,
  rightAzimuthDegrees: 30,
  topSlope: 1,
  bottomSlope: 0,
  rightDistanceRatio: 1,
  widthMeters: 2,
};
async function fixture() {
  const raster = {
    widthPixels: 256,
    heightPixels: 256,
    uri: 'synthetic',
    blockedBitset: createBlockedBitset(256, 256, false),
  };
  for (const direction of [
    { azimuthDegrees: 0, altitudeDegrees: 20 },
    { azimuthDegrees: 32, altitudeDegrees: 20 },
  ]) {
    const pixel = directionToAtlasPixel(direction, raster);
    writeBlockedPixel(
      raster.blockedBitset,
      256,
      256,
      Math.round(pixel.xPixels),
      Math.round(pixel.yPixels),
      true,
    );
  }
  const coverage = createBlockedBitset(256, 256, true);
  const correction = await prepareWindowCorrection(
    raster,
    coverage,
    definition,
    async () => undefined,
  );
  const input: ObstructionVisibilityInput = {
    profileId: 'synthetic',
    panoramaRevisionId: 'p',
    target: {
      id: 't',
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
      startTimestampUtc: '2026-01-01T00:00:00.000Z',
      endTimestampUtc: '2026-01-01T00:10:00.000Z',
    },
    maskRevision: {
      id: 'm',
      panoramaRevisionId: 'p',
      mask: {
        raster,
        coveragePolygons: [],
        operations: [],
        windowCorrection: correction,
      },
    },
    imagingFrame: {
      horizontalFovDegrees: 1,
      verticalFovDegrees: 1,
      orientationDegrees: 0,
      trackingMode: 'altaz',
      lensOffsetMillimeters: -300,
    },
  };
  return { input, raster, coverage, correction };
}

it('preserves interior obstacles and original bits, replaces the old window contribution, and retains uncaptured blocking', async () => {
  const { raster, coverage, correction } = await fixture();
  expect(
    classifyRasterMaskDirection(correction.backgroundRaster, {
      azimuthDegrees: 0,
      altitudeDegrees: 20,
    }),
  ).toBe('blocked');
  expect(
    classifyRasterMaskDirection(correction.backgroundRaster, {
      azimuthDegrees: 32,
      altitudeDegrees: 20,
    }),
  ).toBe('visible');
  expect(
    classifyRasterMaskDirection(raster, {
      azimuthDegrees: 32,
      altitudeDegrees: 20,
    }),
  ).toBe('blocked');
  coverage.fill(0);
  const uncaptured = await prepareWindowCorrection(
    raster,
    coverage,
    definition,
    async () => undefined,
  );
  expect(
    classifyRasterMaskDirection(uncaptured.backgroundRaster, {
      azimuthDegrees: 32,
      altitudeDegrees: 20,
    }),
  ).toBe('blocked');
});

it('extends on the favorable side, clips on the other, and shares center/frame/summary/cache semantics', async () => {
  const { input } = await fixture();
  const projectAt = () => ({
    azimuthDegreesClockwiseFromNorth: 32,
    refractedAltitudeDegrees: 20,
  });
  const favorable = await calculateObstructionAwareTrajectory(input, {
    projectAt,
  });
  expect(favorable.totalVisibleMilliseconds).toBe(600_000);
  expect(
    calculateObstructionVisibilitySummary(input, { projectAt })
      .visibilityIntervals,
  ).toEqual(favorable.visibilityIntervals);
  const zero = {
    ...input,
    imagingFrame: { ...input.imagingFrame!, lensOffsetMillimeters: 0 },
  };
  expect(
    (await calculateObstructionAwareTrajectory(zero, { projectAt }))
      .totalVisibleMilliseconds,
  ).toBe(0);
  expect(createVisibilityCalculationCacheKey(input)).not.toEqual(
    createVisibilityCalculationCacheKey(zero),
  );
  const changed = {
    ...input,
    maskRevision: {
      ...input.maskRevision!,
      mask: { ...input.maskRevision!.mask, windowCorrection: undefined },
    },
  };
  expect(createVisibilityCalculationCacheKey(input)).not.toEqual(
    createVisibilityCalculationCacheKey(changed),
  );
  expect(
    (
      await calculateObstructionAwareTrajectory(
        { ...input, imagingFrame: null },
        { projectAt },
      )
    ).totalVisibleMilliseconds,
  ).toBe(0);
  expect(
    (
      await calculateObstructionAwareTrajectory(
        { ...input, maskRevision: null },
        { projectAt },
      )
    ).samples.every((s) => s.assessment === 'unassessed'),
  ).toBe(true);
});

it('finds both window crossings within 30 seconds of an independent one-second ray-plane reference', async () => {
  const { input } = await fixture();
  const clean = {
    widthPixels: 256,
    heightPixels: 256,
    uri: 'synthetic',
    blockedBitset: createBlockedBitset(256, 256, false),
  };
  const request = {
    ...input,
    maskRevision: {
      ...input.maskRevision!,
      mask: {
        ...input.maskRevision!.mask,
        raster: clean,
        windowCorrection: {
          geometry: createWindowGeometry(definition),
          backgroundRaster: clean,
        },
      },
    },
  };
  const start = Date.parse(input.window.startTimestampUtc);
  const projectAt = (instant: string) => ({
    azimuthDegreesClockwiseFromNorth:
      -50 + (100 * (Date.parse(instant) - start)) / 600000,
    refractedAltitudeDegrees: 20,
  });
  // Independent front-facing opening: z=sqrt(3), x in (-1,1), y in (0,2).
  const visibleAtSecond = (second: number) => {
    const az = ((-50 + second / 6) * Math.PI) / 180;
    const alt = (20 * Math.PI) / 180;
    const lens = { x: -0.3 * Math.cos(az), z: 0.3 * Math.sin(az) };
    for (const horizontal of [-1, 1])
      for (const vertical of [-1, 1]) {
        const spread = Math.tan((0.5 * Math.PI) / 180);
        const x =
          Math.cos(alt) * Math.sin(az) +
          horizontal * spread * Math.cos(az) -
          vertical * spread * Math.sin(alt) * Math.sin(az);
        const y = Math.sin(alt) + vertical * spread * Math.cos(alt);
        const z =
          Math.cos(alt) * Math.cos(az) -
          horizontal * spread * Math.sin(az) -
          vertical * spread * Math.sin(alt) * Math.cos(az);
        const travel = (Math.sqrt(3) - lens.z) / z;
        if (
          Math.abs(lens.x + travel * x) >= 1 ||
          y * travel <= 0 ||
          y * travel >= 2
        )
          return false;
      }
    return true;
  };
  const seconds = Array.from({ length: 601 }, (_, second) => second).filter(
    visibleAtSecond,
  );
  const result = await calculateObstructionAwareTrajectory(request, {
    projectAt,
  });
  expect(result.visibilityIntervals).toHaveLength(1);
  const interval = result.visibilityIntervals[0]!;
  expect(
    Math.abs(
      Date.parse(interval.startTimestampUtc) - start - seconds[0]! * 1000,
    ),
  ).toBeLessThanOrEqual(30000);
  expect(
    Math.abs(
      Date.parse(interval.endTimestampUtc) -
        start -
        (seconds.at(-1)! + 1) * 1000,
    ),
  ).toBeLessThanOrEqual(30000);
  expect(
    calculateObstructionVisibilitySummary(request, { projectAt })
      .visibilityIntervals,
  ).toEqual(result.visibilityIntervals);
});
