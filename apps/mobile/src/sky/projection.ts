export type HorizontalDirectionDegrees = {
  azimuthDegrees: number;
  altitudeDegrees: number;
};

export type CanvasSizePixels = {
  widthPixels: number;
  heightPixels: number;
};

export const normalizeAzimuthDegrees = (azimuthDegrees: number) =>
  ((azimuthDegrees % 360) + 360) % 360;

export const unwrapAzimuthDegreesNear = (
  azimuthDegrees: number,
  referenceAzimuthDegrees: number,
) => {
  const normalizedAzimuth = normalizeAzimuthDegrees(azimuthDegrees);
  const revolutions = Math.round(
    (referenceAzimuthDegrees - normalizedAzimuth) / 360,
  );
  return normalizedAzimuth + revolutions * 360;
};

export const projectHorizontalToCanvas = (
  direction: HorizontalDirectionDegrees,
  canvas: CanvasSizePixels,
) => {
  if (canvas.widthPixels <= 0 || canvas.heightPixels <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }
  if (direction.altitudeDegrees < 0 || direction.altitudeDegrees > 90) {
    throw new RangeError('altitudeDegrees must be 0..90');
  }

  return {
    xPixels:
      (normalizeAzimuthDegrees(direction.azimuthDegrees) / 360) *
      canvas.widthPixels,
    yPixels: ((90 - direction.altitudeDegrees) / 90) * canvas.heightPixels,
  };
};
