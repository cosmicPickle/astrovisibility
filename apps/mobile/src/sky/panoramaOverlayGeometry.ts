import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import type { CanvasSizePixels } from './projection';
import { unwrapAzimuthDegreesNear } from './projection';
import {
  constrainSkyViewport,
  getVerticalSpanDegrees,
  type SkyViewport,
} from './skyViewport';

export interface ProjectedPanoramaTile {
  key: string;
  tileId: string;
  uri: string;
  centerXPixels: number;
  centerYPixels: number;
  widthPixels: number;
  heightPixels: number;
  rotationDegrees: number;
}

export const projectPanoramaTilesToViewport = (
  tiles: readonly ActivePanoramaTile[],
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
): ProjectedPanoramaTile[] => {
  const viewport = constrainSkyViewport(rawViewport, canvas);
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  return tiles.flatMap((tile) => {
    const widthPixels =
      (tile.horizontalFieldOfViewDegrees / viewport.horizontalSpanDegrees) *
      canvas.widthPixels;
    const heightPixels =
      (tile.verticalFieldOfViewDegrees / verticalSpanDegrees) *
      canvas.heightPixels;
    const centerYPixels =
      (0.5 -
        (tile.centerAltitudeDegrees - viewport.centerAltitudeDegrees) /
          verticalSpanDegrees) *
      canvas.heightPixels;
    if (
      centerYPixels + heightPixels / 2 < 0 ||
      centerYPixels - heightPixels / 2 > canvas.heightPixels
    ) {
      return [];
    }
    const nearestAzimuthDegrees = unwrapAzimuthDegreesNear(
      tile.centerAzimuthDegrees,
      viewport.centerAzimuthDegrees,
    );
    return [-360, 0, 360].flatMap((wrapOffsetDegrees) => {
      const unwrappedAzimuthDegrees = nearestAzimuthDegrees + wrapOffsetDegrees;
      const centerXPixels =
        (0.5 +
          (unwrappedAzimuthDegrees - viewport.centerAzimuthDegrees) /
            viewport.horizontalSpanDegrees) *
        canvas.widthPixels;
      if (
        centerXPixels + widthPixels / 2 < 0 ||
        centerXPixels - widthPixels / 2 > canvas.widthPixels
      ) {
        return [];
      }
      return [
        {
          key: `${tile.id}-${unwrappedAzimuthDegrees}`,
          tileId: tile.id,
          uri: tile.uri,
          centerXPixels,
          centerYPixels,
          widthPixels,
          heightPixels,
          rotationDegrees: tile.rollDegrees,
        },
      ];
    });
  });
};
