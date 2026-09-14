import {
  applyPlanetariumPan,
  applyPlanetariumZoom,
  type PlanetariumCamera,
} from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';

export interface MaskTouchPoint {
  xPixels: number;
  yPixels: number;
}

/** Android captures allTouches before removing the contacts in changedTouches. */
export function remainingMaskTouches(
  all: readonly { id: number; x: number; y: number }[],
  released: readonly { id: number }[],
): MaskTouchPoint[] {
  'worklet';
  return all
    .filter((point) => !released.some((lifted) => lifted.id === point.id))
    .map((point) => ({ xPixels: point.x, yPixels: point.y }));
}
export interface MaskTouchState {
  active: boolean;
  navigating: boolean;
  camera: PlanetariumCamera;
  baseline: PlanetariumCamera;
  center: MaskTouchPoint;
  distance: number;
  points: MaskTouchPoint[];
  completed?: MaskTouchPoint[];
}

export function createMaskTouchState(
  camera: PlanetariumCamera,
): MaskTouchState {
  'worklet';
  return {
    active: false,
    navigating: false,
    camera,
    baseline: camera,
    center: { xPixels: 0, yPixels: 0 },
    distance: 1,
    points: [],
  };
}

/** A two-finger chord owns the entire contact sequence, including its last finger. */
export function updateMaskTouches(
  state: MaskTouchState,
  phase: 'down' | 'move' | 'up' | 'cancel',
  touches: readonly MaskTouchPoint[],
  canvas: CanvasSizePixels,
): MaskTouchState {
  'worklet';
  const next = { ...state, completed: undefined };
  if (phase === 'cancel') return createMaskTouchState(state.camera);
  if (phase === 'up' && touches.length === 0) {
    return {
      ...createMaskTouchState(state.camera),
      completed: state.active && !state.navigating ? state.points : undefined,
    };
  }
  if (!state.active && phase === 'down' && touches.length === 1) {
    return {
      ...createMaskTouchState(state.camera),
      active: true,
      points: [touches[0]!],
    };
  }
  if (touches.length >= 2) {
    const first = touches[0]!,
      second = touches[1]!;
    const center = {
      xPixels: (first.xPixels + second.xPixels) / 2,
      yPixels: (first.yPixels + second.yPixels) / 2,
    };
    const distance = Math.max(
      1,
      Math.hypot(
        first.xPixels - second.xPixels,
        first.yPixels - second.yPixels,
      ),
    );
    if (!state.navigating || phase === 'down') {
      return {
        ...next,
        active: true,
        navigating: true,
        baseline: state.camera,
        center,
        distance,
        points: [],
      };
    }
    const zoomed = applyPlanetariumZoom(
      state.baseline,
      distance / state.distance,
    );
    return {
      ...next,
      camera: applyPlanetariumPan(zoomed, canvas, state.center, center),
      points: [],
    };
  }
  if (phase === 'move' && state.active && !state.navigating && touches[0]) {
    const point = touches[0];
    const previous = state.points.at(-1);
    if (
      // Retain one overflow point so the whole stroke is rejected on commit.
      state.points.length < 4097 &&
      (!previous ||
        Math.hypot(
          point.xPixels - previous.xPixels,
          point.yPixels - previous.yPixels,
        ) >= 1)
    ) {
      return { ...next, points: [...state.points, point] };
    }
  }
  return next;
}
