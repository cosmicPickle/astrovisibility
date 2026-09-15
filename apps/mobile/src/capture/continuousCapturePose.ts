import type { DevicePoseSample, DevicePoseVector } from './devicePose';

/** Apply the last visual correction to fresh sensor directions, keeping the
 * atlas responsive between analyzed frames. All vectors use east/north/up. */
export function correctContinuousPose(
  current: DevicePoseSample | null,
  correction: { sensor: DevicePoseSample; tracked: DevicePoseSample } | null,
): DevicePoseSample | null {
  if (!current || !correction) return current;
  const axes = ['right', 'up', 'forward'] as const;
  const rotate = (vector: DevicePoseVector): DevicePoseVector => {
    const result = { east: 0, north: 0, up: 0 };
    for (const axis of axes) {
      const source = correction.sensor[axis];
      const target = correction.tracked[axis];
      const weight =
        source.east * vector.east +
        source.north * vector.north +
        source.up * vector.up;
      result.east += weight * target.east;
      result.north += weight * target.north;
      result.up += weight * target.up;
    }
    return result;
  };
  return {
    ...current,
    right: rotate(current.right),
    up: rotate(current.up),
    forward: rotate(current.forward),
  };
}
