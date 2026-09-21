const { abs, acos, asin, atan, cos, hypot, max, min, PI, sin, sqrt, tan } =
  Math;
import { createFrameRefinementPredicate } from '../astronomy/frameVisibilityRefinement';
import type { HorizontalCoordinates } from '../astronomy/horizontalCoordinates';
import type { ImagingFrameSettings } from '../astronomy/imagingFrame';
import { createFrameMaskEvaluator } from '../mask/frameMaskIntersection';
import {
  horizontalDirectionToVector,
  type Vector3,
} from '../sky/planetariumProjection';
import { lensPositionMeters, windowDot } from './windowGeometry';
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
  const radians = PI / 180;
  const radius = atan(
    hypot(
      tan((effectiveSettings.horizontalFovDegrees * radians) / 2),
      tan((effectiveSettings.verticalFovDegrees * radians) / 2),
    ),
  );
  const offsetMeters = abs(settings?.lensOffsetMillimeters ?? 0) / 1000;
  const pupilRadius = (settings?.apertureMillimeters ?? 0) / 2000;
  const axis =
    settings?.trackingMode === 'equatorial'
      ? {
          x: 0,
          y: sin(latitude * radians),
          z: cos(latitude * radians),
        }
      : { x: 0, y: 1, z: 0 };
  // Subdivision repeatedly shares endpoints. Reuse their directional transform
  // only for this calculation; weak keys do not retain discarded samples.
  const directions = new WeakMap<Sample, Vector3>();
  const lenses = new WeakMap<Sample, Vector3>();
  const directionFor = (sample: Sample) => {
    const cached = directions.get(sample);
    if (cached) return cached;
    const vector = horizontalDirectionToVector({
      azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
      altitudeDegrees: sample.refractedAltitudeDegrees,
    });
    directions.set(sample, vector);
    return vector;
  };
  return (left: Sample, right: Sample) => {
    const first = directionFor(left);
    const last = directionFor(right);
    const separation = acos(max(-1, min(1, windowDot(first, last))));
    const duration = right.timestampMilliseconds - left.timestampMilliseconds;
    const travel = max(separation, (duration / 60000) * 0.251 * radians);
    if (left.refractedAltitudeDegrees * radians + travel < 0) return false;
    const forward = windowDot(correction.geometry.normal, first);
    let margins: number[] = [];
    if (!offsetMeters)
      margins = correction.geometry.planes.map((plane) =>
        windowDot(plane, first),
      );
    let displacement = 0;
    let pupilDisplacement = 0;
    let distance = correction.geometry.distanceMeters;
    let lensTravel = 0;
    if (offsetMeters || pupilRadius) {
      let lens = lenses.get(left);
      if (!lens) {
        lens = settings
          ? lensPositionMeters(
              {
                azimuthDegrees: left.azimuthDegreesClockwiseFromNorth,
                altitudeDegrees: left.refractedAltitudeDegrees,
              },
              settings.lensOffsetMillimeters ?? 0,
              settings.trackingMode,
              latitude,
            )
          : { x: 0, y: 0, z: 0 };
        lenses.set(left, lens);
      }
      // For vectors u,v: |unit(u)-unit(v)| <= |u-v| / min(|u|,|v|).
      // axis × direction moves by at most chord, and its length cannot fall
      // below tangentLength - chord. At a pole use the full offset diameter.
      const axisDot = windowDot(axis, first);
      const tangentLength = sqrt(max(0, 1 - axisDot * axisDot));
      const chord = 2 * sin(min(PI, travel) / 2);
      lensTravel =
        tangentLength > chord
          ? min(
              2 * offsetMeters,
              (offsetMeters * chord) / (tangentLength - chord),
            )
          : 2 * offsetMeters;
      distance =
        correction.geometry.distanceMeters -
        windowDot(correction.geometry.normal, lens);
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
      const nearestEdge = hypot(
        distance,
        min(
          abs(across),
          abs(correction.geometry.definition.widthMeters - across),
          abs(height),
          abs(correction.geometry.heightMeters - height),
        ),
      );
      if (offsetMeters) {
        // Normalize the four scalar edge margins directly; avoid rebuilding
        // plane vectors on every refinement query (a measured hot path).
        const lateral = windowDot(correction.geometry.right, first);
        const edgeDistances = [
          across,
          correction.geometry.definition.widthMeters - across,
          height,
          correction.geometry.heightMeters - height,
        ];
        const components = [lateral, -lateral, first.y, -first.y];
        const planeDistance = abs(distance) <= 1e-7 ? 0 : distance;
        margins = edgeDistances.map((edge, index) => {
          const length = hypot(planeDistance, edge);
          return length > 1e-7
            ? (planeDistance * components[index]! + edge * forward) / length
            : 0;
        });
      }
      if (nearestEdge > lensTravel + 1e-7) {
        displacement = asin(lensTravel / nearestEdge);
      } else displacement = PI;
      pupilDisplacement =
        nearestEdge > lensTravel + pupilRadius + 1e-7
          ? asin((lensTravel + pupilRadius) / nearestEdge)
          : PI;
    }
    const uncertainty = radius + travel + pupilDisplacement;
    const motionUncertainty = travel + displacement;
    // A circular pupil's plane moves by at most R*chord as the optical axis
    // turns. Bound its actual normal extent, not a sphere of radius R: this
    // also proves blocked inward rays when only the pupil rim is room-side.
    const pupilNormalExtent = pupilRadius * sqrt(max(0, 1 - forward * forward));
    const pupilMotion = pupilRadius * 2 * sin(min(PI, travel) / 2);
    const pupilInFront =
      distance + pupilNormalExtent + lensTravel + pupilMotion < -1e-7;
    if (
      travel < PI / 2 &&
      forward < -sin(travel) &&
      distance + pupilNormalExtent - lensTravel - pupilMotion > 1e-7
    )
      return false;
    if (motionUncertainty < PI / 2) {
      const motionLimit = sin(motionUncertainty);
      // A blocked centre is enough to reject the whole pupil. Behind the plane
      // the opening is convex, including directions pointing back into the room.
      if (
        distance > lensTravel + 1e-7 &&
        margins.some((margin) => margin < -motionLimit)
      )
        return false;
      if (
        distance < -lensTravel - 1e-7 &&
        forward < -sin(travel) &&
        margins.some((margin) => margin > motionLimit)
      )
        return false;
    }
    if (uncertainty < PI / 2) {
      const limit = sin(uncertainty);
      const forwardLimit = sin(radius + travel);
      const outward = forward > forwardLimit;
      const inward = forward < -forwardLimit;
      // Inward room-side rays cannot exit through this opening. Front-side
      // outward rays miss the wall. Otherwise every crossing must fit its hole.
      if (distance > lensTravel + 1e-7 && inward) return false;
      if (
        (pupilInFront && outward) ||
        margins.every((margin) => margin > limit) ||
        (pupilInFront && inward && margins.every((margin) => margin < -limit))
      )
        return background(left, right);
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
