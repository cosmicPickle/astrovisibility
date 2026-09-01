import {
  createCelestialObservedFrame,
  projectPreparedJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
} from '../astronomy/celestialTimeTransform';
import type { CelestialImageMesh } from './celestialSkyGeometry';
import {
  createPlanetariumProjectionContext,
  projectUnitVectorToCanvas,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { CanvasSizePixels } from './projection';
import { clampCelestialTimestampMilliseconds } from './celestialPlanetariumProjection';

export interface ProjectedCelestialImageMeshes {
  indices: number[];
  texturePointsPixels: { x: number; y: number }[];
  vertices: { xPixels: number; yPixels: number }[];
}

const MESH_CULL_GUARD_DEGREES = 5;

const canvasAngularRadiusDegrees = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  const projectionScalePixels =
    Math.min(canvas.widthPixels, canvas.heightPixels) /
    2 /
    Math.tan((camera.fieldOfViewDegrees * Math.PI) / 720);
  return (
    (2 *
      Math.atan(
        Math.hypot(canvas.widthPixels / 2, canvas.heightPixels / 2) /
          projectionScalePixels,
      ) *
      180) /
    Math.PI
  );
};

export const projectCelestialImageMeshes = (
  meshes: readonly CelestialImageMesh[],
  timeTransform: CelestialTimeTransform,
  timestampMilliseconds: number,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ProjectedCelestialImageMeshes => {
  'worklet';
  const boundedTimestampMilliseconds = clampCelestialTimestampMilliseconds(
    timeTransform,
    timestampMilliseconds,
  );
  const projectionContext = createPlanetariumProjectionContext(camera, canvas);
  const observedFrame = createCelestialObservedFrame(
    timeTransform,
    boundedTimestampMilliseconds,
  );
  const marginPixels = Math.hypot(canvas.widthPixels, canvas.heightPixels);
  const minimumX = -marginPixels;
  const maximumX = canvas.widthPixels + marginPixels;
  const minimumY = -marginPixels;
  const maximumY = canvas.heightPixels + marginPixels;
  const indices: number[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  const vertices: { xPixels: number; yPixels: number }[] = [];
  const canvasRadiusDegrees = canvasAngularRadiusDegrees(camera, canvas);

  for (const mesh of meshes) {
    const observedCenter = projectPreparedJ2000ToObservedHorizontalVector(
      mesh.centerJ2000UnitVector,
      observedFrame,
    );
    const centerDotProduct = Math.max(
      -1,
      Math.min(
        1,
        observedCenter.x * camera.forward.x +
          observedCenter.y * camera.forward.y +
          observedCenter.z * camera.forward.z,
      ),
    );
    if (
      (Math.acos(centerDotProduct) * 180) / Math.PI >
      canvasRadiusDegrees + mesh.angularRadiusDegrees + MESH_CULL_GUARD_DEGREES
    ) {
      continue;
    }
    const projectedXPixels: number[] = [];
    const projectedYPixels: number[] = [];
    const vertexInsideProjectionBounds: boolean[] = [];
    let allVerticesInsideProjectionBounds = true;
    let meshMinimumX = Number.POSITIVE_INFINITY;
    let meshMaximumX = Number.NEGATIVE_INFINITY;
    let meshMinimumY = Number.POSITIVE_INFINITY;
    let meshMaximumY = Number.NEGATIVE_INFINITY;
    const meshVertices: { xPixels: number; yPixels: number }[] = [];
    for (const j2000UnitVector of mesh.directionVectors) {
      const point = projectUnitVectorToCanvas(
        projectPreparedJ2000ToObservedHorizontalVector(
          j2000UnitVector,
          observedFrame,
        ),
        projectionContext,
      );
      projectedXPixels.push(point.xPixels);
      projectedYPixels.push(point.yPixels);
      const insideProjectionBounds =
        Number.isFinite(point.xPixels) &&
        Number.isFinite(point.yPixels) &&
        point.xPixels >= minimumX &&
        point.xPixels <= maximumX &&
        point.yPixels >= minimumY &&
        point.yPixels <= maximumY;
      vertexInsideProjectionBounds.push(insideProjectionBounds);
      allVerticesInsideProjectionBounds =
        allVerticesInsideProjectionBounds && insideProjectionBounds;
      meshMinimumX = Math.min(meshMinimumX, point.xPixels);
      meshMaximumX = Math.max(meshMaximumX, point.xPixels);
      meshMinimumY = Math.min(meshMinimumY, point.yPixels);
      meshMaximumY = Math.max(meshMaximumY, point.yPixels);
      meshVertices.push({
        xPixels: Number.isFinite(point.xPixels)
          ? Math.max(minimumX, Math.min(maximumX, point.xPixels))
          : minimumX,
        yPixels: Number.isFinite(point.yPixels)
          ? Math.max(minimumY, Math.min(maximumY, point.yPixels))
          : minimumY,
      });
    }

    const meshIndices: number[] = [];
    if (allVerticesInsideProjectionBounds) {
      if (
        meshMaximumX >= 0 &&
        meshMinimumX <= canvas.widthPixels &&
        meshMaximumY >= 0 &&
        meshMinimumY <= canvas.heightPixels
      ) {
        meshIndices.push(...mesh.indices);
      }
    } else {
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
          !vertexInsideProjectionBounds[firstIndex] ||
          !vertexInsideProjectionBounds[secondIndex] ||
          !vertexInsideProjectionBounds[thirdIndex]
        ) {
          continue;
        }
        if (
          Math.max(firstX, secondX, thirdX) >= 0 &&
          Math.min(firstX, secondX, thirdX) <= canvas.widthPixels &&
          Math.max(firstY, secondY, thirdY) >= 0 &&
          Math.min(firstY, secondY, thirdY) <= canvas.heightPixels
        ) {
          meshIndices.push(firstIndex, secondIndex, thirdIndex);
        }
      }
    }

    if (meshIndices.length === 0) continue;
    const vertexOffset = vertices.length;
    vertices.push(...meshVertices);
    texturePointsPixels.push(...mesh.texturePointsPixels);
    for (const index of meshIndices) indices.push(vertexOffset + index);
  }

  return { indices, texturePointsPixels, vertices };
};
