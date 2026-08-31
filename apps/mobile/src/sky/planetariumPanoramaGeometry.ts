import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { createTileDirectionProjector } from '../panorama/tileGeometry';
import {
  angularSeparationDegrees,
  createPlanetariumProjectionContext,
  getPlanetariumCameraCenter,
  horizontalDirectionToVector,
  projectUnitVectorToCanvas,
  type PlanetariumCamera,
  type PlanetariumProjectionContext,
  type Vector3,
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
  directionVectors?: Vector3[];
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
    directionVectors: directions.map(horizontalDirectionToVector),
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

interface PanoramaProjectionContext {
  cameraCenter: HorizontalDirectionDegrees;
  canvasAngularRadiusDegrees: number;
  projection: PlanetariumProjectionContext;
}

const createPanoramaProjectionContext = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): PanoramaProjectionContext => {
  'worklet';
  return {
    cameraCenter: getPlanetariumCameraCenter(camera),
    canvasAngularRadiusDegrees: canvasAngularRadiusDegrees(camera, canvas),
    projection: createPlanetariumProjectionContext(camera, canvas),
  };
};

export const projectPlanetariumPanoramaMesh = (
  mesh: PlanetariumPanoramaMesh,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  preparedContext?: PanoramaProjectionContext,
): {
  indices: number[];
  vertices: { xPixels: number; yPixels: number }[];
} => {
  'worklet';
  const context =
    preparedContext ?? createPanoramaProjectionContext(camera, canvas);
  if (
    angularSeparationDegrees(mesh.centerDirection, context.cameraCenter) >
    context.canvasAngularRadiusDegrees +
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
  const projectedXPixels: number[] = [];
  const projectedYPixels: number[] = [];
  const vertices: { xPixels: number; yPixels: number }[] = [];
  const directionVectors =
    mesh.directionVectors ?? mesh.directions.map(horizontalDirectionToVector);
  for (const directionVector of directionVectors) {
    const point = projectUnitVectorToCanvas(
      directionVector,
      context.projection,
    );
    projectedXPixels.push(point.xPixels);
    projectedYPixels.push(point.yPixels);
    vertices.push({
      xPixels: Math.max(minimumX, Math.min(maximumX, point.xPixels)),
      yPixels: Math.max(minimumY, Math.min(maximumY, point.yPixels)),
    });
  }
  const indices: number[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const firstIndex = mesh.indices[index]!;
    const secondIndex = mesh.indices[index + 1]!;
    const thirdIndex = mesh.indices[index + 2]!;
    const firstX = projectedXPixels[firstIndex]!;
    const firstY = projectedYPixels[firstIndex]!;
    const secondX = projectedXPixels[secondIndex]!;
    const secondY = projectedYPixels[secondIndex]!;
    const thirdX = projectedXPixels[thirdIndex]!;
    const thirdY = projectedYPixels[thirdIndex]!;
    if (
      !Number.isFinite(firstX) ||
      !Number.isFinite(firstY) ||
      !Number.isFinite(secondX) ||
      !Number.isFinite(secondY) ||
      !Number.isFinite(thirdX) ||
      !Number.isFinite(thirdY) ||
      firstX < minimumX ||
      firstX > maximumX ||
      firstY < minimumY ||
      firstY > maximumY ||
      secondX < minimumX ||
      secondX > maximumX ||
      secondY < minimumY ||
      secondY > maximumY ||
      thirdX < minimumX ||
      thirdX > maximumX ||
      thirdY < minimumY ||
      thirdY > maximumY
    ) {
      continue;
    }
    const minimumTriangleX = Math.min(firstX, secondX, thirdX);
    const maximumTriangleX = Math.max(firstX, secondX, thirdX);
    const minimumTriangleY = Math.min(firstY, secondY, thirdY);
    const maximumTriangleY = Math.max(firstY, secondY, thirdY);
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

export const projectPlanetariumPanoramaMeshes = (
  meshes: readonly PlanetariumPanoramaMesh[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): {
  indices: number[];
  texturePointsPixels: { x: number; y: number }[];
  vertices: { xPixels: number; yPixels: number }[];
} => {
  'worklet';
  const indices: number[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  const vertices: { xPixels: number; yPixels: number }[] = [];
  const context = createPanoramaProjectionContext(camera, canvas);
  for (const mesh of meshes) {
    const projection = projectPlanetariumPanoramaMesh(
      mesh,
      camera,
      canvas,
      context,
    );
    if (projection.indices.length === 0) continue;
    const vertexOffset = vertices.length;
    vertices.push(...projection.vertices);
    texturePointsPixels.push(...mesh.texturePointsPixels);
    for (const index of projection.indices) indices.push(index + vertexOffset);
  }
  return { indices, texturePointsPixels, vertices };
};
