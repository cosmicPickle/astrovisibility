const { max, min, sqrt } = Math;
import type { ImagingFrame } from '../astronomy/imagingFrame';
import type { Vector3 } from '../sky/planetariumProjection';
import {
  WINDOW_CONTACT_TOLERANCE_METERS,
  windowContainsRay,
  windowDot,
  type WindowGeometry,
} from './windowGeometry';
import { createWindowPupilEvaluator } from './windowPupil';

/** A frame facing one side of the wall is convex in ray coordinates. Test its
 * four corners against the complete pupil. A frame spanning an incoming and
 * tangent direction contains wall hits even when its corners clear. */
export function windowContainsFrame(
  geometry: WindowGeometry,
  frame: ImagingFrame,
  lens: Vector3,
  apertureMillimeters = 0,
): boolean {
  if (!Number.isFinite(apertureMillimeters) || apertureMillimeters < 0)
    throw new RangeError('Invalid aperture diameter.');
  const radius = apertureMillimeters / 2000;
  const distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  const axial = windowDot(geometry.normal, frame.center);
  const pupilDepth = radius * sqrt(max(0, 1 - axial * axial));
  let minimumForward = Infinity;
  let maximumForward = -Infinity;
  for (const corner of frame.corners) {
    const forward = windowDot(geometry.normal, corner);
    minimumForward = min(minimumForward, forward);
    maximumForward = max(maximumForward, forward);
  }
  if (distance + pupilDepth >= -WINDOW_CONTACT_TOLERANCE_METERS) {
    if (minimumForward <= 1e-12) return false;
  } else {
    if (minimumForward >= -1e-12) return true;
    if (maximumForward >= -1e-12) return false;
  }
  if (!radius)
    return frame.corners.every((ray) => windowContainsRay(geometry, ray, lens));
  const clears = createWindowPupilEvaluator(
    geometry,
    frame.center,
    lens,
    radius,
  );
  return frame.corners.every(clears);
}
