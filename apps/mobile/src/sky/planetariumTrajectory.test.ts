import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import {
  createPlanetariumCamera,
  projectHorizontalDirection,
} from './planetariumProjection';
import { createProjectedTrajectoryGroups } from './planetariumTrajectory';

const trajectory: SelectedTargetTrajectory = {
  samples: [
    {
      assessment: 'visible',
      azimuthDegreesClockwiseFromNorth: 350,
      refractedAltitudeDegrees: 42,
      timestampUtc: '2026-08-19T20:00:00.000Z',
      unwrappedAzimuthDegrees: 350,
    },
    {
      assessment: 'visible',
      azimuthDegreesClockwiseFromNorth: 2,
      refractedAltitudeDegrees: 48,
      timestampUtc: '2026-08-19T20:05:00.000Z',
      unwrappedAzimuthDegrees: 362,
    },
    {
      assessment: 'blocked',
      azimuthDegreesClockwiseFromNorth: 18,
      refractedAltitudeDegrees: 53,
      timestampUtc: '2026-08-19T20:10:00.000Z',
      unwrappedAzimuthDegrees: 378,
    },
    {
      assessment: 'blocked',
      azimuthDegreesClockwiseFromNorth: 32,
      refractedAltitudeDegrees: 56,
      timestampUtc: '2026-08-19T20:15:00.000Z',
      unwrappedAzimuthDegrees: 392,
    },
  ],
  markers: [],
  aboveHorizonIntervals: [],
  visibilityIntervals: [],
  blockedIntervals: [],
  transitions: [],
  totalAboveHorizonMilliseconds: 900_000,
  totalVisibleMilliseconds: 300_000,
};

describe('planetarium trajectory projection', () => {
  it('uses only exact time-evaluated directions and shares transition endpoints', () => {
    const groups = createProjectedTrajectoryGroups(trajectory);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.directions).toHaveLength(3);
    expect(groups[1]!.directions).toHaveLength(2);
    expect(groups[0]!.directions.at(-1)).toEqual(groups[1]!.directions[0]);
    const evaluatedDirections = trajectory.samples.map((sample) => ({
      altitudeDegrees: sample.refractedAltitudeDegrees,
      azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
    }));
    expect(
      groups
        .flatMap(({ directions }) => directions)
        .every((direction) =>
          evaluatedDirections.some(
            (evaluated) =>
              evaluated.altitudeDegrees === direction.altitudeDegrees &&
              evaluated.azimuthDegrees === direction.azimuthDegrees,
          ),
        ),
    ).toBe(true);
  });

  it('keeps a north-crossing path locally continuous after projection', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 50,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 120,
    });
    const points = createProjectedTrajectoryGroups(trajectory).flatMap(
      (group) =>
        group.directions.map((direction) =>
          projectHorizontalDirection(direction, camera, {
            widthPixels: 400,
            heightPixels: 800,
          }),
        ),
    );

    for (let index = 1; index < points.length; index += 1) {
      expect(
        Math.hypot(
          points[index]!.xPixels - points[index - 1]!.xPixels,
          points[index]!.yPixels - points[index - 1]!.yPixels,
        ),
      ).toBeLessThan(40);
    }
  });
});
