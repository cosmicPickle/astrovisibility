import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { createTileDirectionProjector } from '../panorama/tileGeometry';
import type { HorizontalDirectionDegrees } from './projection';

const MAXIMUM_MESH_POINTS_PER_AXIS = 33;
const MAXIMUM_CELL_ANGLE_DEGREES = 5;

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
  return {
    columnCount,
    directions,
    indices,
    rowCount,
    texturePointsPixels,
  };
};
