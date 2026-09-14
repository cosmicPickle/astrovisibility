import {
  createMaskTouchState,
  updateMaskTouches,
  remainingMaskTouches,
} from './maskEditorTouch';
import { createPlanetariumCamera } from '../sky/planetariumProjection';

const camera = createPlanetariumCamera({
  centerAltitudeDegrees: 70,
  centerAzimuthDegrees: 359,
  fieldOfViewDegrees: 80,
});
const canvas = { widthPixels: 400, heightPixels: 600 };
const touch = (x: number, y: number) => ({ xPixels: x, yPixels: y });

describe('mask touch ownership', () => {
  it('retains an overflow sentinel so an oversized stroke cannot silently save only its first part', () => {
    const state = {
      ...createMaskTouchState(camera),
      active: true,
      points: Array.from({ length: 4096 }, () => touch(0, 0)),
    };
    const overflow = updateMaskTouches(state, 'move', [touch(10, 10)], canvas);
    expect(overflow.points).toHaveLength(4097);
    expect(
      updateMaskTouches(overflow, 'move', [touch(20, 20)], canvas).points,
    ).toHaveLength(4097);
  });
  it('removes lifted contacts from Android touch-up payloads before committing', () => {
    const first = { id: 1, x: 100, y: 100 };
    const second = { id: 2, x: 200, y: 100 };
    expect(remainingMaskTouches([first, second], [second])).toEqual([
      touch(100, 100),
    ]);
    const remaining = remainingMaskTouches([first], [first]);
    const state = updateMaskTouches(
      createMaskTouchState(camera),
      'down',
      [touch(100, 100)],
      canvas,
    );
    expect(updateMaskTouches(state, 'up', remaining, canvas).completed).toEqual(
      [touch(100, 100)],
    );
  });
  it('commits taps and continuous one-finger strokes', () => {
    let state = createMaskTouchState(camera);
    state = updateMaskTouches(state, 'down', [touch(100, 100)], canvas);
    expect(updateMaskTouches(state, 'up', [], canvas).completed).toEqual([
      touch(100, 100),
    ]);
    state = updateMaskTouches(state, 'move', [touch(110, 120)], canvas);
    expect(updateMaskTouches(state, 'up', [], canvas).completed).toHaveLength(
      2,
    );
  });
  it('cancels paint when a second finger arrives and keeps navigation ownership until all fingers lift', () => {
    let state = createMaskTouchState(camera);
    state = updateMaskTouches(state, 'down', [touch(100, 100)], canvas);
    state = updateMaskTouches(
      state,
      'down',
      [touch(100, 100), touch(200, 100)],
      canvas,
    );
    expect(state.points).toEqual([]);
    state = updateMaskTouches(
      state,
      'move',
      [touch(110, 110), touch(230, 110)],
      canvas,
    );
    expect(state.camera.fieldOfViewDegrees).toBeLessThan(
      camera.fieldOfViewDegrees,
    );
    state = updateMaskTouches(state, 'up', [touch(110, 110)], canvas);
    state = updateMaskTouches(state, 'move', [touch(130, 110)], canvas);
    expect(
      updateMaskTouches(state, 'up', [], canvas).completed,
    ).toBeUndefined();
  });
  it('never paints after cancellation', () => {
    const state = updateMaskTouches(
      createMaskTouchState(camera),
      'down',
      [touch(100, 100)],
      canvas,
    );
    const cancelled = updateMaskTouches(state, 'cancel', [], canvas);
    expect(
      updateMaskTouches(cancelled, 'up', [], canvas).completed,
    ).toBeUndefined();
    expect(cancelled.points).toEqual([]);
  });
});
