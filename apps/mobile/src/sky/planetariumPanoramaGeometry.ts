import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import {
  createPlanetariumCamera,
  vectorToHorizontalDirection,
  type Vector3,
} from './planetariumProjection';
import type { HorizontalDirectionDegrees } from './projection';

const DEGREES_TO_RADIANS = Math.PI / 180;
const MAXIMUM_MESH_POINTS_PER_AXIS = 33;
const MAXIMUM_CELL_ANGLE_DEGREES = 5;

const pointCountForFieldOfView = (fieldOfViewDegrees: number) => {
  let segmentCount = Math.ceil(fieldOfViewDegrees / MAXIMUM_CELL_ANGLE_DEGREES);
  if (segmentCount % 2 !== 0) segmentCount += 1;
  return Math.min(MAXIMUM_MESH_POINTS_PER_AXIS, Math.max(3, segmentCount + 1));
};

const normalize = (vector: Vector3): Vector3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

/**
 * Maps a rectilinear capture tile onto horizontal unit-sphere directions.
 * The tangent-plane construction stays valid through north and zenith; it does
 * not clamp rows onto altitude 90 or add azimuth/altitude as planar offsets.
 */
export const createPlanetariumPanoramaMesh = (
  tile: ActivePanoramaTile,
): {
  columnCount: number;
  directions: HorizontalDirectionDegrees[];
  indices: number[];
  rowCount: number;
  texturePointsPixels: { x: number; y: number }[];
} => {
  const columnCount = pointCountForFieldOfView(
    tile.horizontalFieldOfViewDegrees,
  );
  const rowCount = pointCountForFieldOfView(tile.verticalFieldOfViewDegrees);
  const camera = createPlanetariumCamera({
    centerAltitudeDegrees: tile.centerAltitudeDegrees,
    centerAzimuthDegrees: tile.centerAzimuthDegrees,
    fieldOfViewDegrees: 60,
  });
  const horizontalTangent = Math.tan(
    (tile.horizontalFieldOfViewDegrees * DEGREES_TO_RADIANS) / 2,
  );
  const verticalTangent = Math.tan(
    (tile.verticalFieldOfViewDegrees * DEGREES_TO_RADIANS) / 2,
  );
  const rollRadians = tile.rollDegrees * DEGREES_TO_RADIANS;
  const cosineRoll = Math.cos(rollRadians);
  const sineRoll = Math.sin(rollRadians);
  const directions: HorizontalDirectionDegrees[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  const indices: number[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const verticalRatio = row / (rowCount - 1);
    for (let column = 0; column < columnCount; column += 1) {
      const horizontalRatio = column / (columnCount - 1);
      const tangentX = (horizontalRatio * 2 - 1) * horizontalTangent;
      const tangentY = (1 - verticalRatio * 2) * verticalTangent;
      const rolledX = tangentX * cosineRoll - tangentY * sineRoll;
      const rolledY = tangentX * sineRoll + tangentY * cosineRoll;
      directions.push(
        vectorToHorizontalDirection(
          normalize({
            x:
              camera.forward.x +
              camera.right.x * rolledX +
              camera.up.x * rolledY,
            y:
              camera.forward.y +
              camera.right.y * rolledX +
              camera.up.y * rolledY,
            z:
              camera.forward.z +
              camera.right.z * rolledX +
              camera.up.z * rolledY,
          }),
        ),
      );
      texturePointsPixels.push({
        x: horizontalRatio * tile.widthPixels,
        y: verticalRatio * tile.heightPixels,
      });
    }
  }
  for (let row = 0; row < rowCount - 1; row += 1) {
    for (let column = 0; column < columnCount - 1; column += 1) {
      const topLeft = row * columnCount + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columnCount;
      const bottomRight = bottomLeft + 1;
      indices.push(
        topLeft,
        topRight,
        bottomRight,
        topLeft,
        bottomRight,
        bottomLeft,
      );
    }
  }
  return {
    columnCount,
    directions,
    indices,
    rowCount,
    texturePointsPixels,
  };
};
