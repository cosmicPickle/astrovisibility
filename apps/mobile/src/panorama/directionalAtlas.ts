import {
  normalizeAzimuthDegrees,
  unwrapAzimuthDegreesNear,
  type HorizontalDirectionDegrees,
} from '../sky/projection';
import type { PlanetariumPanoramaMesh } from '../sky/planetariumPanoramaGeometry';

export const DIRECTIONAL_ATLAS_SIZE_PIXELS = 2048;
export const DIRECTIONAL_ATLAS_PROJECTION =
  'azimuthal-equidistant-upper-hemisphere';

export type DirectionalAtlasSize = Readonly<{
  heightPixels: number;
  widthPixels: number;
}>;

export type DirectionalAtlasPixel = Readonly<{
  xPixels: number;
  yPixels: number;
}>;

type PanoramaMeshVertex = Readonly<{
  direction: HorizontalDirectionDegrees;
  texturePointPixels: { x: number; y: number };
}>;

export type DirectionalAtlasRenderMesh = Readonly<{
  indices: number[];
  positions: DirectionalAtlasPixel[];
  texturePointsPixels: { x: number; y: number }[];
}>;

const validateSize = ({ heightPixels, widthPixels }: DirectionalAtlasSize) => {
  if (
    !Number.isFinite(widthPixels) ||
    !Number.isFinite(heightPixels) ||
    widthPixels <= 0 ||
    heightPixels <= 0
  ) {
    throw new RangeError('Directional atlas dimensions must be positive.');
  }
};

export function directionToAtlasPixel(
  direction: HorizontalDirectionDegrees,
  size: DirectionalAtlasSize,
): DirectionalAtlasPixel {
  validateSize(size);
  if (
    !Number.isFinite(direction.altitudeDegrees) ||
    direction.altitudeDegrees < 0 ||
    direction.altitudeDegrees > 90
  ) {
    throw new RangeError(
      'Directional atlas altitude must be within 0..90 degrees.',
    );
  }
  const radiusPixels = Math.min(size.widthPixels, size.heightPixels) / 2;
  const radialRatio = (90 - direction.altitudeDegrees) / 90;
  const azimuthRadians =
    normalizeAzimuthDegrees(direction.azimuthDegrees) * (Math.PI / 180);
  return {
    xPixels:
      size.widthPixels / 2 +
      radiusPixels * radialRatio * Math.sin(azimuthRadians),
    yPixels:
      size.heightPixels / 2 -
      radiusPixels * radialRatio * Math.cos(azimuthRadians),
  };
}

const interpolateAtHorizon = (
  start: PanoramaMeshVertex,
  end: PanoramaMeshVertex,
): PanoramaMeshVertex => {
  const ratio =
    start.direction.altitudeDegrees /
    (start.direction.altitudeDegrees - end.direction.altitudeDegrees);
  const endAzimuthDegrees = unwrapAzimuthDegreesNear(
    end.direction.azimuthDegrees,
    start.direction.azimuthDegrees,
  );
  return {
    direction: {
      altitudeDegrees: 0,
      azimuthDegrees: normalizeAzimuthDegrees(
        start.direction.azimuthDegrees +
          (endAzimuthDegrees - start.direction.azimuthDegrees) * ratio,
      ),
    },
    texturePointPixels: {
      x:
        start.texturePointPixels.x +
        (end.texturePointPixels.x - start.texturePointPixels.x) * ratio,
      y:
        start.texturePointPixels.y +
        (end.texturePointPixels.y - start.texturePointPixels.y) * ratio,
    },
  };
};

const clipTriangleAtHorizon = (
  triangle: readonly PanoramaMeshVertex[],
): PanoramaMeshVertex[] => {
  const clipped: PanoramaMeshVertex[] = [];
  for (let index = 0; index < triangle.length; index += 1) {
    const current = triangle[index]!;
    const previous = triangle[(index + triangle.length - 1) % triangle.length]!;
    const currentInside = current.direction.altitudeDegrees >= 0;
    const previousInside = previous.direction.altitudeDegrees >= 0;
    if (currentInside !== previousInside) {
      clipped.push(interpolateAtHorizon(previous, current));
    }
    if (currentInside) clipped.push(current);
  }
  return clipped;
};

