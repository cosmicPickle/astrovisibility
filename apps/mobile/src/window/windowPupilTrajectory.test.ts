import { createImagingFrame } from '../astronomy/imagingFrame';
import {
  calculateObstructionAwareTrajectory,
  calculateObstructionVisibilitySummary,
  type ObstructionVisibilityInput,
} from '../astronomy/obstructionVisibility';
import { createBlockedBitset } from '../mask/rasterMask';
import { createWindowGeometry, lensPositionMeters } from './windowGeometry';
import {
  sampledIntervals,
  wallRayIsClear,
} from './__fixtures__/wallIntersection';

it.each(['altaz', 'equatorial', 'derotatedAltaz'] as const)(
  'refines pupil shading and plane crossings against independent one-second rays in %s',
  async (trackingMode) => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    const durationSeconds = 14400;
    for (const scenario of [
      { depth: 0.01, offset: 50, from: 60, to: 110 },
      { depth: -0.03, offset: 0, from: 80, to: 120 },
      { depth: 0, offset: 50, from: -120, to: 120 },
    ]) {
      const range = Math.hypot(0.6, scenario.depth);
      const angle = (Math.atan2(0.6, scenario.depth) * 180) / Math.PI;
      const raster = {
        uri: 'synthetic',
        widthPixels: 128,
        heightPixels: 128,
        blockedBitset: createBlockedBitset(128, 128, false),
      };
      const settings = {
        horizontalFovDegrees: 3,
        verticalFovDegrees: 2,
        orientationDegrees: 23,
        trackingMode,
        apertureMillimeters: 35,
        lensOffsetMillimeters: scenario.offset,
      };
      const input: ObstructionVisibilityInput = {
        profileId: 'synthetic',
        panoramaRevisionId: 'p',
        timeZoneId: 'UTC',
        target: {
          id: 'synthetic',
          rightAscensionJ2000Hours: 0,
          declinationJ2000Degrees: 0,
        },
        observer: {
          latitudeDegreesNorth: 44,
          longitudeDegreesEast: 0,
          elevationMetersAboveMeanSeaLevel: 0,
        },
        window: {
          startTimestampUtc: new Date(start).toISOString(),
          endTimestampUtc: new Date(
            start + durationSeconds * 1000,
          ).toISOString(),
        },
        imagingFrame: settings,
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
                leftAzimuthDegrees: 360 - angle,
                rightAzimuthDegrees: angle,
                topSlope: 0.6 / range,
                bottomSlope: -0.6 / range,
                rightDistanceRatio: 1,
                widthMeters: 1.2,
              }),
            },
          },
        },
      };
      const projectAt = (instant: string) => ({
        azimuthDegreesClockwiseFromNorth:
          scenario.from +
          ((scenario.to - scenario.from) * (Date.parse(instant) - start)) /
            (durationSeconds * 1000),
        refractedAltitudeDegrees: 20,
      });
      const expected = sampledIntervals(start, durationSeconds, (second) => {
        const horizontal = projectAt(
          new Date(start + second * 1000).toISOString(),
        );
        const frame = createImagingFrame({
          ...settings,
          horizontal,
          observerLatitudeDegrees: 44,
        });
        const lens = lensPositionMeters(
          {
            azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
            altitudeDegrees: 20,
          },
          scenario.offset,
          trackingMode,
          44,
        );
        // Include the pupil's nearest/farthest wall points as well as its rim;
        // those catch an arbitrarily small portion entering the room-side plane.
        const normalAngle = Math.atan2(frame.up.z, frame.right.z);
        const angles = [
          normalAngle,
          normalAngle + Math.PI,
          ...Array.from({ length: 64 }, (_, i) => (i * 2 * Math.PI) / 64),
        ];
        for (const angle of angles) {
          const point = {
            x:
              lens.x +
              0.0175 *
                (Math.cos(angle) * frame.right.x +
                  Math.sin(angle) * frame.up.x),
            y:
              lens.y +
              0.0175 *
                (Math.cos(angle) * frame.right.y +
                  Math.sin(angle) * frame.up.y),
            z:
              lens.z +
              0.0175 *
                (Math.cos(angle) * frame.right.z +
                  Math.sin(angle) * frame.up.z),
          };
          if (
            [frame.center, ...frame.corners].some(
              (ray) =>
                !wallRayIsClear(
                  ray,
                  point,
                  scenario.depth,
                  -0.6,
                  0.6,
                  -0.6,
                  0.6,
                ),
            )
          )
            return false;
        }
        return true;
      });
      expect(expected.length).toBeGreaterThan(0);
      const trajectory = await calculateObstructionAwareTrajectory(input, {
        projectAt,
        yieldToEventLoop: async () => undefined,
      });
      const summary = calculateObstructionVisibilitySummary(input, {
        projectAt,
      });
      for (const result of [trajectory, summary]) {
        expect(result.visibilityIntervals).toHaveLength(expected.length);
        for (let index = 0; index < expected.length; index++)
          for (const endpoint of [
            'startTimestampUtc',
            'endTimestampUtc',
          ] as const)
            expect(
              Math.abs(
                Date.parse(result.visibilityIntervals[index]![endpoint]) -
                  Date.parse(expected[index]![endpoint]),
              ),
            ).toBeLessThanOrEqual(30000);
      }
      expect(summary.visibilityIntervals).toEqual(
        trajectory.visibilityIntervals,
      );
    }
  },
  30000,
);
