import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { AppText } from '../components/ui/AppText';
import { CubeBackgroundLayer } from '../sky/CubeBackgroundLayer';
import { createPlanetariumCamera } from '../sky/planetariumProjection';
import { colors } from '../theme/tokens';
import type { MaskEditorCanvasProps } from './MaskEditorScreen';
import type { MaskBrushStroke } from './maskBrushSelection';
import { useMaskBrushSession } from './useMaskBrushSession';
import {
  createMaskTouchState,
  updateMaskTouches,
  remainingMaskTouches,
  type MaskTouchState,
} from './maskEditorTouch';
import { MaskEditorOverlay } from './MaskEditorOverlay';

export function MaskEditorCanvas({
  activeTool,
  brushDiameterPixels,
  blockedBitset,
  enabled,
  paintMode,
  onCommitSelection,
  onProcessingChange,
  panorama,
}: MaskEditorCanvasProps) {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const { apply, processing, error } = useMaskBrushSession(
    panorama,
    onCommitSelection,
    onProcessingChange,
  );
  const busy = useSharedValue(false);
  const initial = panorama.tiles[0];
  const touchState = useSharedValue(
    createMaskTouchState(
      createPlanetariumCamera({
        centerAltitudeDegrees: initial?.centerAltitudeDegrees ?? 45,
        centerAzimuthDegrees: initial?.centerAzimuthDegrees ?? 0,
        fieldOfViewDegrees: Math.max(
          60,
          Math.min(110, (initial?.horizontalFieldOfViewDegrees ?? 80) * 1.2),
        ),
      }),
    ),
  );
  const brush = useSharedValue({
    draw: activeTool === 'blockedStroke',
    diameter: brushDiameterPixels,
  });
  const mode = useSharedValue(paintMode);
  const camera = useDerivedValue(() => touchState.value.camera);

  const commit = useCallback(
    async (
      finished: MaskTouchState,
      context: { draw: boolean; diameter: number },
      selectedMode: MaskBrushStroke['mode'],
    ) => {
      try {
        if (finished.completed?.length)
          await apply(
            {
              camera: finished.camera,
              canvas,
              points: finished.completed,
              brushDiameterPixels: context.diameter,
              mode: selectedMode,
            },
            context.draw,
          );
      } finally {
        touchState.set(createMaskTouchState(finished.camera));
        busy.set(false);
      }
    },
    [apply, busy, canvas, touchState],
  );

  const gesture = Gesture.Manual()
    .withTestId('mask-touch')
    .enabled(enabled)
    .onTouchesDown((event, manager) => {
      if (busy.get()) {
        manager.fail();
        return;
      }
      if (!touchState.get().active) {
        brush.set({
          draw: activeTool === 'blockedStroke',
          diameter: brushDiameterPixels,
        });
        mode.set(paintMode);
      }
      manager.activate();
      touchState.set(
        updateMaskTouches(
          touchState.get(),
          'down',
          event.allTouches.map((p) => ({ xPixels: p.x, yPixels: p.y })),
          canvas,
        ),
      );
    })
    .onTouchesMove((event) => {
      if (!busy.get())
        touchState.set(
          updateMaskTouches(
            touchState.get(),
            'move',
            event.allTouches.map((p) => ({ xPixels: p.x, yPixels: p.y })),
            canvas,
          ),
        );
    })
    .onTouchesUp((event, manager) => {
      if (busy.get()) return;
      const finished = updateMaskTouches(
        touchState.get(),
        'up',
        remainingMaskTouches(event.allTouches, event.changedTouches),
        canvas,
      );
      if (finished.completed?.length) {
        busy.set(true);
        touchState.set({ ...finished, points: finished.completed });
        runOnJS(commit)(finished, brush.get(), mode.get());
      } else touchState.set(finished);
      if (event.numberOfTouches === 0) manager.end();
    })
    .onTouchesCancelled((_event, manager) => {
      if (!busy.get())
        touchState.set(createMaskTouchState(touchState.get().camera));
      manager.fail();
    })
    .onFinalize(() => {
      if (!busy.get())
        touchState.set(createMaskTouchState(touchState.get().camera));
    });

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
        <View style={styles.canvas} collapsable={false}>
          <Canvas style={styles.canvas}>
            <CubeBackgroundLayer
              camera={camera}
              canvas={canvas}
              source={panorama.uri}
            />
            {panorama.widthPixels &&
            panorama.heightPixels &&
            blockedBitset.length ? (
              <MaskEditorOverlay
                blockedBitset={blockedBitset}
                coverageBitset={panorama.coverageBitset!}
                width={panorama.widthPixels}
                height={panorama.heightPixels}
                canvas={canvas}
                touchState={touchState}
                brush={brush}
              />
            ) : null}
          </Canvas>
        </View>
      </GestureDetector>
      {processing || error ? (
        <View pointerEvents="none" style={styles.status}>
          <AppText>
            {processing
              ? paintMode === 'magic'
                ? 'Selecting object…'
                : 'Applying brush…'
              : error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  container: {
    backgroundColor: colors.backdrop,
    flex: 1,
    minHeight: 180,
    overflow: 'hidden',
  },
  status: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
});
