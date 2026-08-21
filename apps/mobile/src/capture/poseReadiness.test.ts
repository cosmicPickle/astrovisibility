import type { DevicePoseSample } from './devicePose';
import {
  advancePoseReadiness,
  evaluatePoseReadiness,
  getReadyCapturePose,
} from './poseReadiness';

const poseAtAzimuth = (
  azimuthDegrees: number,
  accuracy = 3,
): DevicePoseSample => {
  const radians = (azimuthDegrees * Math.PI) / 180;
  return {
    accuracy,
    forward: { east: Math.sin(radians), north: Math.cos(radians), up: 0 },
    right: { east: Math.cos(radians), north: -Math.sin(radians), up: 0 },
    timestampNanoseconds: 1,
    up: { east: 0, north: 0, up: 1 },
  };
};

describe('capture pose readiness', () => {
  it('requires a fresh medium-or-better pose held steady for 300 ms', () => {
    let tracker = advancePoseReadiness(null, poseAtAzimuth(0), 1_000);
    expect(evaluatePoseReadiness(tracker, 1_000)).toBe('stabilizing');
    tracker = advancePoseReadiness(tracker, poseAtAzimuth(0.5), 1_300);
    expect(evaluatePoseReadiness(tracker, 1_300)).toBe('ready');
    expect(getReadyCapturePose(tracker, 1_300)).toEqual(poseAtAzimuth(0.5));
    expect(evaluatePoseReadiness(tracker, 1_801)).toBe('stale');
    expect(getReadyCapturePose(tracker, 1_801)).toBeNull();
  });

  it('resets stabilization after movement and rejects low accuracy', () => {
    let tracker = advancePoseReadiness(null, poseAtAzimuth(0), 1_000);
    tracker = advancePoseReadiness(tracker, poseAtAzimuth(4), 1_250);
    expect(evaluatePoseReadiness(tracker, 1_500)).toBe('stabilizing');
    tracker = advancePoseReadiness(tracker, poseAtAzimuth(4.5), 1_550);
    expect(evaluatePoseReadiness(tracker, 1_550)).toBe('ready');

    tracker = advancePoseReadiness(tracker, poseAtAzimuth(4.5, 1), 1_600);
    expect(evaluatePoseReadiness(tracker, 1_600)).toBe('unreliable');
    expect(getReadyCapturePose(tracker, 1_600)).toBeNull();
  });
});
