import type { ReviewedTilePlacement } from '../../capture/captureSession';
import { normalizeAzimuthDegrees } from '../../sky/projection';

export type CaptureCoverageMapSize = {
  heightPixels: number;
  widthPixels: number;
};

export type CaptureCoverageFootprint = {
  centerX: number;
  centerY: number;
  height: number;
  rotationDegrees: number;
  width: number;
  x: number;
  y: number;
};

const xForAzimuth = (azimuthDegrees: number, map: CaptureCoverageMapSize) =>
  (normalizeAzimuthDegrees(azimuthDegrees) / 360) * map.widthPixels;

const yForAltitude = (altitudeDegrees: number, map: CaptureCoverageMapSize) =>
  ((90 - altitudeDegrees) / 90) * map.heightPixels;

export function createCaptureCoverageFootprints(
  placement: ReviewedTilePlacement,
  map: CaptureCoverageMapSize,
): CaptureCoverageFootprint[] {
  const width =
    (placement.horizontalFieldOfViewDegrees * map.widthPixels) / 360;
  const height = (placement.verticalFieldOfViewDegrees * map.heightPixels) / 90;
  const centerY = yForAltitude(placement.centerAltitudeDegrees, map);
  const y = centerY - height / 2;
  const baseCenterX = xForAzimuth(placement.centerAzimuthDegrees, map);
  const centerXs = [baseCenterX];

  if (baseCenterX - width / 2 < 0) {
    centerXs.push(baseCenterX + map.widthPixels);
  } else if (baseCenterX + width / 2 > map.widthPixels) {
    centerXs.push(baseCenterX - map.widthPixels);
  }

  return centerXs.map((centerX) => ({
    centerX,
    centerY,
    height,
    // Android/Expo roll uses a Y-up convention; SVG's Y axis points down.
    rotationDegrees: placement.rollDegrees === 0 ? 0 : -placement.rollDegrees,
    width,
    x: centerX - width / 2,
    y,
  }));
}

export const getCaptureCardinals = (map: CaptureCoverageMapSize) => [
  { label: 'N', x: 4, y: map.heightPixels - 6 },
  { label: 'E', x: map.widthPixels / 4, y: map.heightPixels - 6 },
  { label: 'S', x: map.widthPixels / 2, y: map.heightPixels - 6 },
  { label: 'W', x: (map.widthPixels * 3) / 4, y: map.heightPixels - 6 },
];

export const captureCoverageXForAzimuth = xForAzimuth;
export const captureCoverageYForAltitude = yForAltitude;
