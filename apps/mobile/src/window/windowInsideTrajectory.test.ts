import { equatorialJ2000ToHorizontal } from '../astronomy/horizontalCoordinates';
import { createImagingFrame } from '../astronomy/imagingFrame';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  type ObstructionVisibilityInput,
} from '../astronomy/obstructionVisibility';
import { createBlockedBitset } from '../mask/rasterMask';
import { physicalWindow } from './__fixtures__/physicalWindow';
import { createWindowGeometry, lensPositionMeters } from './windowGeometry';

// M27 catalogue coordinates; synthetic observing position, not a user profile.
const target = {
  id: 'NGC6853',
  rightAscensionJ2000Hours: 19.99343888888889,
  declinationJ2000Degrees: 22.721027777777778,
};
const observer = {
  latitudeDegreesNorth: 44,
  longitudeDegreesEast: 0,
  elevationMetersAboveMeanSeaLevel: 0,
};
const startTimestampUtc = '2026-09-20T21:00:00.000Z';
const endTimestampUtc = '2026-09-21T03:00:00.000Z';
const start = Date.parse(startTimestampUtc);
const seconds = (Date.parse(endTimestampUtc) - start) / 1000;
const sky = Array.from({ length: seconds + 1 }, (_, second) =>
  equatorialJ2000ToHorizontal({
    ...target,
    observer,
    timestampUtc: new Date(start + second * 1000).toISOString(),
  }),
);

it.each(['altaz', 'equatorial', 'derotatedAltaz'] as const)(
  'matches one-second physical right-edge crossings for a 178-degree window in %s mode',
  async (trackingMode) => {
    const settings = {
      horizontalFovDegrees: 3,
      verticalFovDegrees: 2,
      orientationDegrees: 23,
      trackingMode,
    };
    const samples = sky.map((horizontal) => ({
      frame: createImagingFrame({
        ...settings,
        horizontal,
        observerLatitudeDegrees: 44,
      }),
      lens: lensPositionMeters(
        {
          azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
          altitudeDegrees: horizontal.refractedAltitudeDegrees,
        },
        50,
        trackingMode,
        44,
      ),
    }));
    let maximumTransitionErrorMilliseconds = 0;
    for (const width of [1.2, 1.6])
      for (const across of [0.1, 0.5, 0.9])
        for (const offset of [0, 50]) {
          const fixture = physicalWindow(width, 178, across, 180);
          const raster = {
            uri: 'synthetic',
            widthPixels: 128,
            heightPixels: 128,
            blockedBitset: createBlockedBitset(128, 128, false),
          };
          const input: ObstructionVisibilityInput = {
            profileId: 'synthetic',
            target,
            observer,
            timeZoneId: 'UTC',
            panoramaRevisionId: 'p',
            window: { startTimestampUtc, endTimestampUtc },
            imagingFrame: { ...settings, lensOffsetMillimeters: offset },
            maskRevision: {
              id: 'm',
              panoramaRevisionId: 'p',
              mask: {
                coveragePolygons: [],
                operations: [],
                raster,
                windowCorrection: {
                  geometry: createWindowGeometry(fixture.definition),
                  backgroundRaster: raster,
                },
              },
            },
          };
          const expectedChanges: number[] = [];
          let previous: boolean | undefined;
          for (let second = 0; second <= seconds; second++) {
            const sample = samples[second]!;
            const lens = offset ? sample.lens : { x: 0, y: 0, z: 0 };
            // Never silently include the deferred front-of-plane branch.
            if (fixture.depth - fixture.toLocal(lens).z <= 1e-6)
              throw new Error('Right-edge fixture crossed the plane');
            const visible = sample.frame.corners.every((ray) =>
              fixture.rayClearsOpening(ray, lens),
            );
            if (previous !== undefined && visible !== previous)
              expectedChanges.push(start + second * 1000);
            if (second === 0) expect(visible).toBe(true);
            if (second === seconds) expect(visible).toBe(false);
            previous = visible;
          }
          expect(expectedChanges).toHaveLength(1);
          const trajectory = await calculateObstructionAwareTrajectory(input, {
            yieldToEventLoop: async () => undefined,
          });
          const summary = calculateObstructionVisibilitySummary(input);
          for (const result of [trajectory, summary]) {
            expect(result.visibilityIntervals).toHaveLength(1);
            expect(result.visibilityIntervals[0]!.startTimestampUtc).toBe(
              startTimestampUtc,
            );
            const error = Math.abs(
              Date.parse(result.visibilityIntervals[0]!.endTimestampUtc) -
                expectedChanges[0]!,
            );
            maximumTransitionErrorMilliseconds = Math.max(
              maximumTransitionErrorMilliseconds,
              error,
            );
            expect(error).toBeLessThanOrEqual(30000);
          }
        }
    console.info('right_edge_timing_audit', trackingMode, {
      scenarios: 12,
      maximumTransitionErrorMilliseconds,
    });
  },
  30000,
);
