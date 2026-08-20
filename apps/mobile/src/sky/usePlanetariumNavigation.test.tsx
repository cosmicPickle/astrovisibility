import { act, render } from '@testing-library/react-native';

import {
  createPlanetariumCamera,
  projectHorizontalDirection,
  unprojectCanvasPoint,
  type PlanetariumCamera,
} from './planetariumProjection';
import { usePlanetariumNavigation } from './usePlanetariumNavigation';

type GestureHandler = (...parameters: unknown[]) => void;

const mockGestureHandlers: Record<string, GestureHandler> = {};

jest.mock('react-native-gesture-handler', () => {
  const builder = (kind: string) => {
    const chain: Record<string, (...parameters: unknown[]) => unknown> = {};
    for (const method of ['maxDistance', 'minDistance', 'withTestId']) {
      chain[method] = () => chain;
    }
    for (const method of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
      chain[method] = (handler: unknown) => {
        const gestureHandler = handler as GestureHandler;
        mockGestureHandlers[`${kind}-${method}`] = gestureHandler;
        return chain;
      };
    }
    return chain;
  };
  return {
    Gesture: {
      Exclusive: (...gestures: unknown[]) => gestures,
      Pan: () => builder('pan'),
      Pinch: () => builder('pinch'),
      Simultaneous: (...gestures: unknown[]) => gestures,
      Tap: () => builder('tap'),
    },
  };
});

const canvas = { widthPixels: 400, heightPixels: 800 };

const Harness = ({
  camera,
  onCameraCommit,
  onCameraPreview,
}: {
  camera: PlanetariumCamera;
  onCameraCommit: (nextCamera: PlanetariumCamera) => void;
  onCameraPreview: (nextCamera: PlanetariumCamera) => void;
}) => {
  usePlanetariumNavigation({
    cameraState: camera,
    canvas,
    onCameraCommit,
    onCameraPreview,
    onManualNavigation: jest.fn(),
    onTap: jest.fn(),
  });
  return null;
};

describe('usePlanetariumNavigation', () => {
  it('publishes held-gesture camera previews without following pinch centroid jitter', async () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 80,
      fieldOfViewDegrees: 160,
    });
    const anchor = { xPixels: 115, yPixels: 315 };
    const anchoredDirection = unprojectCanvasPoint(anchor, camera, canvas)!;
    const onCameraCommit = jest.fn();
    const onCameraPreview = jest.fn();
    await render(
      <Harness
        camera={camera}
        onCameraCommit={onCameraCommit}
        onCameraPreview={onCameraPreview}
      />,
    );

    await act(() => {
      mockGestureHandlers['pinch-onStart']!({
        focalX: anchor.xPixels,
        focalY: anchor.yPixels,
        timestamp: 100,
      });
      // Android commonly activates the simultaneous pan recognizer only after
      // the second pointer has already started the pinch.
      mockGestureHandlers['pan-onStart']!({ x: 80, y: 315 });
      mockGestureHandlers['pinch-onUpdate']!({
        focalX: 132,
        focalY: 299,
        scale: 2,
        timestamp: 200,
      });
      mockGestureHandlers['pinch-onUpdate']!({
        focalX: 141,
        focalY: 291,
        scale: 2.2,
        timestamp: 216,
      });
      mockGestureHandlers['pinch-onEnd']!();
      mockGestureHandlers['pinch-onFinalize']!();
      mockGestureHandlers['pan-onUpdate']!({ x: 200, y: 315 });
      mockGestureHandlers['pan-onEnd']!();
    });

    expect(onCameraPreview).toHaveBeenCalledTimes(2);
    expect(onCameraCommit).toHaveBeenCalled();
    const committed = onCameraCommit.mock.calls.at(-1)![0] as PlanetariumCamera;
    const projected = projectHorizontalDirection(
      anchoredDirection,
      committed,
      canvas,
    );
    expect(projected.xPixels).toBeCloseTo(anchor.xPixels, 7);
    expect(projected.yPixels).toBeCloseTo(anchor.yPixels, 7);
  });
});
