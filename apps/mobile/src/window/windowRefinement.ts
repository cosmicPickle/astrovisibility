import { createFrameRefinementPredicate } from '../astronomy/frameVisibilityRefinement';
import type { HorizontalCoordinates } from '../astronomy/horizontalCoordinates';
import type { ImagingFrameSettings } from '../astronomy/imagingFrame';
import { createFrameMaskEvaluator } from '../mask/frameMaskIntersection';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import {
  lensPositionMeters,
  windowDot,
  windowPlanesAtLens,
} from './windowGeometry';
import type { WindowCorrection } from './windowMask';

type Sample = HorizontalCoordinates & {
  timestampMilliseconds: number;
  assessment: string;
};

/** Bound the lens travel over this interval, and all frame
 * orientations by its circumradius. Only reject an interval when the entire
 * swept cone is proved on one side of a window edge. Near an edge reuse the
 * existing temporal and corner-motion tolerances. */
export function createWindowRefinementPredicate(
  correction: WindowCorrection,
  settings: ImagingFrameSettings | null | undefined,
  latitude: number,
) {
  const effectiveSettings = settings ?? {
    horizontalFovDegrees: 0.000001,
    verticalFovDegrees: 0.000001,
    orientationDegrees: 0,
    trackingMode: 'altaz' as const,
  };
  const background = createFrameRefinementPredicate(
    correction.backgroundRaster,
    effectiveSettings,
    latitude,
  );
  const evaluator = createFrameMaskEvaluator(correction.backgroundRaster);
  const radians = Math.PI / 180;
  const radius = Math.atan(
    Math.hypot(
      Math.tan((effectiveSettings.horizontalFovDegrees * radians) / 2),
      Math.tan((effectiveSettings.verticalFovDegrees * radians) / 2),
    ),
  );
  const offsetMeters = Math.abs(settings?.lensOffsetMillimeters ?? 0) / 1000;
  const axis =
    settings?.trackingMode === 'equatorial'
      ? {
          x: 0,
          y: Math.sin(latitude * radians),
          z: Math.cos(latitude * radians),
        }
      : { x: 0, y: 1, z: 0 };
  return (left: Sample, right: Sample) => {
    const first = horizontalDirectionToVector({
      azimuthDegrees: left.azimuthDegreesClockwiseFromNorth,
      altitudeDegrees: left.refractedAltitudeDegrees,
    });
    const last = horizontalDirectionToVector({
      azimuthDegrees: right.azimuthDegreesClockwiseFromNorth,
      altitudeDegrees: right.refractedAltitudeDegrees,
    });
    const separation = Math.acos(
      Math.max(-1, Math.min(1, windowDot(first, last))),
    );
    const duration = right.timestampMilliseconds - left.timestampMilliseconds;
    const travel = Math.max(separation, (duration / 60000) * 0.251 * radians);
    if (left.refractedAltitudeDegrees * radians + travel < 0) return false;
    let planes = correction.geometry.planes;
    let displacement = 0;
    let distance = correction.geometry.distanceMeters;
    let stableSide = true;
    if (offsetMeters && settings) {
      const lens = lensPositionMeters(
        {
          azimuthDegrees: left.azimuthDegreesClockwiseFromNorth,
          altitudeDegrees: left.refractedAltitudeDegrees,
        },
        settings.lensOffsetMillimeters!,
        settings.trackingMode,
        latitude,
      );
      // For vectors u,v: |unit(u)-unit(v)| <= |u-v| / min(|u|,|v|).
      // axis × direction moves by at most chord, and its length cannot fall
      // below tangentLength - chord. At a pole use the full offset diameter.
      const axisDot = windowDot(axis, first);
      const tangentLength = Math.sqrt(Math.max(0, 1 - axisDot * axisDot));
      const chord = 2 * Math.sin(Math.min(Math.PI, travel) / 2);
      const lensTravel =
        tangentLength > chord
          ? Math.min(
              2 * offsetMeters,
              (offsetMeters * chord) / (tangentLength - chord),
            )
          : 2 * offsetMeters;
      distance =
        correction.geometry.distanceMeters -
        windowDot(correction.geometry.normal, lens);
      stableSide = Math.abs(distance) > lensTravel + 1e-7;
      const across = windowDot(
        {
          x: lens.x - correction.geometry.bottomLeft.x,
          y: 0,
          z: lens.z - correction.geometry.bottomLeft.z,
        },
        correction.geometry.right,
      );
      const height = lens.y - correction.geometry.bottomLeft.y;
      // Each boundary rotates about its physical frame edge. Distance to that
      // edge stays useful at the sill, where distance to the plane is zero.
      const nearestEdge = Math.hypot(
        distance,
        Math.min(
          Math.abs(across),
          Math.abs(correction.geometry.definition.widthMeters - across),
          Math.abs(height),
          Math.abs(correction.geometry.heightMeters - height),
        ),
      );
      if (nearestEdge > lensTravel + 1e-7) {
        planes = windowPlanesAtLens(correction.geometry, lens);
        displacement = Math.asin(lensTravel / nearestEdge);
      } else displacement = Math.PI;
    }
    const uncertainty = radius + travel + displacement;
    if (uncertainty < Math.PI / 2) {
      const limit = Math.sin(uncertainty);
      const margins = planes.map((plane) => windowDot(plane, first));
      const outside = distance < -1e-7;
      // All four positive/negative margins prove the same classification on
      // either side, so a plane crossing alone need not force fine sampling.
      const blocked =
        margins.every((margin) => margin < -limit) ||
        (stableSide && !outside && margins.some((margin) => margin < -limit));
      const clear =
        margins.every((margin) => margin > limit) ||
        (stableSide && outside && margins.some((margin) => margin > limit));
      if (blocked) return false;
      if (clear) return background(left, right);
    }
    if (!evaluator.capIntersects(first, (radius + travel) / radians, false))
      return false;
    if (duration > 30000 || separation > 0.05 * radians) return true;
    // Refine the swept boundary angle, not movement divided by plane distance.
    // Plane distance vanishes at the sill even when the edges hardly move.
    if (displacement > 0.05 * radians) return true;
    // Background's corner-motion criterion catches orientation changes near poles.
    return Boolean(settings) && background(left, right);
  };
}
