import type { TrackingMode } from '../astronomy/imagingFrame';
import {
  horizontalDirectionToVector,
  type Vector3,
} from '../sky/planetariumProjection';
import type { HorizontalDirectionDegrees } from '../sky/projection';

/** Upright rectangle in east/up/north coordinates. Slopes are height / left
 * horizontal range. The right/left range ratio encodes perspective, not roll.
 * Physical scale comes exclusively from the measured clear width. */
export interface WindowDefinition {
  version: 1;
  leftAzimuthDegrees: number;
  rightAzimuthDegrees: number;
  topSlope: number;
  bottomSlope: number;
  rightDistanceRatio: number;
  widthMeters: number;
}
export interface WindowGeometry {
  definition: WindowDefinition;
  corners: readonly Vector3[];
  normal: Vector3;
  right: Vector3;
  distanceMeters: number;
  heightMeters: number;
  bottomLeft: Vector3;
  planes: readonly Vector3[];
}
export const WINDOW_CONTACT_TOLERANCE_METERS = 1e-7;
const radians = Math.PI / 180;
const origin = { x: 0, y: 0, z: 0 };
export function windowDot(a: Vector3, b: Vector3) {
  'worklet';
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
const normalize = (v: Vector3): Vector3 => {
  'worklet';
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const cross = (a: Vector3, b: Vector3): Vector3 => {
  'worklet';
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
};

export function createWindowGeometry(
  definition: WindowDefinition,
): WindowGeometry {
  'worklet';
  const {
    leftAzimuthDegrees,
    rightAzimuthDegrees,
    topSlope,
    bottomSlope,
    rightDistanceRatio,
    widthMeters,
  } = definition;
  const span = (((rightAzimuthDegrees - leftAzimuthDegrees) % 360) + 360) % 360;
  if (
    definition.version !== 1 ||
    ![
      leftAzimuthDegrees,
      rightAzimuthDegrees,
      topSlope,
      bottomSlope,
      rightDistanceRatio,
      widthMeters,
    ].every(Number.isFinite) ||
    span < 0.1 ||
    span > 160 ||
    widthMeters < 0.01 ||
    widthMeters > 100 ||
    rightDistanceRatio < 0.05 ||
    rightDistanceRatio > 20 ||
    topSlope <= bottomSlope ||
    topSlope - bottomSlope < 0.001 ||
    Math.max(Math.abs(topSlope), Math.abs(bottomSlope)) > 100
  ) {
    throw new RangeError(
      'Keep the corners on an upright, open rectangle and enter a width from 1 to 10,000 cm.',
    );
  }
  const leftRay = horizontalDirectionToVector({
    azimuthDegrees: leftAzimuthDegrees,
    altitudeDegrees: 0,
  });
  const rightRay = horizontalDirectionToVector({
    azimuthDegrees: rightAzimuthDegrees,
    altitudeDegrees: 0,
  });
  const delta = {
    x: rightRay.x * rightDistanceRatio - leftRay.x,
    y: 0,
    z: rightRay.z * rightDistanceRatio - leftRay.z,
  };
  const leftRange = widthMeters / Math.hypot(delta.x, delta.z);
  const right = normalize(delta);
  const normal = { x: -right.z, y: 0, z: right.x };
  const bottomLeft = {
    x: leftRay.x * leftRange,
    y: bottomSlope * leftRange,
    z: leftRay.z * leftRange,
  };
  const distanceMeters = windowDot(normal, bottomLeft);
  if (distanceMeters < widthMeters * 0.001)
    throw new RangeError('The window is too edge-on. Adjust the corners.');
  const heightMeters = (topSlope - bottomSlope) * leftRange;
  const topLeft = { ...bottomLeft, y: topSlope * leftRange };
  const bottomRight = {
    x: rightRay.x * rightDistanceRatio * leftRange,
    y: bottomLeft.y,
    z: rightRay.z * rightDistanceRatio * leftRange,
  };
  const topRight = { ...bottomRight, y: topLeft.y };
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const center = normalize({
    x: (topLeft.x + bottomRight.x) / 2,
    y: (topLeft.y + bottomRight.y) / 2,
    z: (topLeft.z + bottomRight.z) / 2,
  });
  const planes = corners.map((corner, index) => {
    const plane = normalize(cross(corner, corners[(index + 1) % 4]!));
    const sign = windowDot(plane, center) < 0 ? -1 : 1;
    return { x: plane.x * sign, y: plane.y * sign, z: plane.z * sign };
  });
  return {
    definition,
    corners,
    normal,
    right,
    distanceMeters,
    heightMeters,
    bottomLeft,
    planes,
  };
}

/** Left handles change the opening's height; right handles adjust perspective
 * while keeping the left edge fixed. Each drag follows the finger exactly and
 * updates the connected opposite corner to keep the rectangle upright. */
export function moveWindowCorner(
  definition: WindowDefinition,
  corner: number,
  direction: HorizontalDirectionDegrees,
): WindowDefinition {
  'worklet';
  const slope = Math.tan(direction.altitudeDegrees * radians);
  const top = corner < 2;
  const left = corner === 0 || corner === 3;
  const updated = left
    ? {
        ...definition,
        leftAzimuthDegrees: direction.azimuthDegrees,
        ...(top ? { topSlope: slope } : { bottomSlope: slope }),
      }
    : {
        ...definition,
        rightAzimuthDegrees: direction.azimuthDegrees,
        rightDistanceRatio:
          (top ? definition.topSlope : definition.bottomSlope) / slope,
      };
  createWindowGeometry(updated);
  return updated;
}

export function createInitialWindow(
  direction: HorizontalDirectionDegrees,
): WindowDefinition {
  'worklet';
  const altitude = Math.max(15, Math.min(65, direction.altitudeDegrees));
  return {
    version: 1,
    leftAzimuthDegrees: (direction.azimuthDegrees + 345) % 360,
    rightAzimuthDegrees: (direction.azimuthDegrees + 15) % 360,
    topSlope: Math.tan((altitude + 10) * radians),
    bottomSlope: Math.tan((altitude - 10) * radians),
    rightDistanceRatio: 1,
    widthMeters: 1,
  };
}

export function windowContainsRay(
  geometry: WindowGeometry,
  ray: Vector3,
  lens: Vector3 = origin,
): boolean {
  'worklet';
  const distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  const denominator = windowDot(geometry.normal, ray);
  if (distance <= WINDOW_CONTACT_TOLERANCE_METERS || denominator <= 1e-10)
    return false;
  const travel = distance / denominator;
  const relative = {
    x: lens.x + ray.x * travel - geometry.bottomLeft.x,
    y: lens.y + ray.y * travel - geometry.bottomLeft.y,
    z: lens.z + ray.z * travel - geometry.bottomLeft.z,
  };
  const across = windowDot(relative, geometry.right);
  const tolerance = WINDOW_CONTACT_TOLERANCE_METERS;
  return (
    across > tolerance &&
    across < geometry.definition.widthMeters - tolerance &&
    relative.y > tolerance &&
    relative.y < geometry.heightMeters - tolerance
  );
}

export function windowPlanesAtLens(
  geometry: WindowGeometry,
  lens: Vector3,
): readonly Vector3[] {
  const corners = geometry.corners.map((point) => ({
    x: point.x - lens.x,
    y: point.y - lens.y,
    z: point.z - lens.z,
  }));
  const center = {
    x: corners[0]!.x + corners[2]!.x,
    y: corners[0]!.y + corners[2]!.y,
    z: corners[0]!.z + corners[2]!.z,
  };
  return corners.map((point, index) => {
    const plane = normalize(cross(point, corners[(index + 1) % 4]!));
    const sign = windowDot(plane, center) < 0 ? -1 : 1;
    return { x: sign * plane.x, y: sign * plane.y, z: sign * plane.z };
  });
}

/** Signed offset: positive is right when looking out along the telescope, with
 * local up (AltAz) or celestial north (EQ) at the top. A field rotator changes
 * sensor orientation, not the physical AltAz displacement. Origin is the mount
 * axis at imaging-lens height, where the panorama should be captured. */
export function lensPositionMeters(
  direction: HorizontalDirectionDegrees,
  offsetMillimeters: number,
  trackingMode: TrackingMode,
  latitudeDegrees: number,
): Vector3 {
  'worklet';
  if (
    !Number.isFinite(offsetMillimeters) ||
    Math.abs(offsetMillimeters) > 10_000
  )
    throw new RangeError('Invalid lens offset.');
  if (!offsetMillimeters) return origin;
  const forward = horizontalDirectionToVector(direction);
  const azimuth = direction.azimuthDegrees * radians;
  let right: Vector3 = { x: Math.cos(azimuth), y: 0, z: -Math.sin(azimuth) };
  if (trackingMode === 'equatorial') {
    const pole = {
      x: 0,
      y: Math.sin(latitudeDegrees * radians),
      z: Math.cos(latitudeDegrees * radians),
    };
    const tangent = cross(pole, forward);
    right =
      Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-10
        ? { x: 1, y: 0, z: 0 }
        : normalize(tangent);
  }
  const distance = offsetMillimeters / 1000;
  return {
    x: right.x * distance,
    y: right.y * distance,
    z: right.z * distance,
  };
}
