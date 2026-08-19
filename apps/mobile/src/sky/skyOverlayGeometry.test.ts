import type { TrajectorySample } from '../astronomy/trajectory';
import { TRAJECTORY_MARKER_HIT_RADIUS_PIXELS } from './SkyCanvas';
import {
  buildClassifiedTrajectoryViewportSegments,
  buildTrajectoryViewportSegments,
  projectFieldOfViewToViewport,
} from './skyOverlayGeometry';
import { createSkyViewport } from './skyViewport';

const sample = (
  azimuthDegrees: number,
  altitudeDegrees: number,
  assessment: TrajectorySample['assessment'] = 'unassessed',
): TrajectorySample => ({
  azimuthDegreesClockwiseFromNorth: azimuthDegrees,
  refractedAltitudeDegrees: altitudeDegrees,
  unwrappedAzimuthDegrees: azimuthDegrees,
  timestampUtc: '2026-08-19T20:00:00.000Z',
  assessment,
});

describe('skyOverlayGeometry', () => {
  const canvas = { widthPixels: 360, heightPixels: 180 };
  const viewport = createSkyViewport({
    centerAltitudeDegrees: 45,
    centerAzimuthDegrees: 180,
    horizontalSpanDegrees: 360,
  });

  it('keeps trajectory marker touch targets at least 44 pixels wide', () => {
    expect(TRAJECTORY_MARKER_HIT_RADIUS_PIXELS * 2).toBeGreaterThanOrEqual(44);
  });

  it('omits below-horizon trajectory samples and breaks rather than drawing across the seam', () => {
    const segments = buildTrajectoryViewportSegments(
      [
        sample(355, 30),
        sample(359, 31),
        sample(1, 32),
        sample(5, -1, 'belowHorizon'),
        sample(10, 34),
      ],
      viewport,
      canvas,
    );

    expect(segments.flat()).toHaveLength(4);
    expect(segments).toHaveLength(3);
    expect(
      segments.every((segment) =>
        segment.every((point) => point.altitudeDegrees >= 0),
      ),
    ).toBe(true);
  });

  it('splits visible and blocked trajectory geometry without losing their shared transition', () => {
    const segments = buildClassifiedTrajectoryViewportSegments(
      [
        sample(170, 30, 'visible'),
        sample(175, 31, 'visible'),
        sample(180, 32, 'blocked'),
        sample(185, 33, 'blocked'),
        sample(190, 34, 'visible'),
      ],
      viewport,
      canvas,
    );

    expect(segments.map(({ assessment }) => assessment)).toEqual([
      'visible',
      'blocked',
      'visible',
    ]);
    expect(segments[0]!.points.at(-1)).toEqual(segments[1]!.points[0]);
    expect(segments[1]!.points.at(-1)).toEqual(segments[2]!.points[0]);
  });

  it('projects a rotated selected-equipment rectangle around the target', () => {
    const polygon = projectFieldOfViewToViewport(
      { altitudeDegrees: 45, azimuthDegrees: 180 },
      {
        focalLengthMillimeters: 400,
        sensorWidthMillimeters: 24,
        sensorHeightMillimeters: 16,
        frameRotationDegrees: 90,
      },
      viewport,
      canvas,
    );

    expect(polygon).not.toBeNull();
    expect(polygon!.points).toHaveLength(4);
    expect(polygon!.verticalFovDegrees).toBeCloseTo(2.29, 1);
    expect(polygon!.horizontalFovDegrees).toBeCloseTo(3.44, 1);
  });
});
