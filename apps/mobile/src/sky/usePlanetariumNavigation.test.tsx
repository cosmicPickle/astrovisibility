import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import {
  applyPlanetariumPan,
  createPlanetariumCamera,
  getPlanetariumCameraCenter,
  type PlanetariumCamera,
} from './planetariumProjection';
import { usePlanetariumNavigation } from './usePlanetariumNavigation';

type GestureHandler = (...parameters: unknown[]) => void;

const mockGestureHandlers: Record<string, GestureHandler> = {};
const mockGestureOptions: Record<string, number> = {};
let mockLatestNavigation:
  ReturnType<typeof usePlanetariumNavigation> | undefined;

jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    runOnJS: <Parameters extends unknown[], Result>(
      callback: (...parameters: Parameters) => Result,
    ) => callback,
    useSharedValue: <Value,>(initialValue: Value) => {
      const [sharedValue] = react.useState(() => {
        let currentValue = initialValue;
        return {
          get value() {
            return currentValue;
          },
          set value(nextValue: Value) {
            currentValue = nextValue;
          },
          get: () => currentValue,
          set: (nextValue: Value | ((mockCurrent: Value) => Value)) => {
            currentValue =
              typeof nextValue === 'function'
                ? (nextValue as (mockCurrent: Value) => Value)(currentValue)
                : nextValue;
          },
        };
      });
      return sharedValue;
    },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const builder = (kind: string) => {
    const chain: Record<string, (...parameters: unknown[]) => unknown> = {};
    for (const method of ['maxDistance', 'minDistance', 'withTestId']) {
      chain[method] = () => chain;
    }
    chain.maxPointers = (value: unknown) => {
      mockGestureOptions[`${kind}-maxPointers`] = value as number;
      return chain;
    };
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
  onTap = jest.fn(),
}: {
  camera: PlanetariumCamera;
  onCameraCommit: (nextCamera: PlanetariumCamera) => void;
  onCameraPreview: (nextCamera: PlanetariumCamera) => void;
  onTap?: (x: number, y: number, camera: PlanetariumCamera) => void;
}) => {
  const navigation = usePlanetariumNavigation({
    cameraState: camera,
    canvas,
    onCameraCommit,
    onCameraPreview,
    onTap,
  });
  useEffect(() => {
    mockLatestNavigation = navigation;
  }, [navigation]);
  return null;
};

describe('usePlanetariumNavigation', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockGestureHandlers)) {
      delete mockGestureHandlers[key];
    }
    for (const key of Object.keys(mockGestureOptions)) {
      delete mockGestureOptions[key];
    }
    mockLatestNavigation = undefined;
  });

  it('publishes held-gesture FOV previews without moving the camera centre', async () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 80,
      fieldOfViewDegrees: 160,
    });
    const anchor = { xPixels: 115, yPixels: 315 };
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

    expect(onCameraPreview).toHaveBeenCalledTimes(3);
    expect(onCameraCommit).toHaveBeenCalledTimes(1);
    const committed = onCameraCommit.mock.calls.at(-1)![0] as PlanetariumCamera;
    expect(getPlanetariumCameraCenter(committed)).toEqual(
      getPlanetariumCameraCenter(camera),
    );
    expect(committed.fieldOfViewDegrees).toBeCloseTo(160 / 2.2, 10);
  });

  it('derives pan from one gesture baseline regardless of event frequency', async () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
    });
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
      mockGestureHandlers['pan-onStart']!({ x: 200, y: 400 });
      mockGestureHandlers['pan-onUpdate']!({ x: 220, y: 400 });
      mockGestureHandlers['pan-onUpdate']!({ x: 240, y: 400 });
      mockGestureHandlers['pan-onEnd']!();
      mockGestureHandlers['pan-onFinalize']!();
    });

    const previews = onCameraPreview.mock.calls.map(
      ([preview]) => preview as PlanetariumCamera,
    );
    expect(previews).toHaveLength(3);
    expect(getPlanetariumCameraCenter(previews[1]!)).not.toEqual(
      getPlanetariumCameraCenter(previews[0]!),
    );
    expect(previews[1]).toEqual(
      applyPlanetariumPan(
        camera,
        canvas,
        { xPixels: 200, yPixels: 400 },
        { xPixels: 240, yPixels: 400 },
      ),
    );
    expect(previews[2]).toEqual(previews[1]);
    expect(previews[1]!.fieldOfViewDegrees).toBe(100);
    expect(mockGestureOptions['pan-maxPointers']).toBe(1);
    expect(onCameraCommit).toHaveBeenCalledTimes(1);
    expect(onCameraCommit.mock.calls.at(-1)![0]).toEqual(previews[1]);
  });

  it('keeps the native gesture camera authoritative across a commit-only parent rerender', async () => {
    const initialCamera = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 100,
    });
    const onCameraCommit = jest.fn();
    const onCameraPreview = jest.fn();
    const firstTap = jest.fn();
    const view = await render(
      <Harness
        camera={initialCamera}
        onCameraCommit={onCameraCommit}
        onCameraPreview={onCameraPreview}
        onTap={firstTap}
      />,
    );
    const initialGesture = mockLatestNavigation!.gesture;

    await act(() => {
      mockGestureHandlers['pan-onStart']!({ x: 200, y: 400 });
      mockGestureHandlers['pan-onUpdate']!({ x: 260, y: 400 });
      mockGestureHandlers['pan-onEnd']!();
      mockGestureHandlers['pan-onFinalize']!();
    });
    const committedCamera = onCameraCommit.mock.calls.at(
      -1,
    )![0] as PlanetariumCamera;
    const sharedCameraSet = jest.spyOn(mockLatestNavigation!.camera, 'set');

    await view.rerender(
      <Harness
        camera={initialCamera}
        onCameraCommit={onCameraCommit}
        onCameraPreview={onCameraPreview}
        onTap={firstTap}
      />,
    );

    expect(mockLatestNavigation!.gesture).toBe(initialGesture);
    expect(sharedCameraSet).not.toHaveBeenCalled();
    await act(() => {
      mockGestureHandlers['tap-onEnd']!({ x: 20, y: 30 }, true);
    });
    expect(firstTap).toHaveBeenCalledWith(20, 30, committedCamera);
  });
});
