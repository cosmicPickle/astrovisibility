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

export interface PlanetariumMountFrame {
  kind: 'equatorial' | 'horizontal';
  pole: Vector3;
  quarterLongitude: Vector3;
  zeroLongitude: Vector3;
}

export interface PlanetariumCamera {
  fieldOfViewDegrees: number;
  forward: Vector3;
  mountFrame: PlanetariumMountFrame;
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

const HORIZONTAL_MOUNT_FRAME: PlanetariumMountFrame = {
  kind: 'horizontal',
  pole: { x: 0, y: 1, z: 0 },
  quarterLongitude: { x: 1, y: 0, z: 0 },
  zeroLongitude: { x: 0, y: 0, z: 1 },
};

export const createEquatorialMountFrame = (
  observerLatitudeDegrees: number,
): PlanetariumMountFrame => {
  'worklet';
  if (
    !Number.isFinite(observerLatitudeDegrees) ||
    observerLatitudeDegrees < -90 ||
    observerLatitudeDegrees > 90
  ) {
    throw new RangeError('observerLatitudeDegrees must be -90..90');
  }
  const latitudeRadians = observerLatitudeDegrees * DEGREES_TO_RADIANS;
  const pole = {
    x: 0,
    y: Math.sin(latitudeRadians),
    z: Math.cos(latitudeRadians),
  };
  const quarterLongitude = { x: 1, y: 0, z: 0 };
  return {
    kind: 'equatorial',
    pole,
    quarterLongitude,
    zeroLongitude: normalize(cross(quarterLongitude, pole)),
  };
};

const mountDirectionToVector = (
  mountFrame: PlanetariumMountFrame,
  direction: { latitudeDegrees: number; longitudeDegrees: number },
): Vector3 => {
  'worklet';
  const longitudeRadians = direction.longitudeDegrees * DEGREES_TO_RADIANS;
  const latitudeRadians = direction.latitudeDegrees * DEGREES_TO_RADIANS;
  const equatorialRadius = Math.cos(latitudeRadians);
  return addVectors(
    addVectors(
      scaleVector(
        mountFrame.zeroLongitude,
        equatorialRadius * Math.cos(longitudeRadians),
      ),
      scaleVector(
        mountFrame.quarterLongitude,
        equatorialRadius * Math.sin(longitudeRadians),
      ),
    ),
    scaleVector(mountFrame.pole, Math.sin(latitudeRadians)),
  );
};

const vectorToMountDirection = (
  mountFrame: PlanetariumMountFrame,
  rawVector: Vector3,
) => {
  'worklet';
  const vector = normalize(rawVector);
  return {
    latitudeDegrees:
      Math.asin(clamp(dot(vector, mountFrame.pole), -1, 1)) *
      RADIANS_TO_DEGREES,
    longitudeDegrees:
      (((Math.atan2(
        dot(vector, mountFrame.quarterLongitude),
        dot(vector, mountFrame.zeroLongitude),
      ) *
        RADIANS_TO_DEGREES) %
        360) +
        360) %
      360,
  };
};

export const mountDirectionToHorizontalDirection = (
  mountFrame: PlanetariumMountFrame,
  direction: { latitudeDegrees: number; longitudeDegrees: number },
): HorizontalDirectionDegrees =>
  vectorToHorizontalDirection(mountDirectionToVector(mountFrame, direction));

const createCameraInMountFrame = ({
  centerLatitudeDegrees,
  centerLongitudeDegrees,
  fieldOfViewDegrees,
  mountFrame,
}: {
  centerLatitudeDegrees: number;
  centerLongitudeDegrees: number;
  fieldOfViewDegrees: number;
  mountFrame: PlanetariumMountFrame;
}): PlanetariumCamera => {
  'worklet';
  const longitudeRadians = centerLongitudeDegrees * DEGREES_TO_RADIANS;
  const latitudeRadians = centerLatitudeDegrees * DEGREES_TO_RADIANS;
  const longitudeDirection = addVectors(
    scaleVector(mountFrame.zeroLongitude, Math.cos(longitudeRadians)),
    scaleVector(mountFrame.quarterLongitude, Math.sin(longitudeRadians)),
  );
  const right = addVectors(
    scaleVector(mountFrame.zeroLongitude, -Math.sin(longitudeRadians)),
    scaleVector(mountFrame.quarterLongitude, Math.cos(longitudeRadians)),
  );
  const up = addVectors(
    scaleVector(longitudeDirection, -Math.sin(latitudeRadians)),
    scaleVector(mountFrame.pole, Math.cos(latitudeRadians)),
  );
  return {
    fieldOfViewDegrees,
    forward: mountDirectionToVector(mountFrame, {
      latitudeDegrees: centerLatitudeDegrees,
      longitudeDegrees: centerLongitudeDegrees,
    }),
    mountFrame,
    right: normalize(right),
    up: normalize(up),
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
  return createCameraInMountFrame({
    centerLatitudeDegrees: centerAltitudeDegrees,
    centerLongitudeDegrees: centerAzimuthDegrees,
    fieldOfViewDegrees,
    mountFrame: HORIZONTAL_MOUNT_FRAME,
  });
};

export const createEquatorialPlanetariumCamera = ({
  centerAltitudeDegrees,
  centerAzimuthDegrees,
  fieldOfViewDegrees,
  observerLatitudeDegrees,
}: {
  centerAltitudeDegrees: number;
  centerAzimuthDegrees: number;
  fieldOfViewDegrees: number;
  observerLatitudeDegrees: number;
}): PlanetariumCamera => {
  'worklet';
  const validatedHorizontalCamera = createPlanetariumCamera({
    centerAltitudeDegrees,
    centerAzimuthDegrees,
    fieldOfViewDegrees,
  });
  const mountFrame = createEquatorialMountFrame(observerLatitudeDegrees);
  const mountCenter = vectorToMountDirection(
    mountFrame,
    validatedHorizontalCamera.forward,
  );
  return createCameraInMountFrame({
    centerLatitudeDegrees: mountCenter.latitudeDegrees,
    centerLongitudeDegrees: mountCenter.longitudeDegrees,
    fieldOfViewDegrees,
    mountFrame,
  });
};

/** Conventional north-facing start with the horizon low and zenith in view. */
export const createInitialPlanetariumCamera = (): PlanetariumCamera => {
  'worklet';
  return createPlanetariumCamera({
    centerAltitudeDegrees: 35,
    centerAzimuthDegrees: 0,
    fieldOfViewDegrees: 100,
  });
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
      xPixels >= -VECTOR_EPSILON &&
      xPixels <= canvas.widthPixels + VECTOR_EPSILON &&
      yPixels >= -VECTOR_EPSILON &&
      yPixels <= canvas.heightPixels + VECTOR_EPSILON,
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

const rotateVectorFromTo = (
  vector: Vector3,
  fromDirection: Vector3,
  toDirection: Vector3,
) => {
  'worklet';
  const rotationAxis = cross(fromDirection, toDirection);
  const sine = magnitude(rotationAxis);
  const cosine = clamp(dot(fromDirection, toDirection), -1, 1);
  if (sine <= VECTOR_EPSILON) return vector;
  const unitAxis = scaleVector(rotationAxis, 1 / sine);
  return addVectors(
    addVectors(
      scaleVector(vector, cosine),
      scaleVector(cross(unitAxis, vector), sine),
    ),
    scaleVector(unitAxis, dot(unitAxis, vector) * (1 - cosine)),
  );
};

const createLevelPannedCamera = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  grabbedWorldDirection: Vector3,
  currentPoint: { xPixels: number; yPixels: number },
) => {
  'worklet';
  const currentLocalDirection = canvasPointToLocalVector(
    currentPoint,
    camera,
    canvas,
  );
  if (!currentLocalDirection) return camera;
  const currentWorldDirection = localVectorToWorld(
    currentLocalDirection,
    camera,
  );
  const nextForward = rotateVectorFromTo(
    camera.forward,
    currentWorldDirection,
    grabbedWorldDirection,
  );
  const nextCenter = vectorToMountDirection(camera.mountFrame, nextForward);
  return createCameraInMountFrame({
    centerLatitudeDegrees: nextCenter.latitudeDegrees,
    centerLongitudeDegrees: nextCenter.longitudeDegrees,
    fieldOfViewDegrees: camera.fieldOfViewDegrees,
    mountFrame: camera.mountFrame,
  });
};

/**
 * Stable spherical drag matching Stellarium's grab-and-move behavior. One 3D
 * rotation maps the current pointer ray to the gesture-start ray. Rebuilding in
 * the retained mount frame removes roll and avoids longitude singularities at
 * the zenith and nadir.
 */
export const applyPlanetariumPan = (
  currentCamera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  previousPoint: { xPixels: number; yPixels: number },
  currentPoint: { xPixels: number; yPixels: number },
): PlanetariumCamera => {
  'worklet';
  const previousLocalDirection = canvasPointToLocalVector(
    previousPoint,
    currentCamera,
    canvas,
  );
  if (!previousLocalDirection) return currentCamera;
  const grabbedWorldDirection = localVectorToWorld(
    previousLocalDirection,
    currentCamera,
  );
  let nextCamera = currentCamera;
  // Re-leveling removes roll and moves the grabbed ray slightly for diagonal
  // drags. A few bounded corrections solve the two-dimensional camera centre
  // while keeping the horizontal/equatorial mount level.
  for (let iteration = 0; iteration < 4; iteration += 1) {
    nextCamera = createLevelPannedCamera(
      nextCamera,
      canvas,
      grabbedWorldDirection,
      currentPoint,
    );
    const grabbedPoint = projectVectorToCanvas(
      grabbedWorldDirection,
      nextCamera,
      canvas,
    );
    if (
      Math.hypot(
        grabbedPoint.xPixels - currentPoint.xPixels,
        grabbedPoint.yPixels - currentPoint.yPixels,
      ) < 0.01
    ) {
      break;
    }
  }
  return nextCamera;
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
