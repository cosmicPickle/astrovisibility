import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import { createWindowHorizontalProjector } from '../astronomy/horizontalCoordinates';
import { createSelectedTargetTrajectory } from '../astronomy/trajectory';
import {
  createEquatorialMountFrame,
  createEquatorialPlanetariumCamera,
  createPlanetariumCamera,
  mountDirectionToHorizontalDirection,
  projectHorizontalDirection,
} from './planetariumProjection';
import { createProjectedTrajectoryGroups } from './planetariumTrajectory';

const canvas = { widthPixels: 400, heightPixels: 800 };

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
  it('splits clear trajectory segments into daytime and astronomical darkness while blocked stays gray-classified', () => {
    const groups = createProjectedTrajectoryGroups(trajectory, [
      {
        startTimestampUtc: '2026-08-19T20:04:00.000Z',
        endTimestampUtc: '2026-08-19T20:12:00.000Z',
        durationMilliseconds: 8 * 60_000,
      },
    ]);

    expect(groups.map(({ kind }) => kind)).toEqual([
      'daytime',
      'astronomicalDarkness',
      'blocked',
    ]);
  });

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

  it('splits above-horizon groups across a below-horizon gap', () => {
    const groups = createProjectedTrajectoryGroups({
      ...trajectory,
      samples: [
        trajectory.samples[0]!,
        { ...trajectory.samples[1]!, assessment: 'belowHorizon' },
        trajectory.samples[2]!,
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups.map(({ directions }) => directions.length)).toEqual([1, 1]);
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

  it('keeps the real Iris Nebula night track on its small circle around the celestial pole', () => {
    const observer = {
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
      elevationMetersAboveMeanSeaLevel: 550,
    };
    const target = {
      rightAscensionJ2000Hours: 21.03,
      declinationJ2000Degrees: 68.17,
    };
    const window = {
      startTimestampUtc: '2026-08-20T18:00:00.000Z',
      endTimestampUtc: '2026-08-21T06:00:00.000Z',
    };
    const actualTrajectory = createSelectedTargetTrajectory({
      observer,
      projectAt: createWindowHorizontalProjector({ observer, target, window }),
      target,
      timeZoneId: 'Europe/Sofia',
      window,
    });
    const mountFrame = createEquatorialMountFrame(
      observer.latitudeDegreesNorth,
    );
    const pole = mountDirectionToHorizontalDirection(mountFrame, {
      latitudeDegrees: 90,
      longitudeDegrees: 0,
    });
    const poleCamera = createEquatorialPlanetariumCamera({
      centerAltitudeDegrees: pole.altitudeDegrees,
      centerAzimuthDegrees: pole.azimuthDegrees,
      fieldOfViewDegrees: 120,
      observerLatitudeDegrees: observer.latitudeDegreesNorth,
    });
    const radii = createProjectedTrajectoryGroups(actualTrajectory)
      .flatMap(({ directions }) => directions)
      .map((direction) => {
        const point = projectHorizontalDirection(direction, poleCamera, canvas);
        return Math.hypot(
          point.xPixels - canvas.widthPixels / 2,
          point.yPixels - canvas.heightPixels / 2,
        );
      });

    expect(radii.length).toBeGreaterThan(600);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.5);
  });
});
