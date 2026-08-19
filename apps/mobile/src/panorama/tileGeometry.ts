import type { AngularPointDegrees } from '../mask/visibilityMask';

export type PanoramaTilePlacement = {
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  horizontalFieldOfViewDegrees: number;
  verticalFieldOfViewDegrees: number;
};

export const createTileCoveragePolygon = (
  placement: PanoramaTilePlacement,
): AngularPointDegrees[] => {
  const values = Object.values(placement);
  if (!values.every(Number.isFinite)) {
    throw new RangeError('Tile placement values must be finite');
  }
  if (
    placement.horizontalFieldOfViewDegrees <= 0 ||
    placement.horizontalFieldOfViewDegrees > 180 ||
    placement.verticalFieldOfViewDegrees <= 0 ||
    placement.verticalFieldOfViewDegrees > 180
  ) {
    throw new RangeError('Tile fields of view must be within 0..180 degrees');
  }
  if (
    placement.centerAltitudeDegrees < 0 ||
    placement.centerAltitudeDegrees > 90
  ) {
    throw new RangeError('centerAltitudeDegrees must be 0..90');
  }

  const halfHorizontal = placement.horizontalFieldOfViewDegrees / 2;
  const halfVertical = placement.verticalFieldOfViewDegrees / 2;
  const minimumAltitude = Math.max(
    0,
    placement.centerAltitudeDegrees - halfVertical,
  );
  const maximumAltitude = Math.min(
    90,
    placement.centerAltitudeDegrees + halfVertical,
  );
  const minimumAzimuth = placement.centerAzimuthDegrees - halfHorizontal;
  const maximumAzimuth = placement.centerAzimuthDegrees + halfHorizontal;

  return [
    { azimuthDegrees: minimumAzimuth, altitudeDegrees: minimumAltitude },
    { azimuthDegrees: maximumAzimuth, altitudeDegrees: minimumAltitude },
    { azimuthDegrees: maximumAzimuth, altitudeDegrees: maximumAltitude },
    { azimuthDegrees: minimumAzimuth, altitudeDegrees: maximumAltitude },
  ];
};
