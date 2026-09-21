import { createImagingFrame } from '../astronomy/imagingFrame';
import {
  createObstructionClassifier,
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  type ObstructionVisibilityInput,
} from '../astronomy/obstructionVisibility';
import { createBlockedBitset } from '../mask/rasterMask';
import { createWindowGeometry, windowContainsRay } from './windowGeometry';
import { createWindowRefinementPredicate } from './windowRefinement';
import { windowContainsFrame } from './windowFrame';

function inputAtDistance(distance: number): ObstructionVisibilityInput {
  const halfAngle = (Math.atan2(0.5, distance) * 180) / Math.PI;
  const range = Math.hypot(0.5, distance);
  const raster = {
    widthPixels: 128,
    heightPixels: 128,
    uri: 'synthetic',
    blockedBitset: createBlockedBitset(128, 128, false),
  };
  return {
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
        coveragePolygons: [],
        operations: [],
        raster,
        windowCorrection: {
          backgroundRaster: raster,
          geometry: createWindowGeometry({
            version: 1,
            leftAzimuthDegrees: 360 - halfAngle,
            rightAzimuthDegrees: halfAngle,
            topSlope: 1 / range,
            bottomSlope: -1 / range,
            rightDistanceRatio: 1,
            widthMeters: 1,
          }),
        },
      },
    },
    imagingFrame: {
      horizontalFovDegrees: 1,
      verticalFovDegrees: 1,
      orientationDegrees: 0,
      trackingMode: 'altaz',
      lensOffsetMillimeters: 0,
    },
  };
}

it.each([0.05, 0, -0.05])(
  'clips the complete frame at the lateral edge at signed distance %s',
  (distance) => {
    const input = inputAtDistance(distance);
    const geometry = input.maskRevision!.mask.windowCorrection!.geometry;
    const limit = (Math.atan2(0.5, distance) * 180) / Math.PI;
    for (const [inset, clear] of [
      [2, true],
      [0.1, false],
      [-2, false],
    ] as const) {
      const frame = createImagingFrame({
        ...input.imagingFrame!,
        horizontal: {
          azimuthDegreesClockwiseFromNorth: limit - inset,
          refractedAltitudeDegrees: 0,
        },
        observerLatitudeDegrees: 42,
      });
      expect(windowContainsFrame(geometry, frame, { x: 0, y: 0, z: 0 })).toBe(
        clear,
      );
    }
  },
);

it('rejects a rear obstruction inside a frame even when the center and all corners are clear', () => {
  const input = inputAtDistance(-2);
  const geometry = input.maskRevision!.mask.windowCorrection!.geometry;
  const definition = {
    ...geometry.definition,
    bottomSlope: 0.1 / Math.hypot(0.5, 2),
  };
  input.maskRevision!.mask.windowCorrection!.geometry =
    createWindowGeometry(definition);
  const horizontal = {
    azimuthDegreesClockwiseFromNorth: 160,
    refractedAltitudeDegrees: 38,
  };
  const settings = {
    ...input.imagingFrame!,
    horizontalFovDegrees: 90,
    verticalFovDegrees: 65,
  };
  const frame = createImagingFrame({
    ...settings,
    horizontal,
    observerLatitudeDegrees: 42,
  });
  expect(
    [frame.center, ...frame.corners].every((ray) =>
      windowContainsRay(
        input.maskRevision!.mask.windowCorrection!.geometry,
        ray,
      ),
    ),
  ).toBe(true);
  expect(
    createObstructionClassifier({ ...input, imagingFrame: settings })(
      horizontal,
    ),
  ).toBe('blocked');
});

