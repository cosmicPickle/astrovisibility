import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  projectJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
  type UnitVector3,
} from '../astronomy/celestialTimeTransform';
import type { ImagingFrameSettings } from '../astronomy/imagingFrame';
import {
  lensPositionMeters,
  type WindowGeometry,
} from '../window/windowGeometry';
import {
  vectorToHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import { projectWindowPoint } from '../window/windowProjection';
import type { CanvasSizePixels } from './projection';
import { colors } from '../theme/tokens';

/** Outline the opening from the selected target's current lens position. The
 * photographic overlay remains at its capture viewpoint, with explanatory copy
 * in its controls. Drawing never changes the authoritative geometric window. */
export function WindowBoundaryLayer({
  camera,
  canvas,
  geometry,
  settings,
  target,
  sceneTimeMilliseconds,
  timeTransform,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  geometry: WindowGeometry;
  settings: ImagingFrameSettings | null;
  target?: UnitVector3;
  sceneTimeMilliseconds?: SharedValue<number>;
  timeTransform?: CelestialTimeTransform;
}) {
  const path = useDerivedValue(() => {
    const direction =
      target && timeTransform && sceneTimeMilliseconds
        ? vectorToHorizontalDirection(
            projectJ2000ToObservedHorizontalVector(
              target,
              timeTransform,
              sceneTimeMilliseconds.value,
            ),
          )
        : null;
    const lens =
      direction && settings && timeTransform
        ? lensPositionMeters(
            direction,
            settings.lensOffsetMillimeters ?? 0,
            settings.trackingMode,
            (Math.asin(timeTransform.sinObserverLatitude) * 180) / Math.PI,
          )
        : { x: 0, y: 0, z: 0 };
    const builder = Skia.PathBuilder.Make();
    for (let edge = 0; edge < 4; edge += 1) {
      const start = geometry.corners[edge]!;
      const end = geometry.corners[(edge + 1) % 4]!;
      let connected = false;
      for (let step = 0; step <= 32; step += 1) {
        const ratio = step / 32;
        const point = projectWindowPoint(
          {
            x: start.x + (end.x - start.x) * ratio - lens.x,
            y: start.y + (end.y - start.y) * ratio - lens.y,
            z: start.z + (end.z - start.z) * ratio - lens.z,
          },
          camera.value,
          canvas,
        );
        if (point?.visible) {
          if (connected) builder.lineTo(point.xPixels, point.yPixels);
          else builder.moveTo(point.xPixels, point.yPixels);
        }
        connected = Boolean(point?.visible);
      }
    }
    return builder.build();
  });
  return (
    <Path path={path} color={colors.warning} strokeWidth={2} style="stroke" />
  );
}
