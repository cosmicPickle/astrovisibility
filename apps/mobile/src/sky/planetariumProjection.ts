import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';

export const MINIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES = 8;
export const MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES = 235;

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanetariumCamera {
  fieldOfViewDegrees: number;
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}

export interface ProjectedSkyPoint {
  visible: boolean;
  xPixels: number;
  yPixels: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const VECTOR_EPSILON = 1e-10;

const clamp = (value: number, minimum: number, maximum: number) => {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
};

const dot = (left: Vector3, right: Vector3) => {
  'worklet';
  return left.x * right.x + left.y * right.y + left.z * right.z;
};

const cross = (left: Vector3, right: Vector3): Vector3 => {
  'worklet';
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
};

const magnitude = (vector: Vector3) => {
  'worklet';
  return Math.hypot(vector.x, vector.y, vector.z);
};

const normalize = (vector: Vector3): Vector3 => {
  'worklet';
  const length = magnitude(vector);
  if (length <= VECTOR_EPSILON) {
    throw new RangeError('Cannot normalize a zero-length vector');
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
};

const scaleVector = (vector: Vector3, scale: number): Vector3 => {
  'worklet';
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
};

const addVectors = (left: Vector3, right: Vector3): Vector3 => {
  'worklet';
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
};

export const horizontalDirectionToVector = (
  direction: HorizontalDirectionDegrees,
): Vector3 => {
  'worklet';
  const azimuthRadians = direction.azimuthDegrees * DEGREES_TO_RADIANS;
  const altitudeRadians = direction.altitudeDegrees * DEGREES_TO_RADIANS;
  const horizontalLength = Math.cos(altitudeRadians);
  return {
    x: horizontalLength * Math.sin(azimuthRadians),
    y: Math.sin(altitudeRadians),
    z: horizontalLength * Math.cos(azimuthRadians),
  };
};

export const vectorToHorizontalDirection = (
  rawVector: Vector3,
): HorizontalDirectionDegrees => {
  'worklet';
  const vector = normalize(rawVector);
  return {
    altitudeDegrees: Math.asin(clamp(vector.y, -1, 1)) * RADIANS_TO_DEGREES,
    azimuthDegrees:
      (((Math.atan2(vector.x, vector.z) * RADIANS_TO_DEGREES) % 360) + 360) %
      360,
  };
};

export const createPlanetariumCamera = ({
  centerAltitudeDegrees,
  centerAzimuthDegrees,
  fieldOfViewDegrees,
}: {
  centerAltitudeDegrees: number;
  centerAzimuthDegrees: number;
  fieldOfViewDegrees: number;
}): PlanetariumCamera => {
  'worklet';
  if (
    !Number.isFinite(fieldOfViewDegrees) ||
    fieldOfViewDegrees < MINIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES ||
    fieldOfViewDegrees > MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES
  ) {
    throw new RangeError(
      `fieldOfViewDegrees must be ${MINIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES}..${MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES}`,
    );
  }
  if (
    !Number.isFinite(centerAltitudeDegrees) ||
    centerAltitudeDegrees < -90 ||
    centerAltitudeDegrees > 90
  ) {
    throw new RangeError('centerAltitudeDegrees must be -90..90');
  }
  const azimuthRadians = centerAzimuthDegrees * DEGREES_TO_RADIANS;
  const altitudeRadians = centerAltitudeDegrees * DEGREES_TO_RADIANS;
  const right = {
    x: Math.cos(azimuthRadians),
    y: 0,
    z: -Math.sin(azimuthRadians),
  };
  const up = {
    x: -Math.sin(altitudeRadians) * Math.sin(azimuthRadians),
    y: Math.cos(altitudeRadians),
    z: -Math.sin(altitudeRadians) * Math.cos(azimuthRadians),
  };
  return {
    fieldOfViewDegrees,
    forward: horizontalDirectionToVector({
      altitudeDegrees: centerAltitudeDegrees,
      azimuthDegrees: centerAzimuthDegrees,
    }),
    right,
    up,
  };
};

export const getPlanetariumCameraCenter = (
  camera: PlanetariumCamera,
): HorizontalDirectionDegrees => {
  'worklet';
  return vectorToHorizontalDirection(camera.forward);
};

const getStereographicProjectionScale = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  if (canvas.widthPixels <= 0 || canvas.heightPixels <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }
  const diameterPixels = Math.min(canvas.widthPixels, canvas.heightPixels);
  const quarterFieldRadians =
    (camera.fieldOfViewDegrees * DEGREES_TO_RADIANS) / 4;
  return diameterPixels / 2 / Math.tan(quarterFieldRadians);
};

export const projectVectorToCanvas = (
  directionVector: Vector3,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ProjectedSkyPoint => {
  'worklet';
  const direction = normalize(directionVector);
  const localX = dot(direction, camera.right);
  const localY = dot(direction, camera.up);
  const localZ = clamp(dot(direction, camera.forward), -1, 1);
  const angularDistanceRadians = Math.acos(localZ);
  const tangentLength = Math.hypot(localX, localY);
  const radialPixels =
    Math.tan(Math.min(Math.PI - 1e-7, angularDistanceRadians) / 2) *
    getStereographicProjectionScale(camera, canvas);
  const unitX =
    tangentLength <= VECTOR_EPSILON
      ? localZ < 0
        ? 1
        : 0
      : localX / tangentLength;
  const unitY = tangentLength <= VECTOR_EPSILON ? 0 : localY / tangentLength;
  const xPixels = canvas.widthPixels / 2 + unitX * radialPixels;
  const yPixels = canvas.heightPixels / 2 - unitY * radialPixels;
  return {
    visible:
      angularDistanceRadians <= Math.PI + VECTOR_EPSILON &&
      xPixels >= 0 &&
      xPixels <= canvas.widthPixels &&
      yPixels >= 0 &&
      yPixels <= canvas.heightPixels,
    xPixels,
    yPixels,
  };
};

export const projectHorizontalDirection = (
  direction: HorizontalDirectionDegrees,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ProjectedSkyPoint => {
  'worklet';
  return projectVectorToCanvas(
    horizontalDirectionToVector(direction),
    camera,
    canvas,
  );
};

const canvasPointToLocalVector = (
  point: { xPixels: number; yPixels: number },
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): Vector3 | null => {
  'worklet';
  const deltaX = point.xPixels - canvas.widthPixels / 2;
  const deltaY = canvas.heightPixels / 2 - point.yPixels;
  const radiusPixels = Math.hypot(deltaX, deltaY);
  const projectionScale = getStereographicProjectionScale(camera, canvas);
  const angularDistanceRadians = 2 * Math.atan(radiusPixels / projectionScale);
  if (angularDistanceRadians > Math.PI) return null;
  if (radiusPixels <= VECTOR_EPSILON) return { x: 0, y: 0, z: 1 };
  const sine = Math.sin(angularDistanceRadians);
  return {
    x: (deltaX / radiusPixels) * sine,
    y: (deltaY / radiusPixels) * sine,
    z: Math.cos(angularDistanceRadians),
  };
};

const localVectorToWorld = (
  local: Vector3,
  camera: PlanetariumCamera,
): Vector3 => {
  'worklet';
  return addVectors(
    addVectors(
      scaleVector(camera.right, local.x),
      scaleVector(camera.up, local.y),
    ),
    scaleVector(camera.forward, local.z),
  );
};

export const unprojectCanvasPoint = (
  point: { xPixels: number; yPixels: number },
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): HorizontalDirectionDegrees | null => {
  'worklet';
  const local = canvasPointToLocalVector(point, camera, canvas);
  return local
    ? vectorToHorizontalDirection(localVectorToWorld(local, camera))
    : null;
};

const normalizeSignedDegrees = (degrees: number) => {
  'worklet';
  return ((degrees + 540) % 360) - 180;
};

const STELLARIUM_MANUAL_POLE_MARGIN_DEGREES = 0.000001;

/**
 * Incremental level Alt/Az drag matching Stellarium's dragView/panView model.
 * Both pointer directions are evaluated in the current mount frame. The next
 * camera is rebuilt from azimuth/altitude, so a drag cannot accumulate roll.
 */
export const applyPlanetariumPan = (
  currentCamera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  previousPoint: { xPixels: number; yPixels: number },
  currentPoint: { xPixels: number; yPixels: number },
): PlanetariumCamera => {
  'worklet';
  const previousDirection = unprojectCanvasPoint(
    previousPoint,
    currentCamera,
    canvas,
  );
  const currentDirection = unprojectCanvasPoint(
    currentPoint,
    currentCamera,
    canvas,
  );
  if (!previousDirection || !currentDirection) return currentCamera;

  const center = getPlanetariumCameraCenter(currentCamera);
  const pointerAzimuthDeltaDegrees = normalizeSignedDegrees(
    currentDirection.azimuthDegrees - previousDirection.azimuthDegrees,
  );
  const altitudeDeltaDegrees =
    previousDirection.altitudeDegrees - currentDirection.altitudeDegrees;
  return createPlanetariumCamera({
    centerAltitudeDegrees: clamp(
      center.altitudeDegrees + altitudeDeltaDegrees,
      -90 + STELLARIUM_MANUAL_POLE_MARGIN_DEGREES,
      90 - STELLARIUM_MANUAL_POLE_MARGIN_DEGREES,
    ),
    centerAzimuthDegrees: center.azimuthDegrees - pointerAzimuthDeltaDegrees,
    fieldOfViewDegrees: currentCamera.fieldOfViewDegrees,
  });
};

/** Stellarium touch pinch: starting FOV divided by scale, centre unchanged. */
export const applyPlanetariumZoom = (
  baseline: PlanetariumCamera,
  scale: number,
): PlanetariumCamera => {
  'worklet';
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('scale must be positive');
  }
  return {
    ...baseline,
    fieldOfViewDegrees: clamp(
      baseline.fieldOfViewDegrees / scale,
      MINIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
      MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
    ),
  };
};

export const angularSeparationDegrees = (
  left: HorizontalDirectionDegrees,
  right: HorizontalDirectionDegrees,
) => {
  'worklet';
  const leftVector = horizontalDirectionToVector(left);
  const rightVector = horizontalDirectionToVector(right);
  return (
    Math.atan2(
      magnitude(cross(leftVector, rightVector)),
      clamp(dot(leftVector, rightVector), -1, 1),
    ) * RADIANS_TO_DEGREES
  );
};

export const angularSizeDegreesToPixelsAtDirection = (
  angularSizeDegrees: number,
  direction: HorizontalDirectionDegrees,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  if (!Number.isFinite(angularSizeDegrees) || angularSizeDegrees < 0) {
    throw new RangeError('angularSizeDegrees must be finite and non-negative');
  }
  const directionVector = horizontalDirectionToVector(direction);
  const cosineFromCameraCenter = clamp(
    dot(directionVector, camera.forward),
    -1,
    1,
  );
  return (
    angularSizeDegrees *
    DEGREES_TO_RADIANS *
    (getStereographicProjectionScale(camera, canvas) /
      Math.max(1e-7, 1 + cosineFromCameraCenter))
  );
};

export const densifyHorizontalPath = (
  directions: readonly HorizontalDirectionDegrees[],
  maximumStepDegrees: number,
  closed = false,
): HorizontalDirectionDegrees[] => {
  if (!Number.isFinite(maximumStepDegrees) || maximumStepDegrees <= 0) {
    throw new RangeError('maximumStepDegrees must be positive');
  }
  if (directions.length < 2) return [...directions];

  const densified = [directions[0]!];
  const segmentCount = closed ? directions.length : directions.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = horizontalDirectionToVector(directions[index]!);
    const end = horizontalDirectionToVector(
      directions[(index + 1) % directions.length]!,
    );
    const separationRadians = Math.acos(clamp(dot(start, end), -1, 1));
    const steps = Math.max(
      1,
      Math.ceil((separationRadians * RADIANS_TO_DEGREES) / maximumStepDegrees),
    );
    const sineSeparation = Math.sin(separationRadians);
    const antipodalAxis =
      Math.abs(sineSeparation) <= VECTOR_EPSILON &&
      separationRadians > VECTOR_EPSILON
        ? normalize(
            Math.abs(start.x) < 0.8
              ? cross(start, { x: 1, y: 0, z: 0 })
              : cross(start, { x: 0, y: 1, z: 0 }),
          )
        : null;
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const vector =
        separationRadians <= VECTOR_EPSILON
          ? end
          : antipodalAxis
            ? normalize(
                addVectors(
                  scaleVector(start, Math.cos(separationRadians * ratio)),
                  scaleVector(
                    antipodalAxis,
                    Math.sin(separationRadians * ratio),
                  ),
                ),
              )
            : normalize(
                addVectors(
                  scaleVector(
                    start,
                    Math.sin((1 - ratio) * separationRadians) / sineSeparation,
                  ),
                  scaleVector(
                    end,
                    Math.sin(ratio * separationRadians) / sineSeparation,
                  ),
                ),
              );
      densified.push(vectorToHorizontalDirection(vector));
    }
  }
  return densified;
};

export const createPlanetariumInspectionCamera = (
  directions: readonly HorizontalDirectionDegrees[],
): PlanetariumCamera | null => {
  if (directions.length === 0) return null;
  const sum = directions.reduce(
    (total, direction) =>
      addVectors(total, horizontalDirectionToVector(direction)),
    { x: 0, y: 0, z: 0 },
  );
  const centerVector =
    magnitude(sum) <= VECTOR_EPSILON
      ? horizontalDirectionToVector(
          directions[Math.floor(directions.length / 2)]!,
        )
      : normalize(sum);
  const center = vectorToHorizontalDirection(centerVector);
  const maximumDistance = Math.max(
    ...directions.map((direction) =>
      angularSeparationDegrees(center, direction),
    ),
  );
  return createPlanetariumCamera({
    centerAltitudeDegrees: center.altitudeDegrees,
    centerAzimuthDegrees: center.azimuthDegrees,
    fieldOfViewDegrees: clamp(
      Math.max(24, maximumDistance * 2.4),
      MINIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
      MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
    ),
  });
};
