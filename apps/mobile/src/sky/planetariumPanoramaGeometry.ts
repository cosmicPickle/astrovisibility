import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { createTileDirectionProjector } from '../panorama/tileGeometry';
import {
  angularSeparationDegrees,
  getPlanetariumCameraCenter,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';

const MAXIMUM_MESH_POINTS_PER_AXIS = 33;
const MAXIMUM_CELL_ANGLE_DEGREES = 5;

export interface PlanetariumPanoramaMesh {
  angularRadiusDegrees: number;
  centerDirection: HorizontalDirectionDegrees;
  columnCount: number;
  directions: HorizontalDirectionDegrees[];
  indices: number[];
  rowCount: number;
  texturePointsPixels: { x: number; y: number }[];
}

const pointCountForFieldOfView = (fieldOfViewDegrees: number) => {
  let segmentCount = Math.ceil(fieldOfViewDegrees / MAXIMUM_CELL_ANGLE_DEGREES);
  if (segmentCount % 2 !== 0) segmentCount += 1;
  return Math.min(MAXIMUM_MESH_POINTS_PER_AXIS, Math.max(3, segmentCount + 1));
};

/**
 * Maps a rectilinear capture tile onto horizontal unit-sphere directions.
 * The tangent-plane construction stays valid through north and zenith; it does
 * not clamp rows onto altitude 90 or add azimuth/altitude as planar offsets.
 */
export const createPlanetariumPanoramaMesh = (
  tile: ActivePanoramaTile,
): PlanetariumPanoramaMesh => {
  const columnCount = pointCountForFieldOfView(
    tile.horizontalFieldOfViewDegrees,
  );
  const rowCount = pointCountForFieldOfView(tile.verticalFieldOfViewDegrees);
  const projectDirection = createTileDirectionProjector(tile);
  const directions: HorizontalDirectionDegrees[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  const indices: number[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const verticalRatio = row / (rowCount - 1);
    for (let column = 0; column < columnCount; column += 1) {
      const horizontalRatio = column / (columnCount - 1);
      directions.push(
        projectDirection(horizontalRatio * 2 - 1, 1 - verticalRatio * 2),
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
  const centerDirection = directions[Math.floor(directions.length / 2)]!;
  return {
    angularRadiusDegrees: Math.max(
      ...directions.map((direction) =>
        angularSeparationDegrees(centerDirection, direction),
      ),
    ),
    centerDirection,
    columnCount,
    directions,
    indices,
    rowCount,
    texturePointsPixels,
  };
};

const canvasAngularRadiusDegrees = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  const halfMinimumDimensionPixels =
    Math.min(canvas.widthPixels, canvas.heightPixels) / 2;
  const projectionScale =
    halfMinimumDimensionPixels /
    Math.tan((camera.fieldOfViewDegrees * Math.PI) / 720);
  const cornerRadiusPixels = Math.hypot(
    canvas.widthPixels / 2,
    canvas.heightPixels / 2,
  );
  return (2 * Math.atan(cornerRadiusPixels / projectionScale) * 180) / Math.PI;
};

export const projectPlanetariumPanoramaMesh = (
  mesh: PlanetariumPanoramaMesh,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): {
  indices: number[];
  vertices: { xPixels: number; yPixels: number }[];
} => {
  'worklet';
  const cameraCenter = getPlanetariumCameraCenter(camera);
  if (
    angularSeparationDegrees(mesh.centerDirection, cameraCenter) >
    canvasAngularRadiusDegrees(camera, canvas) +
      mesh.angularRadiusDegrees +
      MAXIMUM_CELL_ANGLE_DEGREES
  ) {
    return { indices: [], vertices: [] };
  }

  const marginPixels = Math.hypot(canvas.widthPixels, canvas.heightPixels);
  const minimumX = -marginPixels;
  const maximumX = canvas.widthPixels + marginPixels;
  const minimumY = -marginPixels;
  const maximumY = canvas.heightPixels + marginPixels;
  const projected = mesh.directions.map((direction) =>
    projectHorizontalDirection(direction, camera, canvas),
  );
  const vertices = projected.map((point) => ({
    xPixels: Math.max(minimumX, Math.min(maximumX, point.xPixels)),
    yPixels: Math.max(minimumY, Math.min(maximumY, point.yPixels)),
  }));
  const indices: number[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const firstIndex = mesh.indices[index]!;
    const secondIndex = mesh.indices[index + 1]!;
    const thirdIndex = mesh.indices[index + 2]!;
    const first = projected[firstIndex]!;
    const second = projected[secondIndex]!;
    const third = projected[thirdIndex]!;
    const allWithinMargin = [first, second, third].every(
      (point) =>
        Number.isFinite(point.xPixels) &&
        Number.isFinite(point.yPixels) &&
        point.xPixels >= minimumX &&
        point.xPixels <= maximumX &&
        point.yPixels >= minimumY &&
        point.yPixels <= maximumY,
    );
    if (!allWithinMargin) continue;
    const minimumTriangleX = Math.min(
      first.xPixels,
      second.xPixels,
      third.xPixels,
    );
    const maximumTriangleX = Math.max(
      first.xPixels,
      second.xPixels,
      third.xPixels,
    );
    const minimumTriangleY = Math.min(
      first.yPixels,
      second.yPixels,
      third.yPixels,
    );
    const maximumTriangleY = Math.max(
      first.yPixels,
      second.yPixels,
      third.yPixels,
    );
    if (
      maximumTriangleX >= 0 &&
      minimumTriangleX <= canvas.widthPixels &&
      maximumTriangleY >= 0 &&
      minimumTriangleY <= canvas.heightPixels
    ) {
      indices.push(firstIndex, secondIndex, thirdIndex);
    }
  }
  return { indices, vertices };
};
