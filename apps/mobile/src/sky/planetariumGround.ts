export const CARDINAL_LABEL_FONT_SIZE_PIXELS = 20;
export const CELESTIAL_EQUATOR_STROKE_OPACITY = 0.16;

export const CARDINAL_LABELS = [
  { direction: { altitudeDegrees: 2, azimuthDegrees: 0 }, label: 'N' },
  { direction: { altitudeDegrees: 2, azimuthDegrees: 90 }, label: 'E' },
  { direction: { altitudeDegrees: 2, azimuthDegrees: 180 }, label: 'S' },
  { direction: { altitudeDegrees: 2, azimuthDegrees: 270 }, label: 'W' },
] as const;

export const createHorizonDirections = (stepDegrees: number) => {
  if (
    !Number.isFinite(stepDegrees) ||
    stepDegrees <= 0 ||
    360 % stepDegrees !== 0
  ) {
    throw new RangeError('stepDegrees must evenly divide 360');
  }
  return Array.from({ length: 360 / stepDegrees + 1 }, (_, index) => ({
    altitudeDegrees: 0,
    azimuthDegrees: index * stepDegrees,
  }));
};

export const shouldInvertGroundClip = (cameraCenterAltitudeDegrees: number) => {
  'worklet';
  return cameraCenterAltitudeDegrees >= 0;
};
