import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { CubeBackgroundLayer } from '../sky/CubeBackgroundLayer';
import {
  applyPlanetariumPan,
  applyPlanetariumZoom,
  createPlanetariumCamera,
  projectVectorToCanvas,
  unprojectCanvasPoint,
  vectorToHorizontalDirection,
  type PlanetariumCamera,
} from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import { projectWindowPoint } from './windowProjection';
import {
  createInitialWindow,
  createWindowGeometry,
  moveWindowCorner,
  type WindowDefinition,
} from './windowGeometry';

export interface WindowEditorCanvasProps {
  definition: WindowDefinition;
  panorama: ActivePanorama;
  enabled: boolean;
  resetVersion: number;
  onChange(definition: WindowDefinition): void;
  onError(message: string): void;
}

function Corner({
  index,
  draft,
  camera,
  canvas,
}: {
  index: number;
  draft: SharedValue<WindowDefinition>;
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
}) {
  const point = useDerivedValue(() =>
    projectVectorToCanvas(
      createWindowGeometry(draft.value).corners[index]!,
      camera.value,
      canvas,
    ),
  );
  const x = useDerivedValue(() => point.value.xPixels);
  const y = useDerivedValue(() => point.value.yPixels);
  return (
    <>
      <Circle cx={x} cy={y} r={10} color={colors.background} />
      <Circle cx={x} cy={y} r={8} color={colors.primary} />
      <Circle cx={x} cy={y} r={3} color={colors.text} />
    </>
  );
}

export function WindowEditorCanvas({
  definition,
  panorama,
  enabled,
  resetVersion,
  onChange,
  onError,
}: WindowEditorCanvasProps) {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [initialCamera] = useState(() => {
    const geometry = createWindowGeometry(definition);
    const corners = geometry.corners;
    const span =
      (definition.rightAzimuthDegrees - definition.leftAzimuthDegrees + 360) %
      360;
    // A wide opening's geometric midpoint can be at/behind the observer.
    // Keep the camera on its outward side when reopening a sill definition.
    const direction = vectorToHorizontalDirection(
      geometry.distanceMeters <= definition.widthMeters / 4
        ? geometry.normal
        : {
            x: corners[0]!.x + corners[2]!.x,
            y: corners[0]!.y + corners[2]!.y,
            z: corners[0]!.z + corners[2]!.z,
          },
    );
    return createPlanetariumCamera({
      centerAzimuthDegrees: direction.azimuthDegrees,
      centerAltitudeDegrees: direction.altitudeDegrees,
      fieldOfViewDegrees: Math.max(85, Math.min(235, span + 30)),
    });
  });
  const camera = useSharedValue(initialCamera);
  const zoomStart = useSharedValue(initialCamera);
  const draft = useSharedValue(definition);
  const selectedCorner = useSharedValue(-1);
  const previous = useSharedValue({ xPixels: 0, yPixels: 0 });
  const invalidDrag = useSharedValue(false);
  useEffect(() => {
    draft.set(definition);
  }, [definition, draft]);
  useEffect(() => {
    if (!resetVersion) return;
    const next = {
      ...createInitialWindow(vectorToHorizontalDirection(camera.get().forward)),
      widthMeters: draft.get().widthMeters,
    };
    draft.set(next);
    onChange(next);
    // Reset is an explicit command; changing the draft must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetVersion]);
  const pan = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .minDistance(0)
    .onBegin((event) => {
      previous.set({ xPixels: event.x, yPixels: event.y });
      invalidDrag.set(false);
      const points = createWindowGeometry(draft.get()).corners.map((corner) =>
        projectVectorToCanvas(corner, camera.get(), canvas),
      );
      selectedCorner.set(
        points.findIndex(
          (point) =>
            point.visible &&
            Math.hypot(point.xPixels - event.x, point.yPixels - event.y) <= 26,
        ),
      );
    })
    .onUpdate((event) => {
      const point = { xPixels: event.x, yPixels: event.y };
      if (selectedCorner.get() >= 0) {
        const direction = unprojectCanvasPoint(point, camera.get(), canvas);
        if (direction) {
          try {
            draft.set(
              moveWindowCorner(draft.get(), selectedCorner.get(), direction),
            );
            invalidDrag.set(false);
          } catch {
            invalidDrag.set(true);
          }
        }
      } else
        camera.set(
          applyPlanetariumPan(camera.get(), canvas, previous.get(), point),
        );
      previous.set(point);
    })
    .onFinalize(() => {
      if (selectedCorner.get() >= 0) runOnJS(onChange)(draft.get());
      if (invalidDrag.get())
        runOnJS(onError)('Keep the corners in a valid upright rectangle.');
      selectedCorner.set(-1);
    });
  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart(() => {
      zoomStart.set(camera.get());
      selectedCorner.set(-1);
    })
    .onUpdate((event) => {
      camera.set(applyPlanetariumZoom(zoomStart.get(), event.scale));
    });
  const outline = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const corners = createWindowGeometry(draft.value).corners;
    for (let edge = 0; edge < 4; edge += 1) {
      const start = corners[edge]!;
      const end = corners[(edge + 1) % 4]!;
      let connected = false;
      for (let step = 0; step <= 32; step += 1) {
        const ratio = step / 32;
        const point = projectWindowPoint(
          {
            x: start.x + (end.x - start.x) * ratio,
            y: start.y + (end.y - start.y) * ratio,
            z: start.z + (end.z - start.z) * ratio,
          },
          camera.value,
          canvas,
        );
        if (point?.visible) {
          if (connected) path.lineTo(point.xPixels, point.yPixels);
          else path.moveTo(point.xPixels, point.yPixels);
          connected = true;
        } else connected = false;
      }
    }
    return path;
  });
  return (
    <View
      style={styles.container}
      accessibilityLabel="Window corners on spherical panorama. Drag a corner to resize; drag elsewhere to look; pinch to zoom."
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0)
          setCanvas({ widthPixels: width, heightPixels: height });
      }}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <View collapsable={false} style={styles.container}>
          <Canvas style={styles.container}>
            <CubeBackgroundLayer
              camera={camera}
              canvas={canvas}
              source={panorama.uri}
            />
            <Path
              path={outline}
              color={colors.primary}
              style="stroke"
              strokeWidth={2}
            />
            {[0, 1, 2, 3].map((index) => (
              <Corner
                key={index}
                index={index}
                draft={draft}
                camera={camera}
                canvas={canvas}
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.backdrop,
  },
});
