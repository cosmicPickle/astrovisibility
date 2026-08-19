import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { CanvasSizePixels } from './projection';
import {
  applyPlanetariumGesture,
  type PlanetariumCamera,
} from './planetariumProjection';

export function usePlanetariumNavigation({
  cameraState,
  canvas,
  onCameraCommit,
  onManualNavigation,
  onTap,
}: {
  cameraState: PlanetariumCamera;
  canvas: CanvasSizePixels;
  onCameraCommit: (camera: PlanetariumCamera) => void;
  onManualNavigation: () => void;
  onTap: (xPixels: number, yPixels: number, camera: PlanetariumCamera) => void;
}) {
  const camera = useSharedValue(cameraState);
  const panBaseline = useSharedValue(cameraState);
  const panStartX = useSharedValue(canvas.widthPixels / 2);
  const panStartY = useSharedValue(canvas.heightPixels / 2);
  const panCurrentX = useSharedValue(canvas.widthPixels / 2);
  const panCurrentY = useSharedValue(canvas.heightPixels / 2);
  const pinchActive = useSharedValue(false);
  const pinchBaseline = useSharedValue(cameraState);
  const pinchStartX = useSharedValue(canvas.widthPixels / 2);
  const pinchStartY = useSharedValue(canvas.heightPixels / 2);

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
        panBaseline.set(camera.get());
        panStartX.set(event.x);
        panStartY.set(event.y);
        panCurrentX.set(event.x);
        panCurrentY.set(event.y);
        runOnJS(onManualNavigation)();
      })
      .onUpdate((event) => {
        panCurrentX.set(event.x);
        panCurrentY.set(event.y);
        if (pinchActive.get()) return;
        camera.set(
          applyPlanetariumGesture(panBaseline.get(), canvas, {
            currentFocalXPixels: event.x,
            currentFocalYPixels: event.y,
            scale: 1,
            startFocalXPixels: panStartX.get(),
            startFocalYPixels: panStartY.get(),
          }),
        );
      })
      .onEnd(() => {
        if (!pinchActive.get()) runOnJS(commitCamera)(camera.get());
      })
      .onFinalize(() => {
        if (!pinchActive.get()) runOnJS(commitCamera)(camera.get());
      });

    const pinch = Gesture.Pinch()
      .withTestId('sky-pinch')
      .onStart((event) => {
        pinchActive.set(true);
        pinchBaseline.set(camera.get());
        pinchStartX.set(event.focalX);
        pinchStartY.set(event.focalY);
        runOnJS(onManualNavigation)();
      })
      .onUpdate((event) => {
        camera.set(
          applyPlanetariumGesture(pinchBaseline.get(), canvas, {
            currentFocalXPixels: event.focalX,
            currentFocalYPixels: event.focalY,
            scale: event.scale,
            startFocalXPixels: pinchStartX.get(),
            startFocalYPixels: pinchStartY.get(),
          }),
        );
      })
      .onEnd(() => {
        runOnJS(commitCamera)(camera.get());
      })
      .onFinalize(() => {
        pinchActive.set(false);
        panBaseline.set(camera.get());
        panStartX.set(panCurrentX.get());
        panStartY.set(panCurrentY.get());
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
    onManualNavigation,
    onTap,
    panBaseline,
    panCurrentX,
    panCurrentY,
    panStartX,
    panStartY,
    pinchActive,
    pinchBaseline,
    pinchStartX,
    pinchStartY,
  ]);

  return { camera, gesture };
}
