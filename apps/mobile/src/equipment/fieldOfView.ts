export interface FieldOfViewInput {
  focalLengthMillimeters: number;
  sensorWidthMillimeters: number;
  sensorHeightMillimeters: number;
}

export interface AngularFieldOfView {
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
}

export interface FieldOfViewCorner {
  horizontalOffsetDegrees: number;
  verticalOffsetDegrees: number;
}

const assertPositiveFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
};

export const calculateAngularFieldOfView = (
  input: FieldOfViewInput,
): AngularFieldOfView => {
  assertPositiveFinite(input.focalLengthMillimeters, 'focalLengthMillimeters');
  assertPositiveFinite(input.sensorWidthMillimeters, 'sensorWidthMillimeters');
  assertPositiveFinite(
    input.sensorHeightMillimeters,
    'sensorHeightMillimeters',
  );
  const radiansToDegrees = 180 / Math.PI;
  return {
    horizontalFovDegrees:
      2 *
      Math.atan(
        input.sensorWidthMillimeters / (2 * input.focalLengthMillimeters),
      ) *
      radiansToDegrees,
    verticalFovDegrees:
      2 *
      Math.atan(
        input.sensorHeightMillimeters / (2 * input.focalLengthMillimeters),
      ) *
      radiansToDegrees,
  };
};

/**
 * Returns tangent-plane angular offsets around the selected target. Positive
 * horizontal offset follows increasing azimuth; positive vertical offset follows
 * increasing altitude. Positive rotation is counter-clockwise in that plane.
 */
export const createRotatedFieldOfViewRectangle = (
  input: FieldOfViewInput & { frameRotationDegrees: number },
): AngularFieldOfView & {
  rotationDegrees: number;
  corners: readonly FieldOfViewCorner[];
} => {
  if (!Number.isFinite(input.frameRotationDegrees)) {
    throw new RangeError('frameRotationDegrees must be finite');
  }
  const fieldOfView = calculateAngularFieldOfView(input);
  const rotationDegrees = ((input.frameRotationDegrees % 360) + 360) % 360;
  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  const halfWidth = fieldOfView.horizontalFovDegrees / 2;
  const halfHeight = fieldOfView.verticalFovDegrees / 2;
  const unrotatedCorners = [
    [-halfWidth, halfHeight],
    [halfWidth, halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, -halfHeight],
  ] as const;
  return {
    ...fieldOfView,
    rotationDegrees,
    corners: unrotatedCorners.map(([horizontal, vertical]) => ({
      horizontalOffsetDegrees: horizontal * cosine - vertical * sine,
      verticalOffsetDegrees: horizontal * sine + vertical * cosine,
    })),
  };
};