it.each([0.05, 0, -0.05])(
  'finds the two lateral crossings at signed distance %s',
  async (distance) => {
    const input = { ...inputAtDistance(distance), imagingFrame: null };
    const start = Date.parse(input.window.startTimestampUtc);
    const projectAt = (instant: string) => ({
      azimuthDegreesClockwiseFromNorth:
        -110 + (220 * (Date.parse(instant) - start)) / 600000,
      refractedAltitudeDegrees: 5,
    });
    const limit = (Math.atan2(0.5, distance) * 180) / Math.PI;
    const expectedStart = ((110 - limit) / 220) * 600000;
    const expectedEnd = ((110 + limit) / 220) * 600000;
    const result = await calculateObstructionAwareTrajectory(input, {
      projectAt,
    });
    expect(result.visibilityIntervals).toHaveLength(1);
    expect(
      Math.abs(
        Date.parse(result.visibilityIntervals[0]!.startTimestampUtc) -
          start -
          expectedStart,
      ),
    ).toBeLessThanOrEqual(30000);
    expect(
      Math.abs(
        Date.parse(result.visibilityIntervals[0]!.endTimestampUtc) -
          start -
          expectedEnd,
      ),
    ).toBeLessThanOrEqual(30000);
    expect(
      calculateObstructionVisibilitySummary(input, { projectAt })
        .visibilityIntervals,
    ).toEqual(result.visibilityIntervals);
  },
);

it('does not discard an exterior boundary crossing during refinement', () => {
  const input = inputAtDistance(0.05);
  const shouldRefine = createWindowRefinementPredicate(
    input.maskRevision!.mask.windowCorrection!,
    {
      ...input.imagingFrame!,
      lensOffsetMillimeters: 300,
    },
    42,
  );
  expect(
    shouldRefine(
      {
        timestampMilliseconds: 0,
        azimuthDegreesClockwiseFromNorth: -123,
        refractedAltitudeDegrees: 5,
        assessment: 'blocked',
      },
      {
        timestampMilliseconds: 60000,
        azimuthDegreesClockwiseFromNorth: -118,
        refractedAltitudeDegrees: 5,
        assessment: 'visible',
      },
    ),
  ).toBe(true);
});

it('matches independent one-second lateral bounds while the lens crosses the plane', async () => {
  const base = inputAtDistance(0.05);
  const input = {
    ...base,
    imagingFrame: { ...base.imagingFrame!, lensOffsetMillimeters: 300 },
    window: { ...base.window, endTimestampUtc: '2026-01-02T00:00:00.000Z' },
  };
  const start = Date.parse(input.window.startTimestampUtc);
  const projectAt = (instant: string) => ({
    azimuthDegreesClockwiseFromNorth:
      -140 + (280 * (Date.parse(instant) - start)) / 86400000,
    refractedAltitudeDegrees: 5,
  });
  const seconds: number[] = [];
  for (let second = 0; second <= 86400; second += 1) {
    const azimuth = ((-140 + (280 * second) / 86400) * Math.PI) / 180;
    const altitude = (5 * Math.PI) / 180;
    const lensX = 0.3 * Math.cos(azimuth);
    const depth = 0.05 + 0.3 * Math.sin(azimuth);
    const left = Math.atan2(-0.5 - lensX, depth);
    const right = Math.atan2(0.5 - lensX, depth);
    let visible = true;
    for (const horizontal of [-1, 1])
      for (const vertical of [-1, 1]) {
        const spread = Math.tan((0.5 * Math.PI) / 180);
        const x =
          Math.cos(altitude) * Math.sin(azimuth) +
          horizontal * spread * Math.cos(azimuth) -
          vertical * spread * Math.sin(altitude) * Math.sin(azimuth);
        const z =
          Math.cos(altitude) * Math.cos(azimuth) -
          horizontal * spread * Math.sin(azimuth) -
          vertical * spread * Math.sin(altitude) * Math.cos(azimuth);
        const angle = Math.atan2(x, z);
        if (angle <= left || angle >= right) visible = false;
      }
    if (visible) seconds.push(second);
  }
  expect(seconds.length).toBeGreaterThan(1000);
  const result = await calculateObstructionAwareTrajectory(input, {
    projectAt,
  });
  expect(result.visibilityIntervals).toHaveLength(1);
  expect(
    Math.abs(
      Date.parse(result.visibilityIntervals[0]!.startTimestampUtc) -
        start -
        seconds[0]! * 1000,
    ),
  ).toBeLessThanOrEqual(30000);
  expect(
    Math.abs(
      Date.parse(result.visibilityIntervals[0]!.endTimestampUtc) -
        start -
        (seconds.at(-1)! + 1) * 1000,
    ),
  ).toBeLessThanOrEqual(30000);
  expect(
    calculateObstructionVisibilitySummary(input, { projectAt })
      .visibilityIntervals,
  ).toEqual(result.visibilityIntervals);
});
