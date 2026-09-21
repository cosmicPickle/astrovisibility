import type { ImagingFrame } from '../astronomy/imagingFrame';
import type { Vector3 } from '../sky/planetariumProjection';
import {
  WINDOW_CONTACT_TOLERANCE_METERS,
  windowDot,
  windowPlanesAtLens,
  type WindowGeometry,
} from './windowGeometry';

/** Beyond the opening, clear sky surrounds a convex blocked rear cone. Clip
 * the entire tangent-plane frame against that cone: testing corners alone
 * misses a blocked island or a boundary crossing through the frame's edges.
 * Four clipping planes produce at most eight vertices. Contact is blocked. */
export function windowContainsFrame(
  geometry: WindowGeometry,
  frame: ImagingFrame,
  lens: Vector3,
): boolean {
  const planes = windowPlanesAtLens(geometry, lens);
  const distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  if (distance >= -WINDOW_CONTACT_TOLERANCE_METERS)
    return frame.corners.every((corner) =>
      planes.every((plane) => windowDot(plane, corner) > 1e-10),
    );

  let polygon = [...frame.corners];
  for (const plane of planes) {
    const clipped: Vector3[] = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      const startMargin = windowDot(plane, start) - 1e-10;
      const endMargin = windowDot(plane, end) - 1e-10;
      if (startMargin <= 0) clipped.push(start);
      if (startMargin <= 0 !== endMargin <= 0) {
        const ratio = startMargin / (startMargin - endMargin);
        clipped.push({
          x: start.x + ratio * (end.x - start.x),
          y: start.y + ratio * (end.y - start.y),
          z: start.z + ratio * (end.z - start.z),
        });
      }
    }
    if (clipped.length === 0) return true;
    polygon = clipped;
  }
  return false;
}
