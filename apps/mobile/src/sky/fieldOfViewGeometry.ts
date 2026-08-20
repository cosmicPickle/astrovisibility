import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import {
  horizontalDirectionToVector,
  vectorToHorizontalDirection,
  type Vector3,
} from './planetariumProjection';
import type { HorizontalDirectionDegrees } from './projection';

const DEGREES_TO_RADIANS = Math.PI / 180;

const normalizeVector = (vector: Vector3): Vector3 => {
  'worklet';
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const addScaledVectors = (
  center: Vector3,
  horizontal: Vector3,
  horizontalScale: number,
  vertical: Vector3,
  verticalScale: number,
): Vector3 => {
  'worklet';
  return normalizeVector({
    x: center.x + horizontal.x * horizontalScale + vertical.x * verticalScale,
    y: center.y + horizontal.y * horizontalScale + vertical.y * verticalScale,
    z: center.z + horizontal.z * horizontalScale + vertical.z * verticalScale,
  });
};

const createTangentAxes = (
  center: HorizontalDirectionDegrees,
  rotationDegrees: number,
) => {
  'worklet';
  const azimuthRadians = center.azimuthDegrees * DEGREES_TO_RADIANS;
  const altitudeRadians = center.altitudeDegrees * DEGREES_TO_RADIANS;
  const east = {
    x: Math.cos(azimuthRadians),
    y: 0,
    z: -Math.sin(azimuthRadians),
  };
  const up = {
    x: -Math.sin(altitudeRadians) * Math.sin(azimuthRadians),
    y: Math.cos(altitudeRadians),
    z: -Math.sin(altitudeRadians) * Math.cos(azimuthRadians),
  };
  const rotationRadians = rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  return {
    sensorRight: {
      x: east.x * cosine + up.x * sine,
      y: east.y * cosine + up.y * sine,
      z: east.z * cosine + up.z * sine,
    },
    sensorUp: {
      x: -east.x * sine + up.x * cosine,
      y: -east.y * sine + up.y * cosine,
      z: -east.z * sine + up.z * cosine,
    },
  };
};

export interface RectilinearFieldOfViewFootprint {
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
  corners: readonly HorizontalDirectionDegrees[];
  edgeMidpoints: Readonly<{
    left: HorizontalDirectionDegrees;
    right: HorizontalDirectionDegrees;
    top: HorizontalDirectionDegrees;
    bottom: HorizontalDirectionDegrees;
  }>;
  boundary: readonly HorizontalDirectionDegrees[];
}

/**
 * Maps a rectangular sensor through a rectilinear (gnomonic) camera model onto
 * the celestial sphere. The rectangle is therefore correct at the zenith and
 * across azimuth wrap before the planetarium projection is applied.
 */
export const createRectilinearFieldOfViewFootprint = ({
  center,
  equipment,
  maximumStepDegrees,
}: {
  center: HorizontalDirectionDegrees;
  equipment: EquipmentRecord;
  maximumStepDegrees: number;
}): RectilinearFieldOfViewFootprint => {
  'worklet';
  if (!Number.isFinite(maximumStepDegrees) || maximumStepDegrees <= 0) {
    throw new RangeError('maximumStepDegrees must be positive');
  }
  const fieldOfView = calculateAngularFieldOfView(equipment);
  const centerVector = horizontalDirectionToVector(center);
  const { sensorRight, sensorUp } = createTangentAxes(
    center,
    equipment.frameRotationDegrees,
  );
  const halfHorizontalRadians =
    (fieldOfView.horizontalFovDegrees * DEGREES_TO_RADIANS) / 2;
  const halfVerticalRadians =
    (fieldOfView.verticalFovDegrees * DEGREES_TO_RADIANS) / 2;
  const halfWidth = Math.tan(halfHorizontalRadians);
  const halfHeight = Math.tan(halfVerticalRadians);
  const directionAt = (horizontalUnit: number, verticalUnit: number) => {
    'worklet';
    return vectorToHorizontalDirection(
      addScaledVectors(
        centerVector,
        sensorRight,
        horizontalUnit * halfWidth,
        sensorUp,
        verticalUnit * halfHeight,
      ),
    );
  };
  const corners = [
    directionAt(-1, 1),
    directionAt(1, 1),
    directionAt(1, -1),
    directionAt(-1, -1),
  ];
  const horizontalSteps = Math.max(
    1,
    Math.ceil(fieldOfView.horizontalFovDegrees / maximumStepDegrees),
  );
  const verticalSteps = Math.max(
    1,
    Math.ceil(fieldOfView.verticalFovDegrees / maximumStepDegrees),
  );
  const boundary: HorizontalDirectionDegrees[] = [];
  const addEdge = (
    steps: number,
    startHorizontal: number,
    startVertical: number,
    endHorizontal: number,
    endVertical: number,
  ) => {
    'worklet';
    for (let index = 0; index < steps; index += 1) {
      const progress = index / steps;
      boundary.push(
        directionAt(
          startHorizontal + (endHorizontal - startHorizontal) * progress,
          startVertical + (endVertical - startVertical) * progress,
        ),
      );
    }
  };
  addEdge(horizontalSteps, -1, 1, 1, 1);
  addEdge(verticalSteps, 1, 1, 1, -1);
  addEdge(horizontalSteps, 1, -1, -1, -1);
  addEdge(verticalSteps, -1, -1, -1, 1);

  return {
    ...fieldOfView,
    corners,
    edgeMidpoints: {
      left: directionAt(-1, 0),
      right: directionAt(1, 0),
      top: directionAt(0, 1),
      bottom: directionAt(0, -1),
    },
    boundary,
  };
};
