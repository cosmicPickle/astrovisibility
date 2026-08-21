import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Image as SvgImage, Polyline } from 'react-native-svg';

import { AppText } from '../components/ui/AppText';
import {
  createPanoramaEditorViewport,
  projectPanoramaTilesToViewport,
} from '../sky/panoramaOverlayGeometry';
import {
  applySkyPan,
  applySkyZoom,
  constrainSkyViewport,
  getVerticalSpanDegrees,
  type SkyViewport,
} from '../sky/skyViewport';
import { colors } from '../theme/tokens';
import type { MaskEditorCanvasProps } from './MaskEditorScreen';
import { MaskOverlayLayer } from './MaskOverlayLayer';
import type { AngularPointDegrees } from './visibilityMask';

export function MaskEditorCanvas({
  activeTool,
  brushRadiusDegrees,
  mask,
  onCommitPolygon,
  onCommitStroke,
  panorama,
  showMaskPreview,
}: MaskEditorCanvasProps) {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [viewport, setViewport] = useState<SkyViewport>(() =>
    createPanoramaEditorViewport(panorama.tiles),
  );
  const [draftPolygon, setDraftPolygon] = useState<AngularPointDegrees[]>([]);
  const strokePoints = useSharedValue<AngularPointDegrees[]>([]);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const gestureScale = useSharedValue(1);
  const gestureFocalX = useSharedValue(0);
  const gestureFocalY = useSharedValue(0);

  const directionAt = useCallback(
    (xPixels: number, yPixels: number): AngularPointDegrees => {
      const constrained = constrainSkyViewport(viewport, canvas);
      const verticalSpan = getVerticalSpanDegrees(constrained, canvas);
      return {
        azimuthDegrees:
          constrained.centerAzimuthDegrees +
          (xPixels / canvas.widthPixels - 0.5) *
            constrained.horizontalSpanDegrees,
        altitudeDegrees: Math.max(
          0,
          Math.min(
            90,
            constrained.centerAltitudeDegrees +
              (0.5 - yPixels / canvas.heightPixels) * verticalSpan,
          ),
        ),
      };
    },
    [canvas, viewport],
  );
  const appendPolygonPoint = useCallback(
    (xPixels: number, yPixels: number) =>
      setDraftPolygon((current) => [...current, directionAt(xPixels, yPixels)]),
    [directionAt],
  );
  const commitPan = useCallback(
    (xPixels: number, yPixels: number) =>
      setViewport((current) =>
        applySkyPan(current, canvas, {
          translationXPixels: xPixels,
          translationYPixels: yPixels,
        }),
      ),
    [canvas],
  );
  const commitZoom = useCallback(
    (scale: number, xPixels: number, yPixels: number) =>
      setViewport((current) =>
        applySkyZoom(current, canvas, {
          focalXPixels: xPixels,
          focalYPixels: yPixels,
          scale,
        }),
      ),
    [canvas],
  );

  const tap = Gesture.Tap()
    .enabled(activeTool === 'visiblePolygon')
    .onEnd((event) => runOnJS(appendPolygonPoint)(event.x, event.y));
  const pan = Gesture.Pan()
    .enabled(activeTool !== 'visiblePolygon')
    .maxPointers(1)
    .onBegin((event) => {
      if (activeTool !== 'pan' && activeTool !== 'visiblePolygon') {
        const verticalSpanDegrees = Math.min(
          90,
          viewport.horizontalSpanDegrees *
            (canvas.heightPixels / canvas.widthPixels),
        );
        strokePoints.value = [
          {
            azimuthDegrees:
              viewport.centerAzimuthDegrees +
              (event.x / canvas.widthPixels - 0.5) *
                viewport.horizontalSpanDegrees,
            altitudeDegrees: Math.max(
              0,
              Math.min(
                90,
                viewport.centerAltitudeDegrees +
                  (0.5 - event.y / canvas.heightPixels) * verticalSpanDegrees,
              ),
            ),
          },
        ];
      }
    })
    .onUpdate((event) => {
      if (activeTool === 'pan') {
        translationX.value = event.translationX;
        translationY.value = event.translationY;
      } else if (activeTool !== 'visiblePolygon') {
        if (strokePoints.value.length < 10_000) {
          const verticalSpanDegrees = Math.min(
            90,
            viewport.horizontalSpanDegrees *
              (canvas.heightPixels / canvas.widthPixels),
          );
          strokePoints.value = [
            ...strokePoints.value,
            {
              azimuthDegrees:
                viewport.centerAzimuthDegrees +
                (event.x / canvas.widthPixels - 0.5) *
                  viewport.horizontalSpanDegrees,
              altitudeDegrees: Math.max(
                0,
                Math.min(
                  90,
                  viewport.centerAltitudeDegrees +
                    (0.5 - event.y / canvas.heightPixels) * verticalSpanDegrees,
                ),
              ),
            },
          ];
        }
      }
    })
    .onEnd((event) => {
      if (activeTool === 'pan') {
        runOnJS(commitPan)(event.translationX, event.translationY);
      } else if (activeTool !== 'visiblePolygon') {
        if (strokePoints.value.length > 0) {
          runOnJS(onCommitStroke)(strokePoints.value);
        }
        strokePoints.value = [];
      }
    })
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
  const gesture = Gesture.Simultaneous(tap, pan, pinch);
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
  const panoramaTiles = useMemo(
    () => projectPanoramaTilesToViewport(panorama.tiles, viewport, canvas),
    [canvas, panorama.tiles, viewport],
  );
  const projectedDraft = draftPolygon.map((point) => {
    const constrained = constrainSkyViewport(viewport, canvas);
    const verticalSpan = getVerticalSpanDegrees(constrained, canvas);
    const delta =
      ((((point.azimuthDegrees - constrained.centerAzimuthDegrees) % 360) +
        540) %
        360) -
      180;
    return {
      xPixels:
        (0.5 + delta / constrained.horizontalSpanDegrees) * canvas.widthPixels,
      yPixels:
        (0.5 -
          (point.altitudeDegrees - constrained.centerAltitudeDegrees) /
            verticalSpan) *
        canvas.heightPixels,
    };
  });
  const brushRadiusPixels =
    (brushRadiusDegrees / viewport.horizontalSpanDegrees) * canvas.widthPixels;
  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && width > 0)
      setCanvas({ heightPixels: height, widthPixels: width });
  };

  return (
    <View
      accessibilityLabel="Mask drawing canvas"
      onLayout={handleLayout}
      style={styles.container}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Svg height="100%" width="100%">
            {panoramaTiles.map((tile) => (
              <SvgImage
                height={tile.heightPixels}
                href={{ uri: tile.uri }}
                key={tile.key}
                opacity={1}
                preserveAspectRatio="xMidYMid slice"
                transform={`rotate(${tile.rotationDegrees} ${tile.centerXPixels} ${tile.centerYPixels})`}
                width={tile.widthPixels}
                x={tile.centerXPixels - tile.widthPixels / 2}
                y={tile.centerYPixels - tile.heightPixels / 2}
              />
            ))}
            {showMaskPreview ? (
              <MaskOverlayLayer
                canvas={canvas}
                mask={mask}
                opacityPercent={70}
                viewport={viewport}
              />
            ) : null}
            {projectedDraft.length > 0 ? (
              <Polyline
                fill="rgba(91,156,255,0.15)"
                points={projectedDraft
                  .map(({ xPixels, yPixels }) => `${xPixels},${yPixels}`)
                  .join(' ')}
                stroke={colors.primary}
                strokeDasharray="5 4"
                strokeWidth={2}
              />
            ) : null}
            {activeTool === 'blockedStroke' ||
            activeTool === 'visibleStroke' ? (
              <Circle
                cx={26 + brushRadiusPixels}
                cy={26 + brushRadiusPixels}
                fill="transparent"
                r={Math.max(2, brushRadiusPixels)}
                stroke={
                  activeTool === 'visibleStroke'
                    ? colors.primary
                    : colors.blocked
                }
                strokeDasharray={
                  activeTool === 'blockedStroke' ? '4 3' : undefined
                }
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        </Animated.View>
      </GestureDetector>
      {activeTool === 'visiblePolygon' && draftPolygon.length >= 3 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onCommitPolygon(draftPolygon);
            setDraftPolygon([]);
          }}
          style={styles.closeRegion}
        >
          <AppText style={styles.closeRegionText}>Close region</AppText>
        </Pressable>
      ) : null}
      {activeTool === 'visiblePolygon' && draftPolygon.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setDraftPolygon([])}
          style={styles.cancelRegion}
        >
          <AppText style={styles.cancelRegionText}>Cancel region</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  cancelRegion: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: 8,
    borderWidth: 1,
    bottom: 12,
    justifyContent: 'center',
    left: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    position: 'absolute',
  },
  cancelRegionText: { color: colors.text, fontWeight: '700' },
  closeRegion: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    bottom: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 12,
    justifyContent: 'center',
  },
  closeRegionText: { color: colors.onPrimary, fontWeight: '800' },
  container: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderWidth: 1,
    flex: 1,
    minHeight: 300,
    overflow: 'hidden',
  },
});
