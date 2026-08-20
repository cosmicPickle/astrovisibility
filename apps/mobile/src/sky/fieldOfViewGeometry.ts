import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { CanvasSizePixels } from './projection';

const DEGREES_TO_RADIANS = Math.PI / 180;

export interface FieldOfViewScreenPoint {
  xPixels: number;
  yPixels: number;
}

export interface ScreenCenteredFieldOfViewFrame {
  center: FieldOfViewScreenPoint;
  corners: readonly [
    FieldOfViewScreenPoint,
    FieldOfViewScreenPoint,
    FieldOfViewScreenPoint,
    FieldOfViewScreenPoint,
  ];
  heightPixels: number;
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
  widthPixels: number;
}

const rotateAroundOrigin = (
  point: FieldOfViewScreenPoint,
  rotationRadians: number,
): FieldOfViewScreenPoint => {
  'worklet';
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  return {
    xPixels: point.xPixels * cosine - point.yPixels * sine,
    yPixels: point.xPixels * sine + point.yPixels * cosine,
  };
};

/**
 * Builds the imaging setup as a screen-space planning reticle. The atlas uses
 * a stereographic projection, so an angular half-span maps to
 * `scale * tan(halfSpan / 2)`. Keeping the result in screen space guarantees a
 * literal rectangle at the viewport centre while preserving angular scale as
 * the camera zoom changes.
 */
export const createScreenCenteredFieldOfViewFrame = ({
  cameraFieldOfViewDegrees,
  canvas,
  equipment,
}: {
  cameraFieldOfViewDegrees: number;
  canvas: CanvasSizePixels;
  equipment: EquipmentRecord;
}): ScreenCenteredFieldOfViewFrame => {
  'worklet';
  if (
    !Number.isFinite(cameraFieldOfViewDegrees) ||
    cameraFieldOfViewDegrees <= 0 ||
    cameraFieldOfViewDegrees >= 360
  ) {
    throw new RangeError('cameraFieldOfViewDegrees must be between 0 and 360');
  }
  if (canvas.widthPixels <= 0 || canvas.heightPixels <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }

  const angularField = calculateAngularFieldOfView(equipment);
  const minimumCanvasDimension = Math.min(
    canvas.widthPixels,
    canvas.heightPixels,
  );
  const projectionScale =
    minimumCanvasDimension /
    2 /
    Math.tan((cameraFieldOfViewDegrees * DEGREES_TO_RADIANS) / 4);
  const widthPixels =
    2 *
    projectionScale *
    Math.tan((angularField.horizontalFovDegrees * DEGREES_TO_RADIANS) / 4);
  const heightPixels =
    2 *
    projectionScale *
    Math.tan((angularField.verticalFovDegrees * DEGREES_TO_RADIANS) / 4);
  const center = {
    xPixels: canvas.widthPixels / 2,
    yPixels: canvas.heightPixels / 2,
  };
  const rotationRadians = equipment.frameRotationDegrees * DEGREES_TO_RADIANS;
  const offsets = [
    { xPixels: -widthPixels / 2, yPixels: -heightPixels / 2 },
    { xPixels: widthPixels / 2, yPixels: -heightPixels / 2 },
    { xPixels: widthPixels / 2, yPixels: heightPixels / 2 },
    { xPixels: -widthPixels / 2, yPixels: heightPixels / 2 },
  ] as const;
  const cornerAt = (offset: FieldOfViewScreenPoint) => {
    'worklet';
    const rotated = rotateAroundOrigin(offset, rotationRadians);
    return {
      xPixels: center.xPixels + rotated.xPixels,
      yPixels: center.yPixels + rotated.yPixels,
    };
  };
  const corners: ScreenCenteredFieldOfViewFrame['corners'] = [
    cornerAt(offsets[0]),
    cornerAt(offsets[1]),
    cornerAt(offsets[2]),
    cornerAt(offsets[3]),
  ];

  return {
    ...angularField,
    center,
    corners,
    heightPixels,
    widthPixels,
  };
};
