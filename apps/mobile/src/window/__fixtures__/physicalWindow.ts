import type { Vector3 } from '../../sky/planetariumProjection';
import type { WindowDefinition } from '../windowGeometry';

/** Synthetic measured wall, independent of the production half-space builder.
 * Local x is along the wall, y is vertical, and z points outdoors. */
export function physicalWindow(
  widthMeters: number,
  spanDegrees: number,
  axisAcrossFraction = 0.5,
  yawDegrees = 0,
) {
  const left = -widthMeters * axisAcrossFraction;
  const right = widthMeters * (1 - axisAcrossFraction);
  let lower = 0;
  let upper = widthMeters * 1000;
  for (let iteration = 0; iteration < 80; iteration++) {
    const depth = (lower + upper) / 2;
    const angle = Math.atan2(-left, depth) + Math.atan2(right, depth);
    if (angle > (spanDegrees * Math.PI) / 180) lower = depth;
    else upper = depth;
  }
  const depth = (lower + upper) / 2;
  const yaw = (yawDegrees * Math.PI) / 180;
  const toWorld = (point: Vector3): Vector3 => ({
    x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw),
    y: point.y,
    z: -point.x * Math.sin(yaw) + point.z * Math.cos(yaw),
  });
  const toLocal = (point: Vector3): Vector3 => ({
    x: point.x * Math.cos(yaw) - point.z * Math.sin(yaw),
    y: point.y,
    z: point.x * Math.sin(yaw) + point.z * Math.cos(yaw),
  });
  const bottom = -0.25;
  const top = 1.1;
  const corners = [
    { x: left, y: top, z: depth },
    { x: right, y: top, z: depth },
    { x: right, y: bottom, z: depth },
    { x: left, y: bottom, z: depth },
  ].map(toWorld);
  const leftRange = Math.hypot(left, depth);
  const rightRange = Math.hypot(right, depth);
  const azimuth = (point: Vector3) =>
    ((Math.atan2(point.x, point.z) * 180) / Math.PI + 360) % 360;
  const definition: WindowDefinition = {
    version: 1,
    leftAzimuthDegrees: azimuth(corners[0]!),
    rightAzimuthDegrees: azimuth(corners[1]!),
    topSlope: top / leftRange,
    bottomSlope: bottom / leftRange,
    rightDistanceRatio: rightRange / leftRange,
    widthMeters,
  };
  return {
    definition,
    corners,
    depth,
    toWorld,
    toLocal,
    /** Call only from behind the wall. Backward/parallel rays cannot leave
     * through this opening. No production window routine is used here. */
    rayClearsOpening(rayWorld: Vector3, lensWorld: Vector3): boolean {
      const ray = toLocal(rayWorld);
      const lens = toLocal(lensWorld);
      if (depth - lens.z <= 0)
        throw new Error('Oracle requires a lens behind the wall');
      if (ray.z <= 0) return false;
      const travel = (depth - lens.z) / ray.z;
      const x = lens.x + travel * ray.x;
      const y = lens.y + travel * ray.y;
      return x > left && x < right && y > bottom && y < top;
    },
  };
}

/** Independent rigid mount rotation (Rodrigues), for lens-motion checks. */
export function rotateAboutAxis(
  vector: Vector3,
  axis: Vector3,
  angle: number,
): Vector3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const along = vector.x * axis.x + vector.y * axis.y + vector.z * axis.z;
  return {
    x:
      vector.x * cosine +
      (axis.y * vector.z - axis.z * vector.y) * sine +
      axis.x * along * (1 - cosine),
    y:
      vector.y * cosine +
      (axis.z * vector.x - axis.x * vector.z) * sine +
      axis.y * along * (1 - cosine),
    z:
      vector.z * cosine +
      (axis.x * vector.y - axis.y * vector.x) * sine +
      axis.z * along * (1 - cosine),
  };
}
