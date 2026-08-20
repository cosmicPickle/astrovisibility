import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { CanvasSizePixels } from './projection';
import {
  applyPlanetariumPan,
  applyPlanetariumZoom,
  type PlanetariumCamera,
} from './planetariumProjection';

const CAMERA_PREVIEW_UPDATE_INTERVAL = 1;

export function usePlanetariumNavigation({
  cameraState,
  canvas,
  onCameraCommit,
  onCameraPreview,
  onTap,
}: {
  cameraState: PlanetariumCamera;
  canvas: CanvasSizePixels;
  onCameraCommit: (camera: PlanetariumCamera) => void;
  onCameraPreview?: (camera: PlanetariumCamera) => void;
  onTap: (xPixels: number, yPixels: number, camera: PlanetariumCamera) => void;
}) {
  const camera = useSharedValue(cameraState);
  const panBaseline = useSharedValue(cameraState);
  const panStartX = useSharedValue(canvas.widthPixels / 2);
  const panStartY = useSharedValue(canvas.heightPixels / 2);
  const pinchActive = useSharedValue(false);
  const panSuppressedAfterPinch = useSharedValue(false);
  const panCommitted = useSharedValue(false);
  const pinchBaseline = useSharedValue(cameraState);
  const pinchCommitted = useSharedValue(false);
  const previewUpdateCount = useSharedValue(0);
  useEffect(() => {
    camera.set(cameraState);
  }, [camera, cameraState]);

  const commitCamera = useCallback(
    (nextCamera: PlanetariumCamera) => onCameraCommit(nextCamera),
    [onCameraCommit],
  );
  const previewCamera = useCallback(
    (nextCamera: PlanetariumCamera) => {
      onCameraPreview?.(nextCamera);
    },
    [onCameraPreview],
  );
  const handleTap = useCallback(
    (xPixels: number, yPixels: number, tapCamera: PlanetariumCamera) => {
      onTap(xPixels, yPixels, tapCamera);
    },
    [onTap],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .withTestId('sky-pan')
      .maxPointers(1)
      .minDistance(4)
      .onStart((event) => {
        if (pinchActive.get()) {
          panSuppressedAfterPinch.set(true);
          return;
        }
        panSuppressedAfterPinch.set(false);
        panCommitted.set(false);
        panBaseline.set(camera.get());
        panStartX.set(event.x);
        panStartY.set(event.y);
        previewUpdateCount.set(CAMERA_PREVIEW_UPDATE_INTERVAL - 1);
      })
      .onUpdate((event) => {
        if (pinchActive.get() || panSuppressedAfterPinch.get()) return;
        const nextCamera = applyPlanetariumPan(
          panBaseline.get(),
          canvas,
          {
            xPixels: panStartX.get(),
            yPixels: panStartY.get(),
          },
          { xPixels: event.x, yPixels: event.y },
        );
        camera.set(nextCamera);
        const updateCount = previewUpdateCount.get() + 1;
        previewUpdateCount.set(updateCount);
        if (updateCount >= CAMERA_PREVIEW_UPDATE_INTERVAL) {
          previewUpdateCount.set(0);
          runOnJS(previewCamera)(nextCamera);
        }
      })
      .onEnd(() => {
        if (!pinchActive.get() && !panSuppressedAfterPinch.get()) {
          panCommitted.set(true);
          const finalCamera = camera.get();
          runOnJS(previewCamera)(finalCamera);
          runOnJS(commitCamera)(finalCamera);
        }
      })
      .onFinalize(() => {
        if (
          !panCommitted.get() &&
          !pinchActive.get() &&
          !panSuppressedAfterPinch.get()
        ) {
          panCommitted.set(true);
          const finalCamera = camera.get();
          runOnJS(previewCamera)(finalCamera);
          runOnJS(commitCamera)(finalCamera);
        }
      });

    const pinch = Gesture.Pinch()
      .withTestId('sky-pinch')
      .onStart(() => {
        pinchActive.set(true);
        panSuppressedAfterPinch.set(true);
        pinchCommitted.set(false);
        pinchBaseline.set(camera.get());
        previewUpdateCount.set(CAMERA_PREVIEW_UPDATE_INTERVAL - 1);
      })
      .onUpdate((event) => {
        const nextCamera = applyPlanetariumZoom(
          pinchBaseline.get(),
          event.scale,
        );
        camera.set(nextCamera);
        const updateCount = previewUpdateCount.get() + 1;
        previewUpdateCount.set(updateCount);
        if (updateCount >= CAMERA_PREVIEW_UPDATE_INTERVAL) {
          previewUpdateCount.set(0);
          runOnJS(previewCamera)(nextCamera);
        }
      })
      .onEnd(() => {
        pinchCommitted.set(true);
        const finalCamera = camera.get();
        runOnJS(previewCamera)(finalCamera);
        runOnJS(commitCamera)(finalCamera);
      })
      .onFinalize(() => {
        pinchActive.set(false);
        if (!pinchCommitted.get()) {
          pinchCommitted.set(true);
          const finalCamera = camera.get();
          runOnJS(previewCamera)(finalCamera);
          runOnJS(commitCamera)(finalCamera);
        }
      });

    const tap = Gesture.Tap()
      .withTestId('sky-tap')
      .maxDistance(8)
      .onEnd((event, succeeded) => {
        if (succeeded) runOnJS(handleTap)(event.x, event.y, camera.get());
      });

    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
  }, [
    camera,
    canvas,
    commitCamera,
    handleTap,
    panBaseline,
    panSuppressedAfterPinch,
    panStartX,
    panStartY,
    panCommitted,
    pinchActive,
    pinchBaseline,
    pinchCommitted,
    previewCamera,
    previewUpdateCount,
  ]);

  return { camera, gesture };
}
