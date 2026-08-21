import type {
  OrientationSnapshot,
  ReviewedTilePlacement,
} from './captureSession';
import {
  MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES,
  type GuidedCaptureAltitudeStatus,
} from './captureSession';
import {
  createPlanetariumCamera,
  createPlanetariumCameraFromBasis,
  getPlanetariumCameraCenter,
  type PlanetariumCamera,
  type Vector3,
} from '../sky/planetariumProjection';

export interface DevicePoseVector {
  east: number;
  north: number;
  up: number;
}

export interface DevicePoseSample {
  accuracy: number;
  forward: DevicePoseVector;
  right: DevicePoseVector;
  timestampNanoseconds: number;
  up: DevicePoseVector;
}

export interface CaptureCameraFieldOfView {
  approximate?: boolean;
  horizontalDegrees: number;
  verticalDegrees: number;
}

const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

const finiteVector = (vector: DevicePoseVector) =>
  Number.isFinite(vector.east) &&
  Number.isFinite(vector.north) &&
  Number.isFinite(vector.up);

const toPlanetariumVector = (vector: DevicePoseVector): Vector3 => ({
  x: vector.east,
  y: vector.up,
  z: vector.north,
});

const toDevicePoseVector = (vector: Vector3): DevicePoseVector => ({
  east: vector.x,
  north: vector.z,
  up: vector.y,
});

const validateFieldOfView = (fieldOfView: CaptureCameraFieldOfView) => {
  if (
    !Number.isFinite(fieldOfView.horizontalDegrees) ||
    !Number.isFinite(fieldOfView.verticalDegrees) ||
    fieldOfView.horizontalDegrees <= 0 ||
    fieldOfView.horizontalDegrees >= 180 ||
    fieldOfView.verticalDegrees <= 0 ||
    fieldOfView.verticalDegrees >= 180
  ) {
    throw new RangeError(
      'Camera field of view must be finite and within 0..180',
    );
  }
  return fieldOfView;
};

export const validateDevicePoseSample = (
  sample: DevicePoseSample,
): DevicePoseSample => {
  if (
    !finiteVector(sample.forward) ||
    !finiteVector(sample.right) ||
    !finiteVector(sample.up) ||
    !Number.isFinite(sample.accuracy) ||
    !Number.isFinite(sample.timestampNanoseconds)
  ) {
    throw new RangeError('Device pose values must be finite');
  }
  const camera = createPlanetariumCameraFromBasis({
    fieldOfViewDegrees: 90,
    forward: toPlanetariumVector(sample.forward),
    right: toPlanetariumVector(sample.right),
    up: toPlanetariumVector(sample.up),
  });
  return {
    ...sample,
    forward: toDevicePoseVector(camera.forward),
    right: toDevicePoseVector(camera.right),
    up: toDevicePoseVector(camera.up),
  };
};

export const createPoseDrivenPlanetariumCamera = (
  sample: DevicePoseSample,
  fieldOfViewDegrees: number,
): PlanetariumCamera => {
  const validated = validateDevicePoseSample(sample);
  return createPlanetariumCameraFromBasis({
    fieldOfViewDegrees,
    forward: toPlanetariumVector(validated.forward),
    right: toPlanetariumVector(validated.right),
    up: toPlanetariumVector(validated.up),
  });
};

const interpolateVector = (
  current: DevicePoseVector,
  next: DevicePoseVector,
  factor: number,
): DevicePoseVector => ({
  east: current.east + (next.east - current.east) * factor,
  north: current.north + (next.north - current.north) * factor,
  up: current.up + (next.up - current.up) * factor,
});

export const smoothDevicePose = (
  current: DevicePoseSample,
  next: DevicePoseSample,
  factor: number,
): DevicePoseSample => {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
    throw new RangeError('Pose smoothing factor must be within 0..1');
  }
  return validateDevicePoseSample({
    accuracy: next.accuracy,
    forward: interpolateVector(current.forward, next.forward, factor),
    right: interpolateVector(current.right, next.right, factor),
    timestampNanoseconds: next.timestampNanoseconds,
    up: interpolateVector(current.up, next.up, factor),
  });
};

export const devicePoseToReviewedPlacement = (
  sample: DevicePoseSample,
  rawFieldOfView: CaptureCameraFieldOfView,
): ReviewedTilePlacement => {
  const fieldOfView = validateFieldOfView(rawFieldOfView);
  const camera = createPoseDrivenPlanetariumCamera(sample, 90);
  const center = getPlanetariumCameraCenter(camera);
  const unrolledCamera = createPlanetariumCamera({
    centerAltitudeDegrees: center.altitudeDegrees,
    centerAzimuthDegrees: center.azimuthDegrees,
    fieldOfViewDegrees: 90,
  });
  const cosineRoll =
    camera.up.x * unrolledCamera.up.x +
    camera.up.y * unrolledCamera.up.y +
    camera.up.z * unrolledCamera.up.z;
  const sineRoll = -(
    camera.up.x * unrolledCamera.right.x +
    camera.up.y * unrolledCamera.right.y +
    camera.up.z * unrolledCamera.right.z
  );
  return {
    centerAltitudeDegrees: center.altitudeDegrees,
    centerAzimuthDegrees: center.azimuthDegrees,
    horizontalFieldOfViewDegrees: fieldOfView.horizontalDegrees,
    rollDegrees: radiansToDegrees(Math.atan2(sineRoll, cosineRoll)),
    verticalFieldOfViewDegrees: fieldOfView.verticalDegrees,
  };
};

const headingAccuracyDegrees = (sensorAccuracy: number) => {
  if (sensorAccuracy >= 3) return 5;
  if (sensorAccuracy === 2) return 15;
  if (sensorAccuracy === 1) return 30;
  return null;
};

export const devicePoseToOrientationSnapshot = (
  sample: DevicePoseSample,
): OrientationSnapshot => {
  const placement = devicePoseToReviewedPlacement(sample, {
    horizontalDegrees: 60,
    verticalDegrees: 60,
  });
  return {
    estimatedAltitudeDegrees: placement.centerAltitudeDegrees,
    headingAccuracyDegrees: headingAccuracyDegrees(sample.accuracy),
    rawRotation: null,
    rollDegrees: placement.rollDegrees,
    trueHeadingDegrees: placement.centerAzimuthDegrees,
  };
};

export const poseCaptureAltitudeStatus = (
  sample: DevicePoseSample,
): GuidedCaptureAltitudeStatus => {
  const camera = createPoseDrivenPlanetariumCamera(sample, 90);
  const centerAltitudeDegrees =
    getPlanetariumCameraCenter(camera).altitudeDegrees;
  return centerAltitudeDegrees < MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES
    ? 'below-horizon'
    : 'allowed';
};
