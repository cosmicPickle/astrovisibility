import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { CanvasSizePixels } from './projection';
import {
  applyPlanetariumAnchoredZoom,
  applyPlanetariumGesture,
  type PlanetariumCamera,
} from './planetariumProjection';

const CAMERA_PREVIEW_UPDATE_INTERVAL = 1;

export function usePlanetariumNavigation({
  cameraState,
  canvas,
  onCameraCommit,
  onCameraPreview,
  onManualNavigation,
  onTap,
}: {
  cameraState: PlanetariumCamera;
  canvas: CanvasSizePixels;
  onCameraCommit: (camera: PlanetariumCamera) => void;
  onCameraPreview: (camera: PlanetariumCamera) => void;
  onManualNavigation: () => void;
  onTap: (xPixels: number, yPixels: number, camera: PlanetariumCamera) => void;
}) {
  const camera = useSharedValue(cameraState);
  const panBaseline = useSharedValue(cameraState);
  const panStartX = useSharedValue(canvas.widthPixels / 2);
  const panStartY = useSharedValue(canvas.heightPixels / 2);
  const pinchActive = useSharedValue(false);
  const panSuppressedAfterPinch = useSharedValue(false);
  const pinchBaseline = useSharedValue(cameraState);
  const pinchStartX = useSharedValue(canvas.widthPixels / 2);
  const pinchStartY = useSharedValue(canvas.heightPixels / 2);
  const previewUpdateCount = useSharedValue(0);

  useEffect(() => {
    camera.set(cameraState);
  }, [camera, cameraState]);

  const commitCamera = useCallback(
    (nextCamera: PlanetariumCamera) => onCameraCommit(nextCamera),
    [onCameraCommit],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .withTestId('sky-pan')
      .minDistance(4)
      .onStart((event) => {
        if (pinchActive.get()) {
          panSuppressedAfterPinch.set(true);
          return;
        }
        panSuppressedAfterPinch.set(false);
        panBaseline.set(camera.get());
        panStartX.set(event.x);
        panStartY.set(event.y);
        previewUpdateCount.set(CAMERA_PREVIEW_UPDATE_INTERVAL - 1);
        runOnJS(onManualNavigation)();
      })
      .onUpdate((event) => {
        if (pinchActive.get() || panSuppressedAfterPinch.get()) return;
        const nextCamera = applyPlanetariumGesture(panBaseline.get(), canvas, {
          currentFocalXPixels: event.x,
          currentFocalYPixels: event.y,
          scale: 1,
          startFocalXPixels: panStartX.get(),
          startFocalYPixels: panStartY.get(),
        });
        camera.set(nextCamera);
        const updateCount = previewUpdateCount.get() + 1;
        previewUpdateCount.set(updateCount);
        if (updateCount >= CAMERA_PREVIEW_UPDATE_INTERVAL) {
          previewUpdateCount.set(0);
          runOnJS(onCameraPreview)(nextCamera);
        }
      })
      .onEnd(() => {
        if (!pinchActive.get() && !panSuppressedAfterPinch.get()) {
          runOnJS(commitCamera)(camera.get());
        }
      })
      .onFinalize(() => {
        if (!pinchActive.get() && !panSuppressedAfterPinch.get()) {
          runOnJS(commitCamera)(camera.get());
        }
      });

    const pinch = Gesture.Pinch()
      .withTestId('sky-pinch')
      .onStart((event) => {
        pinchActive.set(true);
        panSuppressedAfterPinch.set(true);
        pinchBaseline.set(camera.get());
        pinchStartX.set(event.focalX);
        pinchStartY.set(event.focalY);
        previewUpdateCount.set(CAMERA_PREVIEW_UPDATE_INTERVAL - 1);
        runOnJS(onManualNavigation)();
      })
      .onUpdate((event) => {
        const nextCamera = applyPlanetariumAnchoredZoom(
          pinchBaseline.get(),
          canvas,
          {
            xPixels: pinchStartX.get(),
            yPixels: pinchStartY.get(),
          },
          event.scale,
        );
        camera.set(nextCamera);
        const updateCount = previewUpdateCount.get() + 1;
        previewUpdateCount.set(updateCount);
        if (updateCount >= CAMERA_PREVIEW_UPDATE_INTERVAL) {
          previewUpdateCount.set(0);
          runOnJS(onCameraPreview)(nextCamera);
        }
      })
      .onEnd(() => {
        runOnJS(commitCamera)(camera.get());
      })
      .onFinalize(() => {
        pinchActive.set(false);
        runOnJS(commitCamera)(camera.get());
      });

    const tap = Gesture.Tap()
      .withTestId('sky-tap')
      .maxDistance(8)
      .onEnd((event, succeeded) => {
        if (succeeded) runOnJS(onTap)(event.x, event.y, camera.get());
      });

    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
  }, [
    camera,
    canvas,
    commitCamera,
    onCameraPreview,
    onManualNavigation,
    onTap,
    panBaseline,
    panSuppressedAfterPinch,
    panStartX,
    panStartY,
    pinchActive,
    pinchBaseline,
    pinchStartX,
    pinchStartY,
    previewUpdateCount,
  ]);

  return { camera, gesture };
}
