import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import type { PlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';
import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const MINIMUM_EDITOR_SPAN = 0.2;
const MAXIMUM_EDITOR_SPAN = 2.4;
const INITIAL_VIEW_PADDING = 1.12;

export interface PanoramaEditorPoint {
  x: number;
  y: number;
}

export interface PanoramaEditorViewport {
  centerX: number;
  centerY: number;
  horizontalSpan: number;
}

export interface ProjectedPanoramaEditorMesh {
  indices: number[];
  vertices: { xPixels: number; yPixels: number }[];
}

const clampSpan = (span: number) =>
  Math.max(MINIMUM_EDITOR_SPAN, Math.min(MAXIMUM_EDITOR_SPAN, span));

export const directionToPanoramaEditorPoint = (
  direction: HorizontalDirectionDegrees,
): PanoramaEditorPoint => {
  const radialDistance = (90 - direction.altitudeDegrees) / 90;
  const azimuthRadians = direction.azimuthDegrees * DEGREES_TO_RADIANS;
  return {
    x: radialDistance * Math.sin(azimuthRadians),
    y: -radialDistance * Math.cos(azimuthRadians),
  };
};

export const panoramaEditorPointToDirection = (
  point: PanoramaEditorPoint,
): HorizontalDirectionDegrees | null => {
  'worklet';
  const radialDistance = Math.hypot(point.x, point.y);
  if (radialDistance > 1) return null;
  return {
    altitudeDegrees: 90 - radialDistance * 90,
    azimuthDegrees:
      (((Math.atan2(point.x, -point.y) * RADIANS_TO_DEGREES) % 360) + 360) %
      360,
  };
};

const verticalSpan = (
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  return viewport.horizontalSpan * (canvas.heightPixels / canvas.widthPixels);
};

export const projectPanoramaEditorPoint = (
  point: PanoramaEditorPoint,
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
) => ({
  xPixels:
    (0.5 + (point.x - viewport.centerX) / viewport.horizontalSpan) *
    canvas.widthPixels,
  yPixels:
    (0.5 + (point.y - viewport.centerY) / verticalSpan(viewport, canvas)) *
    canvas.heightPixels,
});

export const unprojectPanoramaEditorPoint = (
  point: { xPixels: number; yPixels: number },
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
): PanoramaEditorPoint => {
  'worklet';
  return {
    x:
      viewport.centerX +
      (point.xPixels / canvas.widthPixels - 0.5) * viewport.horizontalSpan,
    y:
      viewport.centerY +
      (point.yPixels / canvas.heightPixels - 0.5) *
        verticalSpan(viewport, canvas),
  };
};

export const createPanoramaEditorViewport = (
  tiles: readonly ActivePanoramaTile[],
): PanoramaEditorViewport => {
  const points = tiles.flatMap((tile) =>
    tile.coveragePolygon.map(directionToPanoramaEditorPoint),
  );
  if (points.length === 0) {
    return { centerX: 0, centerY: 0, horizontalSpan: 2.2 };
  }
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  return {
    centerX: (minimumX + maximumX) / 2,
    centerY: (minimumY + maximumY) / 2,
    horizontalSpan: clampSpan(
      Math.max(0.65, maximumX - minimumX, maximumY - minimumY) *
        INITIAL_VIEW_PADDING,
    ),
  };
};

export const applyPanoramaEditorPan = (
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
  gesture: { translationXPixels: number; translationYPixels: number },
): PanoramaEditorViewport => ({
  ...viewport,
  centerX:
    viewport.centerX -
    (gesture.translationXPixels / canvas.widthPixels) * viewport.horizontalSpan,
  centerY:
    viewport.centerY -
    (gesture.translationYPixels / canvas.heightPixels) *
      verticalSpan(viewport, canvas),
});

export const applyPanoramaEditorZoom = (
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
  gesture: { focalXPixels: number; focalYPixels: number; scale: number },
): PanoramaEditorViewport => {
  if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) {
    throw new RangeError('scale must be positive');
  }
  const nextHorizontalSpan = clampSpan(viewport.horizontalSpan / gesture.scale);
  const focalRatioX = gesture.focalXPixels / canvas.widthPixels - 0.5;
  const focalRatioY = gesture.focalYPixels / canvas.heightPixels - 0.5;
  const focalX = viewport.centerX + focalRatioX * viewport.horizontalSpan;
  const focalY =
    viewport.centerY + focalRatioY * verticalSpan(viewport, canvas);
  const nextViewport = { ...viewport, horizontalSpan: nextHorizontalSpan };
  return {
    centerX: focalX - focalRatioX * nextHorizontalSpan,
    centerY: focalY - focalRatioY * verticalSpan(nextViewport, canvas),
    horizontalSpan: nextHorizontalSpan,
  };
};

/** Maps a rectilinear photograph's spherical mesh onto one hemisphere disk. */
export const projectPanoramaMeshToEditorViewport = (
  mesh: PlanetariumPanoramaMesh,
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
): ProjectedPanoramaEditorMesh => ({
  indices: [...mesh.indices],
  vertices: mesh.directions.map((direction) => {
    const point = projectPanoramaEditorPoint(
      directionToPanoramaEditorPoint(direction),
      viewport,
      canvas,
    );
    return { xPixels: point.xPixels, yPixels: point.yPixels };
  }),
});

export const panoramaEditorAngularRadiusToPixels = (
  angularRadiusDegrees: number,
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
) => (angularRadiusDegrees / 90 / viewport.horizontalSpan) * canvas.widthPixels;

export const panoramaEditorPixelRadiusToDegrees = (
  radiusPixels: number,
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  return (radiusPixels / canvas.widthPixels) * viewport.horizontalSpan * 90;
};
