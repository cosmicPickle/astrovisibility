import {
  horizontalDirectionToVector,
  vectorToHorizontalDirection,
  type Vector3,
} from '../sky/planetariumProjection';
import { normalRefractionDegrees } from './celestialTimeTransform';
import type { HorizontalCoordinates } from './horizontalCoordinates';

export type TrackingMode = 'altaz' | 'equatorial' | 'derotatedAltaz';
export type ImagingFrameSettings = Readonly<{
  apertureMillimeters?: number;
  lensOffsetMillimeters?: number;
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
  orientationDegrees: number;
  trackingMode: TrackingMode;
}>;
export type ImagingFrame = Readonly<{
  center: Vector3;
  right: Vector3;
  up: Vector3;
  corners: readonly Vector3[];
  /** Inward unit normals of the four great-circle footprint boundaries. */
  planes: readonly Vector3[];
}>;

const radians = Math.PI / 180;
const dot = (a: Vector3, b: Vector3) => {
  'worklet';
  return a.x * b.x + a.y * b.y + a.z * b.z;
};
const normalize = (v: Vector3): Vector3 => {
  'worklet';
  const length = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(length) || length < 1e-12)
    throw new RangeError('Invalid imaging frame basis.');
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

function celestialUp(
  horizontal: HorizontalCoordinates,
  latitude: number,
  center: Vector3,
): Vector3 {
  'worklet';
  // Remove refraction before constructing the celestial north tangent, then
  // refract a nearby ray to measure its apparent direction on the camera plane.
  let altitude = horizontal.refractedAltitudeDegrees;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    altitude =
      horizontal.refractedAltitudeDegrees - normalRefractionDegrees(altitude);
  }
  const geometricCenter = horizontalDirectionToVector({
    azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
    altitudeDegrees: altitude,
  });
  const pole = {
    x: 0,
    y: Math.sin(latitude * radians),
    z: Math.cos(latitude * radians),
  };
  const component = dot(pole, geometricCenter);
  let tangent = {
    x: pole.x - component * geometricCenter.x,
    y: pole.y - component * geometricCenter.y,
    z: pole.z - component * geometricCenter.z,
  };
  if (Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-10) {
    // Position angle at the pole has no unique north. Use a deterministic
    // limiting meridian instead of producing NaNs or a screen-dependent frame.
    tangent = cross(geometricCenter, { x: 1, y: 0, z: 0 });
  }
  tangent = normalize(tangent);
  const nearby = vectorToHorizontalDirection({
    x: geometricCenter.x + tangent.x * 1e-5,
    y: geometricCenter.y + tangent.y * 1e-5,
    z: geometricCenter.z + tangent.z * 1e-5,
  });
  const observed = horizontalDirectionToVector({
    ...nearby,
    altitudeDegrees:
      nearby.altitudeDegrees + normalRefractionDegrees(nearby.altitudeDegrees),
  });
  const forward = dot(observed, center);
  return normalize({
    x: observed.x - forward * center.x,
    y: observed.y - forward * center.y,
    z: observed.z - forward * center.z,
  });
}

/** Physical tangent-plane rectangle, in the shared east/up/north vector frame.
 * Zero is local up for AltAz, celestial north for EQ/derotation. Positive angles
 * rotate the sensor's vertical axis north through east for celestial framing,
 * clockwise when viewed on a north-up chart. Refraction uses the existing model.
 */
export function createImagingFrame(
  input: ImagingFrameSettings & {
    horizontal: HorizontalCoordinates;
    observerLatitudeDegrees: number;
  },
): ImagingFrame {
  'worklet';
  for (const angle of [input.horizontalFovDegrees, input.verticalFovDegrees]) {
    if (!Number.isFinite(angle) || angle <= 0 || angle >= 180)
      throw new RangeError(
        'Imaging field of view must be greater than 0 and less than 180 degrees.',
      );
  }
  if (
    !Number.isFinite(input.orientationDegrees) ||
    !Number.isFinite(input.observerLatitudeDegrees) ||
    Math.abs(input.observerLatitudeDegrees) > 90 ||
    !['altaz', 'equatorial', 'derotatedAltaz'].includes(input.trackingMode)
  )
    throw new RangeError('Invalid imaging orientation or tracking mode.');
  const azimuth = input.horizontal.azimuthDegreesClockwiseFromNorth * radians;
  const altitude = input.horizontal.refractedAltitudeDegrees * radians;
  const center = horizontalDirectionToVector({
    azimuthDegrees: input.horizontal.azimuthDegreesClockwiseFromNorth,
    altitudeDegrees: input.horizontal.refractedAltitudeDegrees,
  });
  const baseUp =
    input.trackingMode === 'altaz'
      ? {
          x: -Math.sin(altitude) * Math.sin(azimuth),
          y: Math.cos(altitude),
          z: -Math.sin(altitude) * Math.cos(azimuth),
        }
      : celestialUp(input.horizontal, input.observerLatitudeDegrees, center);
  const baseRight = normalize(cross(baseUp, center));
  const cosine = Math.cos(input.orientationDegrees * radians);
  const sine = Math.sin(input.orientationDegrees * radians);
  const right = {
    x: baseRight.x * cosine - baseUp.x * sine,
    y: baseRight.y * cosine - baseUp.y * sine,
    z: baseRight.z * cosine - baseUp.z * sine,
  };
  const up = {
    x: baseUp.x * cosine + baseRight.x * sine,
    y: baseUp.y * cosine + baseRight.y * sine,
    z: baseUp.z * cosine + baseRight.z * sine,
  };
  const halfWidth = Math.tan((input.horizontalFovDegrees * radians) / 2);
  const halfHeight = Math.tan((input.verticalFovDegrees * radians) / 2);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([horizontal, vertical]) =>
    normalize({
      x:
        center.x +
        horizontal! * halfWidth * right.x +
        vertical! * halfHeight * up.x,
      y:
        center.y +
        horizontal! * halfWidth * right.y +
        vertical! * halfHeight * up.y,
      z:
        center.z +
        horizontal! * halfWidth * right.z +
        vertical! * halfHeight * up.z,
    }),
  );
  const planes = [
    { axis: right, span: halfWidth, sign: 1 },
    { axis: right, span: halfWidth, sign: -1 },
    { axis: up, span: halfHeight, sign: 1 },
    { axis: up, span: halfHeight, sign: -1 },
  ].map(({ axis, span, sign }) =>
    normalize({
      x: span * center.x + sign * axis.x,
      y: span * center.y + sign * axis.y,
      z: span * center.z + sign * axis.z,
    }),
  );
  return { center, right, up, corners, planes };
}
