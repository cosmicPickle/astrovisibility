import { correctContinuousPose } from './continuousCapturePose';
import type { DevicePoseSample } from './devicePose';

const north: DevicePoseSample = {
  accuracy: 3,
  timestampNanoseconds: 1,
  forward: { east: 0, north: 1, up: 0 },
  right: { east: 1, north: 0, up: 0 },
  up: { east: 0, north: 0, up: 1 },
};
it('applies a visual heading correction to new sensor movement without freezing the camera', () => {
  const east = {
    ...north,
    forward: { east: 1, north: 0, up: 0 },
    right: { east: 0, north: -1, up: 0 },
  };
  const corrected = correctContinuousPose(east, {
    sensor: north,
    tracked: east,
  })!;
  expect(corrected.forward.north).toBeCloseTo(-1);
  expect(corrected.forward.east).toBeCloseTo(0);
  expect(corrected.up.up).toBeCloseTo(1);
  expect(correctContinuousPose(north, null)).toBe(north);
});
