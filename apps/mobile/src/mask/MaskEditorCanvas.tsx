import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import {
  applyPanoramaEditorPan,
  applyPanoramaEditorZoom,
  createPanoramaEditorViewport,
  panoramaEditorPixelRadiusToDegrees,
  panoramaEditorPointToDirection,
  unprojectPanoramaEditorPoint,
  type PanoramaEditorViewport,
} from '../sky/panoramaOverlayGeometry';
import { colors } from '../theme/tokens';
import type { MaskEditorCanvasProps } from './MaskEditorScreen';
import { MaskOverlayLayer } from './MaskOverlayLayer';
import { PanoramaEditorLayer } from './PanoramaEditorLayer';
import type { AngularPointDegrees } from './visibilityMask';

type DraftStroke = Readonly<{
  angularRadiusDegrees: number;
  kind: MaskEditorCanvasProps['activeTool'];
  points: readonly AngularPointDegrees[];
}>;

export function MaskEditorCanvas({
  activeTool,
  brushDiameterPixels,
  mask,
  onCommitStroke,
  panorama,
}: MaskEditorCanvasProps) {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [viewport, setViewport] = useState<PanoramaEditorViewport>(() =>
    createPanoramaEditorViewport(panorama.tiles),
  );
  const [draftStroke, setDraftStroke] = useState<DraftStroke | null>(null);
  const strokePoints = useSharedValue<AngularPointDegrees[]>([]);
  const strokeRadiusDegrees = useSharedValue(0);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const gestureScale = useSharedValue(1);
  const gestureFocalX = useSharedValue(0);
  const gestureFocalY = useSharedValue(0);

  const updateDraftStroke = useCallback(
    (points: readonly AngularPointDegrees[], angularRadiusDegrees: number) =>
      setDraftStroke({ angularRadiusDegrees, kind: activeTool, points }),
    [activeTool],
  );
  const finishStroke = useCallback(
    (points: readonly AngularPointDegrees[], angularRadiusDegrees: number) => {
      setDraftStroke(null);
      if (points.length > 0) onCommitStroke(points, angularRadiusDegrees);
    },
    [onCommitStroke],
  );
  const clearDraftStroke = useCallback(() => setDraftStroke(null), []);
  const commitPan = useCallback(
    (xPixels: number, yPixels: number) =>
      setViewport((current) =>
        applyPanoramaEditorPan(current, canvas, {
          translationXPixels: xPixels,
          translationYPixels: yPixels,
        }),
      ),
    [canvas],
  );
  const commitZoom = useCallback(
    (scale: number, xPixels: number, yPixels: number) =>
      setViewport((current) =>
        applyPanoramaEditorZoom(current, canvas, {
          focalXPixels: xPixels,
          focalYPixels: yPixels,
          scale,
        }),
      ),
    [canvas],
  );

  const stroke = Gesture.Pan()
    .maxPointers(1)
    .onBegin((event) => {
      const point = panoramaEditorPointToDirection(
        unprojectPanoramaEditorPoint(
          { xPixels: event.x, yPixels: event.y },
          viewport,
          canvas,
        ),
      );
      if (!point) {
        strokePoints.value = [];
        runOnJS(clearDraftStroke)();
        return;
      }
      const angularRadiusDegrees = panoramaEditorPixelRadiusToDegrees(
        brushDiameterPixels / 2,
        viewport,
        canvas,
      );
      strokePoints.value = [point];
      strokeRadiusDegrees.value = angularRadiusDegrees;
      runOnJS(updateDraftStroke)([point], angularRadiusDegrees);
    })
    .onUpdate((event) => {
      if (
        strokePoints.value.length === 0 ||
        strokePoints.value.length >= 10_000
      ) {
        return;
      }
      const point = panoramaEditorPointToDirection(
        unprojectPanoramaEditorPoint(
          { xPixels: event.x, yPixels: event.y },
          viewport,
          canvas,
        ),
      );
      if (!point) return;
      const previous = strokePoints.value[strokePoints.value.length - 1]!;
      const minimumSampleDistanceDegrees = panoramaEditorPixelRadiusToDegrees(
        2,
        viewport,
        canvas,
      );
      if (
        Math.hypot(
          point.azimuthDegrees - previous.azimuthDegrees,
          point.altitudeDegrees - previous.altitudeDegrees,
        ) < minimumSampleDistanceDegrees
      ) {
        return;
      }
      strokePoints.value = [...strokePoints.value, point];
      runOnJS(updateDraftStroke)(strokePoints.value, strokeRadiusDegrees.value);
    })
    .onEnd(() => {
      runOnJS(finishStroke)(strokePoints.value, strokeRadiusDegrees.value);
      strokePoints.value = [];
    })
    .onFinalize((_event, success) => {
      if (!success) runOnJS(clearDraftStroke)();
      strokePoints.value = [];
    });
  const navigationPan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((event) => {
      translationX.value = event.translationX;
      translationY.value = event.translationY;
    })
    .onEnd((event) =>
      runOnJS(commitPan)(event.translationX, event.translationY),
    )
    .onFinalize(() => {
      translationX.value = 0;
      translationY.value = 0;
    });
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      gestureScale.value = event.scale;
      gestureFocalX.value = event.focalX;
      gestureFocalY.value = event.focalY;
    })
    .onEnd((event) =>
      runOnJS(commitZoom)(event.scale, event.focalX, event.focalY),
    )
    .onFinalize(() => {
      gestureScale.value = 1;
    });
  const gesture = Gesture.Simultaneous(stroke, navigationPan, pinch);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      {
        translateX:
          (1 - gestureScale.value) *
          (gestureFocalX.value - canvas.widthPixels / 2),
      },
      {
        translateY:
          (1 - gestureScale.value) *
          (gestureFocalY.value - canvas.heightPixels / 2),
      },
      { scale: gestureScale.value },
    ],
  }));
  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && width > 0) {
      setCanvas({ heightPixels: height, widthPixels: width });
    }
  };

  return (
    <View
      accessibilityLabel="Mask drawing canvas"
      onLayout={handleLayout}
      style={styles.container}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <PanoramaEditorLayer
            canvas={canvas}
            tiles={panorama.tiles}
            viewport={viewport}
          />
          <Svg height="100%" pointerEvents="none" width="100%">
            <MaskOverlayLayer
              canvas={canvas}
              draftStroke={draftStroke}
              mask={mask}
              opacityPercent={76}
              viewport={viewport}
            />
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  container: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderWidth: 1,
    flex: 1,
    minHeight: 180,
    overflow: 'hidden',
  },
});
