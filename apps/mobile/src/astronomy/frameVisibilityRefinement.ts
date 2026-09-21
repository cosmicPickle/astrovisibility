import { createFrameMaskEvaluator } from '../mask/frameMaskIntersection';
import type { RasterMask } from '../mask/rasterMask';
import type { HorizontalCoordinates } from './horizontalCoordinates';
import { createImagingFrame, type ImagingFrameSettings } from './imagingFrame';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';

type FrameSample = HorizontalCoordinates & {
  assessment: string;
  timestampMilliseconds: number;
};

/** Bound every orientation of the rectangle by its angular circumradius. A
 * sidereal track advances at <= 0.251 degrees/minute; the endpoint separation
 * also supports faster deterministic fixture tracks. This test only eliminates
 * intervals proved clear or proved blocked, never substitutes a larger frame
 * for the authoritative per-instant footprint.
 */
export function createFrameRefinementPredicate(
  raster: RasterMask,
  settings: ImagingFrameSettings,
  observerLatitudeDegrees: number,
) {
  const evaluator = createFrameMaskEvaluator(raster);
  const radians = Math.PI / 180;
  const frameRadiusDegrees =
    Math.atan(
      Math.hypot(
        Math.tan((settings.horizontalFovDegrees * radians) / 2),
        Math.tan((settings.verticalFovDegrees * radians) / 2),
      ),
    ) / radians;
  return (left: FrameSample, right: FrameSample) => {
    const azimuthDelta =
      (right.azimuthDegreesClockwiseFromNorth -
        left.azimuthDegreesClockwiseFromNorth) *
      radians;
    const leftAltitude = left.refractedAltitudeDegrees * radians;
    const rightAltitude = right.refractedAltitudeDegrees * radians;
    const cosine =
      Math.sin(leftAltitude) * Math.sin(rightAltitude) +
      Math.cos(leftAltitude) * Math.cos(rightAltitude) * Math.cos(azimuthDelta);
    const separation = Math.acos(Math.max(-1, Math.min(1, cosine))) / radians;
    const travelDegrees = Math.max(
      separation,
      ((right.timestampMilliseconds - left.timestampMilliseconds) / 60_000) *
        0.251,
    );
    if (left.refractedAltitudeDegrees + travelDegrees < 0) return false;
    const center = horizontalDirectionToVector({
      azimuthDegrees: left.azimuthDegreesClockwiseFromNorth,
      altitudeDegrees: left.refractedAltitudeDegrees,
    });
    if (left.assessment === 'blocked' && right.assessment === 'blocked') {
      if (!evaluator.capIntersects(center, travelDegrees, false)) return false;
    }
    const radius = frameRadiusDegrees + travelDegrees;
    if (
      left.refractedAltitudeDegrees > radius &&
      !evaluator.capIntersects(center, radius, true)
    )
      return false;
    if (
      right.timestampMilliseconds - left.timestampMilliseconds > 30_000 ||
      separation > 0.05
    )
      return true;
    const leftFrame = createImagingFrame({
      ...settings,
      horizontal: left,
      observerLatitudeDegrees,
    });
    const rightFrame = createImagingFrame({
      ...settings,
      horizontal: right,
      observerLatitudeDegrees,
    });
    const minimumDot = Math.cos(0.05 * radians);
    return leftFrame.corners.some((corner, index) => {
      const other = rightFrame.corners[index]!;
      return (
        corner.x * other.x + corner.y * other.y + corner.z * other.z <
        minimumDot
      );
    });
  };
}
