import {
  projectVectorToCanvas,
  type PlanetariumCamera,
  type ProjectedSkyPoint,
  type Vector3,
} from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';
import { WINDOW_CONTACT_TOLERANCE_METERS } from './windowGeometry';

/** Window edge points are physical positions relative to the lens, not unit
 * sky directions. A coincident point has no direction and must break the path. */
export function projectWindowPoint(
  relativeMeters: Vector3,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ProjectedSkyPoint | null {
  'worklet';
  if (
    Math.hypot(relativeMeters.x, relativeMeters.y, relativeMeters.z) <=
    WINDOW_CONTACT_TOLERANCE_METERS
  )
    return null;
  return projectVectorToCanvas(relativeMeters, camera, canvas);
}
