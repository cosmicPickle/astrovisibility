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
import {
  wallRayIsClear,
  sampledIntervals,
} from './__fixtures__/wallIntersection';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';

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
  'clips the complete frame against physical edges at signed distance %s',
  (distance) => {
    const input = inputAtDistance(distance);
    const geometry = input.maskRevision!.mask.windowCorrection!.geometry;
    const limit = (Math.atan2(0.5, distance) * 180) / Math.PI;
    for (const azimuth of [limit - 2, limit - 0.1, limit + 2, 0, 180]) {
      const frame = createImagingFrame({
        ...input.imagingFrame!,
        horizontal: {
          azimuthDegreesClockwiseFromNorth: azimuth,
          refractedAltitudeDegrees: 0,
        },
        observerLatitudeDegrees: 42,
      });
      const expected = [frame.center, ...frame.corners].every((ray) =>
        wallRayIsClear(ray, { x: 0, y: 0, z: 0 }, distance, -0.5, 0.5, -1, 1),
      );
      expect(windowContainsFrame(geometry, frame, { x: 0, y: 0, z: 0 })).toBe(
        expected,
      );
    }
  },
);

it('rejects an interior wall strip with a clear centre and corners in the shared classifier', () => {
  const input = inputAtDistance(-0.1);
  const horizontal = {
    azimuthDegreesClockwiseFromNorth: 80,
    refractedAltitudeDegrees: 1,
  };
  const settings = {
    ...input.imagingFrame!,
    horizontalFovDegrees: 60,
    apertureMillimeters: 35,
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
  'finds every physical wall crossing at signed distance %s',
  async (distance) => {
    const input = {
      ...inputAtDistance(distance),
      imagingFrame: null,
      window: {
        startTimestampUtc: '2026-01-01T00:00:00.000Z',
        endTimestampUtc: '2026-01-01T01:00:00.000Z',
      },
    };
    const start = Date.parse(input.window.startTimestampUtc);
    const projectAt = (instant: string) => ({
      azimuthDegreesClockwiseFromNorth:
        -110 + (220 * (Date.parse(instant) - start)) / 3600000,
      refractedAltitudeDegrees: 5,
    });
    const expected = sampledIntervals(start, 3600, (second) =>
      wallRayIsClear(
        horizontalDirectionToVector({
          azimuthDegrees: -110 + (220 * second) / 3600,
          altitudeDegrees: 5,
        }),
        { x: 0, y: 0, z: 0 },
        distance,
        -0.5,
        0.5,
        -1,
        1,
      ),
    );
    expect(expected).toHaveLength(distance < 0 ? 3 : 1);
    const result = await calculateObstructionAwareTrajectory(input, {
      projectAt,
    });
    expect(result.visibilityIntervals).toHaveLength(expected.length);
    for (let index = 0; index < expected.length; index++)
      for (const endpoint of ['startTimestampUtc', 'endTimestampUtc'] as const)
        expect(
          Math.abs(
            Date.parse(result.visibilityIntervals[index]![endpoint]) -
              Date.parse(expected[index]![endpoint]),
          ),
        ).toBeLessThanOrEqual(30000);
    // Centre-only paths use different coarse steps; both must meet the physical
    // transition tolerance rather than accidentally share a subdivision grid.
    const summary = calculateObstructionVisibilitySummary(input, { projectAt });
    expect(summary.visibilityIntervals).toHaveLength(expected.length);
    for (let index = 0; index < expected.length; index++)
      for (const endpoint of ['startTimestampUtc', 'endTimestampUtc'] as const)
        expect(
          Math.abs(
            Date.parse(summary.visibilityIntervals[index]![endpoint]) -
              Date.parse(expected[index]![endpoint]),
          ),
        ).toBeLessThanOrEqual(30000);
  },
);

it('does not discard an exterior boundary crossing during refinement', () => {
  const input = inputAtDistance(0.05);
  const shouldRefine = createWindowRefinementPredicate(
    input.maskRevision!.mask.windowCorrection!,
    {
      ...input.imagingFrame!,
      lensOffsetMillimeters: 300,
      apertureMillimeters: 35,
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

it('matches independent one-second physical intersections while the lens crosses the plane', async () => {
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
  const expected = sampledIntervals(start, 86400, (second) => {
    const azimuth = ((-140 + (280 * second) / 86400) * Math.PI) / 180;
    const altitude = (5 * Math.PI) / 180;
    const lens = {
      x: 0.3 * Math.cos(azimuth),
      y: 0,
      z: -0.3 * Math.sin(azimuth),
    };
    for (const horizontal of [-1, 0, 1])
      for (const vertical of [-1, 0, 1]) {
        const spread = Math.tan((0.5 * Math.PI) / 180);
        const ray = {
          x:
            Math.cos(altitude) * Math.sin(azimuth) +
            horizontal * spread * Math.cos(azimuth) -
            vertical * spread * Math.sin(altitude) * Math.sin(azimuth),
          y: Math.sin(altitude) + vertical * spread * Math.cos(altitude),
          z:
            Math.cos(altitude) * Math.cos(azimuth) -
            horizontal * spread * Math.sin(azimuth) -
            vertical * spread * Math.sin(altitude) * Math.cos(azimuth),
        };
        if (!wallRayIsClear(ray, lens, 0.05, -0.5, 0.5, -1, 1)) return false;
      }
    return true;
  });
  expect(expected).toHaveLength(2);
  const result = await calculateObstructionAwareTrajectory(input, {
    projectAt,
  });
  expect(result.visibilityIntervals).toHaveLength(expected.length);
  for (let index = 0; index < expected.length; index++)
    for (const endpoint of ['startTimestampUtc', 'endTimestampUtc'] as const)
      expect(
        Math.abs(
          Date.parse(result.visibilityIntervals[index]![endpoint]) -
            Date.parse(expected[index]![endpoint]),
        ),
      ).toBeLessThanOrEqual(30000);
  expect(
    calculateObstructionVisibilitySummary(input, { projectAt })
      .visibilityIntervals,
  ).toEqual(result.visibilityIntervals);
});
