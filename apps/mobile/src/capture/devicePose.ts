import type {
  OrientationSnapshot,
  ReviewedTilePlacement,
} from './captureSession';
import {
  MAXIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES,
  MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES,
  type GuidedCaptureAltitudeStatus,
} from './captureSession';
import {
  createPlanetariumCamera,
  createPlanetariumCameraFromBasis,
  getPlanetariumCameraCenter,
  vectorToHorizontalDirection,
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

const VECTOR_EPSILON = 1e-8;
const BOUNDARY_SEGMENTS_PER_EDGE = 24;
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

const normalizeVector = (vector: Vector3): Vector3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= VECTOR_EPSILON) throw new RangeError('Direction is degenerate');
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const directionAtTangent = (
  camera: PlanetariumCamera,
  horizontalTangent: number,
  verticalTangent: number,
) =>
  vectorToHorizontalDirection(
    normalizeVector({
      x:
        camera.forward.x +
        camera.right.x * horizontalTangent +
        camera.up.x * verticalTangent,
      y:
        camera.forward.y +
        camera.right.y * horizontalTangent +
        camera.up.y * verticalTangent,
      z:
        camera.forward.z +
        camera.right.z * horizontalTangent +
        camera.up.z * verticalTangent,
    }),
  );

export const cameraFrameDirections = (
  sample: DevicePoseSample,
  rawFieldOfView: CaptureCameraFieldOfView,
) => {
  const fieldOfView = validateFieldOfView(rawFieldOfView);
  const camera = createPoseDrivenPlanetariumCamera(sample, 90);
  const horizontalTangent = Math.tan(
    (fieldOfView.horizontalDegrees * Math.PI) / 360,
  );
  const verticalTangent = Math.tan(
    (fieldOfView.verticalDegrees * Math.PI) / 360,
  );
  const directions = [];
  for (let index = 0; index <= BOUNDARY_SEGMENTS_PER_EDGE; index += 1) {
    const ratio = (index / BOUNDARY_SEGMENTS_PER_EDGE) * 2 - 1;
    directions.push(
      directionAtTangent(camera, ratio * horizontalTangent, verticalTangent),
      directionAtTangent(camera, ratio * horizontalTangent, -verticalTangent),
      directionAtTangent(camera, horizontalTangent, ratio * verticalTangent),
      directionAtTangent(camera, -horizontalTangent, ratio * verticalTangent),
    );
  }
  // The extrema can occur inside the rectilinear footprint when it contains a
  // celestial pole, so checking corners or the perimeter alone is incorrect.
  for (let row = 0; row <= 12; row += 1) {
    const verticalRatio = (row / 12) * 2 - 1;
    for (let column = 0; column <= 12; column += 1) {
      const horizontalRatio = (column / 12) * 2 - 1;
      directions.push(
        directionAtTangent(
          camera,
          horizontalRatio * horizontalTangent,
          verticalRatio * verticalTangent,
        ),
      );
    }
  }
  return directions;
};

export const poseCaptureAltitudeStatus = (
  sample: DevicePoseSample,
  fieldOfView: CaptureCameraFieldOfView,
): GuidedCaptureAltitudeStatus => {
  const altitudes = cameraFrameDirections(sample, fieldOfView).map(
    ({ altitudeDegrees }) => altitudeDegrees,
  );
  const tooLow =
    Math.min(...altitudes) < MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES;
  const tooHigh =
    Math.max(...altitudes) > MAXIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES;
  if (tooLow && tooHigh) return 'too-tall';
  if (tooLow) return 'too-low';
  if (tooHigh) return 'too-high';
  return 'allowed';
};
