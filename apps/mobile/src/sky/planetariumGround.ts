import type { PlanetariumCamera } from './planetariumProjection';
import type { CanvasSizePixels } from './projection';

export const CARDINAL_LABEL_FONT_SIZE_PIXELS = 20;
export const CELESTIAL_EQUATOR_STROKE_OPACITY = 0.16;

const DEGREES_TO_RADIANS = Math.PI / 180;
const LINEAR_HORIZON_ALTITUDE_SINE_LIMIT = 0.001;

interface GroundClipPoint {
  xPixels: number;
  yPixels: number;
}

export type ProjectedGroundClip =
  | {
      groundOutside: boolean;
      kind: 'circle';
      centerXPixels: number;
      centerYPixels: number;
      radiusPixels: number;
    }
  | {
      groundOutside: false;
      kind: 'polygon';
      points: GroundClipPoint[];
    };

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

const getProjectionScalePixels = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  return (
    Math.min(canvas.widthPixels, canvas.heightPixels) /
    2 /
    Math.tan((camera.fieldOfViewDegrees * DEGREES_TO_RADIANS) / 4)
  );
};

const clipViewportToLinearGround = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): GroundClipPoint[] => {
  'worklet';
  const centerXPixels = canvas.widthPixels / 2;
  const centerYPixels = canvas.heightPixels / 2;
  const groundValue = ({ xPixels, yPixels }: GroundClipPoint) =>
    2 * camera.right.y * (xPixels - centerXPixels) +
    2 * camera.up.y * (centerYPixels - yPixels);
  const viewport = [
    { xPixels: canvas.widthPixels, yPixels: 0 },
    { xPixels: canvas.widthPixels, yPixels: canvas.heightPixels },
    { xPixels: 0, yPixels: canvas.heightPixels },
    { xPixels: 0, yPixels: 0 },
  ];
  const clipped: GroundClipPoint[] = [];
  let previous = viewport[viewport.length - 1]!;
  let previousValue = groundValue(previous);
  let previousInside = previousValue <= 0;
  for (const current of viewport) {
    const currentValue = groundValue(current);
    const currentInside = currentValue <= 0;
    if (currentInside !== previousInside) {
      const interpolation = previousValue / (previousValue - currentValue);
      clipped.push({
        xPixels:
          previous.xPixels +
          interpolation * (current.xPixels - previous.xPixels),
        yPixels:
          previous.yPixels +
          interpolation * (current.yPixels - previous.yPixels),
      });
    }
    if (currentInside) clipped.push(current);
    previous = current;
    previousValue = currentValue;
    previousInside = currentInside;
  }
  return clipped;
};

/**
 * Analytic stereographic image of the local ground hemisphere. A horizon is a
 * circle unless the camera lies on it, where it is exactly a line. This avoids
 * closure chords and wrong-side fills from a sampled off-screen horizon path.
 */
export const createProjectedGroundClip = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ProjectedGroundClip => {
  'worklet';
  const cameraAltitudeSine = camera.forward.y;
  if (Math.abs(cameraAltitudeSine) < LINEAR_HORIZON_ALTITUDE_SINE_LIMIT) {
    return {
      groundOutside: false,
      kind: 'polygon',
      points: clipViewportToLinearGround(camera, canvas),
    };
  }

  const projectionScalePixels = getProjectionScalePixels(camera, canvas);
  return {
    centerXPixels:
      canvas.widthPixels / 2 +
      (projectionScalePixels * camera.right.y) / cameraAltitudeSine,
    centerYPixels:
      canvas.heightPixels / 2 -
      (projectionScalePixels * camera.up.y) / cameraAltitudeSine,
    groundOutside: cameraAltitudeSine > 0,
    kind: 'circle',
    radiusPixels: projectionScalePixels / Math.abs(cameraAltitudeSine),
  };
};
