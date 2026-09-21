const { abs, max, min, sqrt } = Math;
import type { Vector3 } from '../sky/planetariumProjection';
import {
  WINDOW_CONTACT_TOLERANCE_METERS,
  windowDot,
  type WindowGeometry,
} from './windowGeometry';

/** Exact extrema of the pupil's projected footprint. Local coordinates are
 * across/up/outward metres. Ray constraints are multiplied by |forward| to
 * avoid dividing by tiny ray-plane angles. No aperture sampling is needed. */
export function createWindowPupilEvaluator(
  geometry: WindowGeometry,
  opticalAxis: Vector3,
  lens: Vector3,
  radiusMeters: number,
) {
  const q = {
    x: windowDot(geometry.right, opticalAxis),
    y: opticalAxis.y,
    z: windowDot(geometry.normal, opticalAxis),
  };
  const distance = geometry.distanceMeters - windowDot(geometry.normal, lens);
  const across =
    (lens.x - geometry.bottomLeft.x) * geometry.right.x +
    (lens.z - geometry.bottomLeft.z) * geometry.right.z;
  const height = lens.y - geometry.bottomLeft.y;
  const normalLength = sqrt(max(0, 1 - q.z * q.z));
  const wholePupilOnOneSide =
    abs(distance) >
    radiusMeters * normalLength + WINDOW_CONTACT_TOLERANCE_METERS;

  // Minimize k.u on |u|<=R, u.q=0, side*n.u<=side*distance.
  // The half-plane retains only pupil points whose forward rays meet the wall.
  const minimum = (kx: number, ky: number, kz: number, side: number) => {
    const axial = kx * q.x + ky * q.y + kz * q.z;
    const lengthSquared = max(0, kx * kx + ky * ky + kz * kz - axial * axial);
    const length = sqrt(lengthSquared);
    const bound = side * distance;
    const normalDot = side * (kz - axial * q.z);
    if (
      normalLength < 1e-12 ||
      bound >= radiusMeters * normalLength ||
      length < 1e-15 ||
      (-radiusMeters * normalDot) / length <= bound
    )
      return -radiusMeters * length;
    const along = max(-radiusMeters, min(radiusMeters, bound / normalLength));
    const crossLength = sqrt(
      max(0, lengthSquared - (normalDot / normalLength) ** 2),
    );
    return (
      (along * normalDot) / normalLength -
      sqrt(max(0, radiusMeters ** 2 - along ** 2)) * crossLength
    );
  };

  return (ray: Vector3): boolean => {
    const forward = windowDot(geometry.normal, ray);
    const lateral = windowDot(geometry.right, ray);
    const side = forward > 0 ? 1 : -1;
    if (
      side * distance <
      -radiusMeters * normalLength - WINDOW_CONTACT_TOLERANCE_METERS
    )
      return true;
    const contact = WINDOW_CONTACT_TOLERANCE_METERS * abs(forward);
    const horizontalBase = side * (across * forward + distance * lateral);
    const verticalBase = side * (height * forward + distance * ray.y);
    const signedForward = side * forward;
    if (wholePupilOnOneSide) {
      const horizontalAxial = forward * q.x - lateral * q.z;
      const verticalAxial = forward * q.y - ray.y * q.z;
      const horizontalExtent =
        radiusMeters *
        sqrt(
          max(
            0,
            forward * forward +
              lateral * lateral -
              horizontalAxial * horizontalAxial,
          ),
        );
      const verticalExtent =
        radiusMeters *
        sqrt(
          max(
            0,
            forward * forward + ray.y * ray.y - verticalAxial * verticalAxial,
          ),
        );
      return (
        horizontalBase > horizontalExtent + contact &&
        geometry.definition.widthMeters * signedForward - horizontalBase >
          horizontalExtent + contact &&
        verticalBase > verticalExtent + contact &&
        geometry.heightMeters * signedForward - verticalBase >
          verticalExtent + contact
      );
    }
    return (
      horizontalBase + minimum(signedForward, 0, -side * lateral, side) >
        contact &&
      geometry.definition.widthMeters * signedForward -
        horizontalBase +
        minimum(-signedForward, 0, side * lateral, side) >
        contact &&
      verticalBase + minimum(0, signedForward, -side * ray.y, side) > contact &&
      geometry.heightMeters * signedForward -
        verticalBase +
        minimum(0, -signedForward, side * ray.y, side) >
        contact
    );
  };
}
