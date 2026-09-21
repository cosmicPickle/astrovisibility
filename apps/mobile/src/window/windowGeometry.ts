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

export function windowPlanesAtLens(
  geometry: WindowGeometry,
  lens: Vector3,
): readonly Vector3[] {
  'worklet';
  let distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  if (Math.abs(distance) <= WINDOW_CONTACT_TOLERANCE_METERS) distance = 0;
  const across = windowDot(
    {
      x: lens.x - geometry.bottomLeft.x,
      y: 0,
      z: lens.z - geometry.bottomLeft.z,
    },
    geometry.right,
  );
  const height = lens.y - geometry.bottomLeft.y;
  return [
    { axis: geometry.right, sign: 1, margin: across },
    {
      axis: geometry.right,
      sign: -1,
      margin: geometry.definition.widthMeters - across,
    },
    { axis: { x: 0, y: 1, z: 0 }, sign: 1, margin: height },
    {
      axis: { x: 0, y: 1, z: 0 },
      sign: -1,
      margin: geometry.heightMeters - height,
    },
  ].map(({ axis, sign, margin }) => {
    const plane = {
      x: sign * distance * axis.x + margin * geometry.normal.x,
      y: sign * distance * axis.y + margin * geometry.normal.y,
      z: sign * distance * axis.z + margin * geometry.normal.z,
    };
    // A lens exactly on a frame edge is blocked, without creating a NaN normal.
    const length = Math.hypot(plane.x, plane.y, plane.z);
    return length <= WINDOW_CONTACT_TOLERANCE_METERS
      ? origin
      : { x: plane.x / length, y: plane.y / length, z: plane.z / length };
  });
}

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
    span < 1e-7 ||
    span > 360 - 1e-7 ||
    widthMeters < 0.01 ||
    widthMeters > 100 ||
    rightDistanceRatio < 1e-6 ||
    rightDistanceRatio > 1e6 ||
    topSlope <= bottomSlope ||
    topSlope - bottomSlope < 1e-9 ||
    Math.max(Math.abs(topSlope), Math.abs(bottomSlope)) > 1e6
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
  const heightMeters = (topSlope - bottomSlope) * leftRange;
  const topLeft = { ...bottomLeft, y: topSlope * leftRange };
  const bottomRight = {
    x: rightRay.x * rightDistanceRatio * leftRange,
    y: bottomLeft.y,
    z: rightRay.z * rightDistanceRatio * leftRange,
  };
  const topRight = { ...bottomRight, y: topLeft.y };
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const geometry = {
    definition,
    corners,
    normal,
    right,
    distanceMeters,
    heightMeters,
    bottomLeft,
    planes: [] as readonly Vector3[],
  };
  geometry.planes = windowPlanesAtLens(geometry, origin);
  return geometry;
}

/** Both sides resize their row. Right handles also fit perspective with the
 * smallest squared change in dimensionless row height and horizontal range.
 * Unlike height / tan(altitude), this stays finite across the horizon. */
export function moveWindowCorner(
  definition: WindowDefinition,
  corner: number,
  direction: HorizontalDirectionDegrees,
): WindowDefinition {
  'worklet';
  const slope = Math.tan(direction.altitudeDegrees * radians);
  const top = corner < 2;
  const left = corner === 0 || corner === 3;
  const oldSlope = top ? definition.topSlope : definition.bottomSlope;
  const ratio = left
    ? definition.rightDistanceRatio
    : Math.max(
        1e-6,
        Math.min(
          1e6,
          (slope * oldSlope + definition.rightDistanceRatio) /
            (slope * slope + 1),
        ),
      );
  const updated = left
    ? {
        ...definition,
        leftAzimuthDegrees: direction.azimuthDegrees,
        ...(top ? { topSlope: slope } : { bottomSlope: slope }),
      }
    : {
        ...definition,
        rightAzimuthDegrees: direction.azimuthDegrees,
        rightDistanceRatio: ratio,
        ...(top ? { topSlope: slope * ratio } : { bottomSlope: slope * ratio }),
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
  let distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  if (Math.abs(distance) <= WINDOW_CONTACT_TOLERANCE_METERS) distance = 0;
  const across =
    (lens.x - geometry.bottomLeft.x) * geometry.right.x +
    (lens.z - geometry.bottomLeft.z) * geometry.right.z;
  const height = lens.y - geometry.bottomLeft.y;
  const forward = windowDot(geometry.normal, ray);
  const lateral = windowDot(geometry.right, ray);
  const rightMargin = geometry.definition.widthMeters - across;
  const topMargin = geometry.heightMeters - height;
  // These are the four oriented plane dot products before normalization.
  // Avoid constructing four vectors for the center-only early rejection.
  const leftLength = Math.hypot(distance, across);
  const rightLength = Math.hypot(distance, rightMargin);
  const bottomLength = Math.hypot(distance, height);
  const topLength = Math.hypot(distance, topMargin);
  const leftClear =
    leftLength > WINDOW_CONTACT_TOLERANCE_METERS &&
    distance * lateral + across * forward > 1e-10 * leftLength;
  const rightClear =
    rightLength > WINDOW_CONTACT_TOLERANCE_METERS &&
    -distance * lateral + rightMargin * forward > 1e-10 * rightLength;
  const bottomClear =
    bottomLength > WINDOW_CONTACT_TOLERANCE_METERS &&
    distance * ray.y + height * forward > 1e-10 * bottomLength;
  const topClear =
    topLength > WINDOW_CONTACT_TOLERANCE_METERS &&
    -distance * ray.y + topMargin * forward > 1e-10 * topLength;
  // Beyond the plane the sky is the exterior of the rear boundary, not a
  // convex aperture in front of the lens. At contact use the outward hemisphere
  // only when the lens lies inside the opening (all four normals agree).
  return distance < -WINDOW_CONTACT_TOLERANCE_METERS
    ? leftClear || rightClear || bottomClear || topClear
    : leftClear && rightClear && bottomClear && topClear;
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
  const azimuth = direction.azimuthDegrees * radians;
  let right: Vector3 = { x: Math.cos(azimuth), y: 0, z: -Math.sin(azimuth) };
  if (trackingMode === 'equatorial') {
    const forward = horizontalDirectionToVector(direction);
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
