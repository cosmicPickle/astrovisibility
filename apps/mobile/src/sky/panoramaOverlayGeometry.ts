import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import type { CanvasSizePixels } from './projection';
import { unwrapAzimuthDegreesNear } from './projection';
import {
  constrainSkyViewport,
  createSkyViewport,
  getVerticalSpanDegrees,
  type SkyViewport,
} from './skyViewport';

const normalizeAzimuthDegrees = (value: number) => ((value % 360) + 360) % 360;
const MAXIMUM_INITIAL_EDITOR_SPAN_DEGREES = 120;

export const createPanoramaEditorViewport = (
  tiles: readonly ActivePanoramaTile[],
): SkyViewport => {
  if (tiles.length === 0) {
    return createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 360,
    });
  }
  const azimuthSamples = tiles
    .flatMap((tile) => [
      tile.centerAzimuthDegrees - tile.horizontalFieldOfViewDegrees / 2,
      tile.centerAzimuthDegrees,
      tile.centerAzimuthDegrees + tile.horizontalFieldOfViewDegrees / 2,
    ])
    .map(normalizeAzimuthDegrees)
    .sort((left, right) => left - right);
  let largestGapDegrees = -1;
  let arcStartDegrees = azimuthSamples[0]!;
  for (let index = 0; index < azimuthSamples.length; index += 1) {
    const current = azimuthSamples[index]!;
    const next =
      index === azimuthSamples.length - 1
        ? azimuthSamples[0]! + 360
        : azimuthSamples[index + 1]!;
    const gapDegrees = next - current;
    if (gapDegrees > largestGapDegrees) {
      largestGapDegrees = gapDegrees;
      arcStartDegrees = normalizeAzimuthDegrees(next);
    }
  }
  const coveredSpanDegrees = 360 - largestGapDegrees;
  const fittedCenterAzimuthDegrees = normalizeAzimuthDegrees(
    arcStartDegrees + coveredSpanDegrees / 2,
  );
  const minimumAltitudeDegrees = Math.max(
    0,
    Math.min(
      ...tiles.map(
        (tile) =>
          tile.centerAltitudeDegrees - tile.verticalFieldOfViewDegrees / 2,
      ),
    ),
  );
  const maximumAltitudeDegrees = Math.min(
    90,
    Math.max(
      ...tiles.map(
        (tile) =>
          tile.centerAltitudeDegrees + tile.verticalFieldOfViewDegrees / 2,
      ),
    ),
  );
  return createSkyViewport({
    centerAltitudeDegrees:
      (minimumAltitudeDegrees + maximumAltitudeDegrees) / 2,
    centerAzimuthDegrees:
      coveredSpanDegrees <= MAXIMUM_INITIAL_EDITOR_SPAN_DEGREES
        ? fittedCenterAzimuthDegrees
        : normalizeAzimuthDegrees(tiles[0]!.centerAzimuthDegrees),
    horizontalSpanDegrees: Math.min(
      MAXIMUM_INITIAL_EDITOR_SPAN_DEGREES,
      Math.max(80, coveredSpanDegrees * 1.12),
    ),
  });
};

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
