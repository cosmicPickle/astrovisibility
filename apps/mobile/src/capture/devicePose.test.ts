import {
  cameraFrameDirections,
  createPoseDrivenPlanetariumCamera,
  devicePoseToReviewedPlacement,
  devicePoseToOrientationSnapshot,
  poseCaptureAltitudeStatus,
  smoothDevicePose,
  validateDevicePoseSample,
  type DevicePoseSample,
} from './devicePose';
import { getPlanetariumCameraCenter } from '../sky/planetariumProjection';

const northHorizonPose: DevicePoseSample = {
  accuracy: 3,
  forward: { east: 0, north: 1, up: 0 },
  right: { east: 1, north: 0, up: 0 },
  timestampNanoseconds: 1_000_000_000,
  up: { east: 0, north: 0, up: 1 },
};

describe('native device pose boundary', () => {
  it('maps rear-camera cardinal bases directly into the planetarium camera', () => {
    const north = createPoseDrivenPlanetariumCamera(northHorizonPose, 100);
    expect(getPlanetariumCameraCenter(north)).toEqual({
      altitudeDegrees: 0,
      azimuthDegrees: 0,
    });
    expect(north.forward).toEqual({ x: 0, y: 0, z: 1 });
    expect(north.right).toEqual({ x: 1, y: 0, z: 0 });
    expect(north.up).toEqual({ x: 0, y: 1, z: 0 });

    const east = createPoseDrivenPlanetariumCamera(
      {
        ...northHorizonPose,
        forward: { east: 1, north: 0, up: 0 },
        right: { east: 0, north: -1, up: 0 },
      },
      100,
    );
    expect(getPlanetariumCameraCenter(east)).toEqual({
      altitudeDegrees: 0,
      azimuthDegrees: 90,
    });
  });

  it('preserves a full rolled basis and derives the same saved placement', () => {
    const rollRadians = Math.PI / 6;
    const pose: DevicePoseSample = {
      ...northHorizonPose,
      right: {
        east: Math.cos(rollRadians),
        north: 0,
        up: Math.sin(rollRadians),
      },
      up: {
        east: -Math.sin(rollRadians),
        north: 0,
        up: Math.cos(rollRadians),
      },
    };
    const camera = createPoseDrivenPlanetariumCamera(pose, 100);
    expect(camera.right.x).toBeCloseTo(Math.cos(rollRadians));
    expect(camera.right.y).toBeCloseTo(Math.sin(rollRadians));
    expect(camera.up.x).toBeCloseTo(-Math.sin(rollRadians));
    expect(camera.up.y).toBeCloseTo(Math.cos(rollRadians));
    const placement = devicePoseToReviewedPlacement(pose, {
      horizontalDegrees: 55,
      verticalDegrees: 69,
    });
    expect(placement).toMatchObject({
      centerAltitudeDegrees: 0,
      centerAzimuthDegrees: 0,
      horizontalFieldOfViewDegrees: 55,
      verticalFieldOfViewDegrees: 69,
    });
    expect(placement.rollDegrees).toBeCloseTo(30, 10);
    expect(devicePoseToOrientationSnapshot(pose)).toMatchObject({
      estimatedAltitudeDegrees: 0,
      headingAccuracyDegrees: 5,
      rawRotation: null,
      trueHeadingDegrees: 0,
    });
    expect(devicePoseToOrientationSnapshot(pose).rollDegrees).toBeCloseTo(
      30,
      10,
    );
  });

  it('normalizes a finite near-orthogonal basis and rejects unsafe samples', () => {
    const validated = validateDevicePoseSample({
      ...northHorizonPose,
      forward: { east: 0.001, north: 1.002, up: 0.001 },
      right: { east: 0.999, north: 0.001, up: 0 },
      up: { east: 0, north: 0.001, up: 1.001 },
    });
    expect(Math.hypot(...Object.values(validated.forward))).toBeCloseTo(1);
    expect(Math.hypot(...Object.values(validated.right))).toBeCloseTo(1);
    expect(Math.hypot(...Object.values(validated.up))).toBeCloseTo(1);
    expect(
      validated.forward.east * validated.up.east +
        validated.forward.north * validated.up.north +
        validated.forward.up * validated.up.up,
    ).toBeCloseTo(0);

    expect(() =>
      validateDevicePoseSample({
        ...northHorizonPose,
        forward: { east: Number.NaN, north: 1, up: 0 },
      }),
    ).toThrow(/finite/i);
    expect(() =>
      validateDevicePoseSample({
        ...northHorizonPose,
        up: { east: 0, north: 1, up: 0 },
      }),
    ).toThrow(/degenerate/i);
  });

  it('smooths vectors as one orthonormal basis without Euler wrap', () => {
    const eastPose: DevicePoseSample = {
      ...northHorizonPose,
      forward: { east: 1, north: 0, up: 0 },
      right: { east: 0, north: -1, up: 0 },
      timestampNanoseconds: 1_020_000_000,
    };
    const smoothed = smoothDevicePose(northHorizonPose, eastPose, 0.25);
    expect(smoothed.forward.east).toBeGreaterThan(0);
    expect(smoothed.forward.north).toBeGreaterThan(smoothed.forward.east);
    expect(
      smoothed.forward.east * smoothed.right.east +
        smoothed.forward.north * smoothed.right.north +
        smoothed.forward.up * smoothed.right.up,
    ).toBeCloseTo(0);
    expect(smoothed.timestampNanoseconds).toBe(1_020_000_000);
  });
});

describe('spherical capture footprint', () => {
  it('uses all four camera-frame corners for the 20 through 80 degree limits', () => {
    const upward45: DevicePoseSample = {
      ...northHorizonPose,
      forward: {
        east: 0,
        north: Math.SQRT1_2,
        up: Math.SQRT1_2,
      },
      right: { east: 1, north: 0, up: 0 },
      up: {
        east: 0,
        north: -Math.SQRT1_2,
        up: Math.SQRT1_2,
      },
    };
    const fieldOfView = { horizontalDegrees: 55, verticalDegrees: 40 };
    const directions = cameraFrameDirections(upward45, fieldOfView);
    const altitudes = directions.map(({ altitudeDegrees }) => altitudeDegrees);
    expect(directions.length).toBeGreaterThanOrEqual(64);
    // A rectilinear camera's spherical corner altitudes are not centre ± half
    // the vertical FOV when the horizontal FOV is non-zero.
    expect(Math.min(...altitudes)).toBeGreaterThan(22);
    expect(Math.min(...altitudes)).toBeLessThan(23);
    expect(Math.max(...altitudes)).toBeGreaterThan(64);
    expect(Math.max(...altitudes)).toBeLessThan(66);
    expect(poseCaptureAltitudeStatus(upward45, fieldOfView)).toBe('allowed');

    const low = {
      ...upward45,
      forward: { east: 0, north: Math.cos(Math.PI / 6), up: 0.5 },
      up: { east: 0, north: -0.5, up: Math.cos(Math.PI / 6) },
    };
    expect(poseCaptureAltitudeStatus(low, fieldOfView)).toBe('too-low');
  });
});
