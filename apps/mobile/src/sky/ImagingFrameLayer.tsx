import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  createImagingFrame,
  type ImagingFrameSettings,
} from '../astronomy/imagingFrame';
import {
  projectJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
  type UnitVector3,
} from '../astronomy/celestialTimeTransform';
import { colors } from '../theme/tokens';
import {
  projectVectorToCanvas,
  vectorToHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { CanvasSizePixels } from './projection';

/** Shows the same target-centered physical footprint used by classification.
 * All scene-time and camera changes stay on the existing UI worklet path.
 */
export function ImagingFrameLayer({
  camera,
  canvas,
  settings,
  target,
  sceneTimeMilliseconds,
  timeTransform,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  settings: ImagingFrameSettings;
  target: UnitVector3;
  sceneTimeMilliseconds: SharedValue<number>;
  timeTransform: CelestialTimeTransform;
}) {
  const path = useDerivedValue(() => {
    const direction = vectorToHorizontalDirection(
      projectJ2000ToObservedHorizontalVector(
        target,
        timeTransform,
        sceneTimeMilliseconds.value,
      ),
    );
    const frame = createImagingFrame({
      ...settings,
      horizontal: {
        azimuthDegreesClockwiseFromNorth: direction.azimuthDegrees,
        refractedAltitudeDegrees: direction.altitudeDegrees,
      },
      observerLatitudeDegrees:
        (Math.asin(timeTransform.sinObserverLatitude) * 180) / Math.PI,
    });
    const builder = Skia.PathBuilder.Make();
    // Sample each great-circle edge. The bounded 128 segments preserve curved
    // projection edges while keeping navigation independent of mask complexity.
    let previousVisible = false;
    for (let edge = 0; edge < 4; edge += 1) {
      const start = frame.corners[edge]!;
      const end = frame.corners[(edge + 1) % 4]!;
      for (let step = 0; step <= 32; step += 1) {
        const ratio = step / 32;
        const point = projectVectorToCanvas(
          {
            x: start.x + (end.x - start.x) * ratio,
            y: start.y + (end.y - start.y) * ratio,
            z: start.z + (end.z - start.z) * ratio,
          },
          camera.value,
          canvas,
        );
        if (point.visible) {
          if (previousVisible) builder.lineTo(point.xPixels, point.yPixels);
          else builder.moveTo(point.xPixels, point.yPixels);
        }
        previousVisible = point.visible;
      }
    }
    return builder.build();
  });
  return (
    <Path color={colors.primary} path={path} strokeWidth={2} style="stroke" />
  );
}