/**
 * Clips capture geometry to the atlas' upper-hemisphere boundary. A camera may
 * be centred on the horizon, so rejecting its below-horizon edge would make an
 * otherwise valid draft impossible to finish.
 */
export function projectPanoramaMeshToDirectionalAtlas(
  mesh: PlanetariumPanoramaMesh,
  size: DirectionalAtlasSize,
): DirectionalAtlasRenderMesh {
  const positions: DirectionalAtlasPixel[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  const indices: number[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const triangle = mesh.indices
      .slice(index, index + 3)
      .map((vertexIndex) => ({
        direction: mesh.directions[vertexIndex]!,
        texturePointPixels: mesh.texturePointsPixels[vertexIndex]!,
      }));
    const clipped = clipTriangleAtHorizon(triangle);
    if (clipped.length < 3) continue;
    const firstIndex = positions.length;
    for (const vertex of clipped) {
      positions.push(directionToAtlasPixel(vertex.direction, size));
      texturePointsPixels.push(vertex.texturePointPixels);
    }
    for (
      let vertexIndex = 1;
      vertexIndex < clipped.length - 1;
      vertexIndex += 1
    ) {
      indices.push(
        firstIndex,
        firstIndex + vertexIndex,
        firstIndex + vertexIndex + 1,
      );
    }
  }
  return { indices, positions, texturePointsPixels };
}

export function isAtlasPixelInsideHemisphere(
  point: DirectionalAtlasPixel,
  size: DirectionalAtlasSize,
): boolean {
  validateSize(size);
  const radiusPixels = Math.min(size.widthPixels, size.heightPixels) / 2;
  return (
    Math.hypot(
      point.xPixels - size.widthPixels / 2,
      point.yPixels - size.heightPixels / 2,
    ) <= radiusPixels
  );
}

export function atlasPixelToDirection(
  point: DirectionalAtlasPixel,
  size: DirectionalAtlasSize,
): HorizontalDirectionDegrees | null {
  if (!isAtlasPixelInsideHemisphere(point, size)) return null;
  const deltaX = point.xPixels - size.widthPixels / 2;
  const deltaY = point.yPixels - size.heightPixels / 2;
  const radiusPixels = Math.min(size.widthPixels, size.heightPixels) / 2;
  return {
    altitudeDegrees: 90 - (Math.hypot(deltaX, deltaY) / radiusPixels) * 90,
    azimuthDegrees: normalizeAzimuthDegrees(
      Math.atan2(deltaX, -deltaY) * (180 / Math.PI),
    ),
  };
}

export function createDirectionalAtlasMesh(
  size: DirectionalAtlasSize,
  ringCount = 48,
  segmentCount = 144,
): PlanetariumPanoramaMesh {
  const directions: HorizontalDirectionDegrees[] = [
    { altitudeDegrees: 90, azimuthDegrees: 0 },
  ];
  const texturePointsPixels = [
    { x: size.widthPixels / 2, y: size.heightPixels / 2 },
  ];
  const indices: number[] = [];
  const ringStride = segmentCount + 1;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const altitudeDegrees = 90 - (ring / ringCount) * 90;
    for (let segment = 0; segment <= segmentCount; segment += 1) {
      const direction = {
        altitudeDegrees,
        azimuthDegrees: (segment / segmentCount) * 360,
      };
      directions.push(direction);
      const texture = directionToAtlasPixel(direction, size);
      texturePointsPixels.push({ x: texture.xPixels, y: texture.yPixels });
    }
  }
  for (let segment = 0; segment < segmentCount; segment += 1) {
    indices.push(0, 1 + segment, 1 + segment + 1);
  }
  for (let ring = 2; ring <= ringCount; ring += 1) {
    const previousStart = 1 + (ring - 2) * ringStride;
    const currentStart = 1 + (ring - 1) * ringStride;
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const previousLeft = previousStart + segment;
      const previousRight = previousLeft + 1;
      const currentLeft = currentStart + segment;
      const currentRight = currentLeft + 1;
      indices.push(
        previousLeft,
        currentLeft,
        currentRight,
        previousLeft,
        currentRight,
        previousRight,
      );
    }
  }
  return {
    angularRadiusDegrees: 90,
    centerDirection: { altitudeDegrees: 90, azimuthDegrees: 0 },
    columnCount: ringStride,
    directions,
    indices,
    rowCount: ringCount,
    texturePointsPixels,
  };
}
