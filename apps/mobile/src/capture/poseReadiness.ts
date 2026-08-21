import type { DevicePoseSample, DevicePoseVector } from './devicePose';

export type CapturePoseReadiness =
  'acquiring' | 'stabilizing' | 'ready' | 'stale' | 'unreliable';

export interface PoseReadinessTracker {
  anchorPose: DevicePoseSample;
  latestPose: DevicePoseSample;
  receivedAtMs: number;
  stableSinceMs: number;
}

export const MAXIMUM_CAPTURE_POSE_AGE_MS = 500;
export const CAPTURE_POSE_STABILITY_DURATION_MS = 300;
export const CAPTURE_POSE_STABILITY_TOLERANCE_DEGREES = 1.5;
export const MINIMUM_CAPTURE_POSE_ACCURACY = 2;

const angularSeparationDegrees = (
  left: DevicePoseVector,
  right: DevicePoseVector,
) => {
  const dot =
    left.east * right.east + left.north * right.north + left.up * right.up;
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
};

const poseMovementDegrees = (left: DevicePoseSample, right: DevicePoseSample) =>
  Math.max(
    angularSeparationDegrees(left.forward, right.forward),
    angularSeparationDegrees(left.up, right.up),
  );

export const advancePoseReadiness = (
  current: PoseReadinessTracker | null,
  latestPose: DevicePoseSample,
  receivedAtMs: number,
): PoseReadinessTracker => {
  if (
    !current ||
    poseMovementDegrees(current.anchorPose, latestPose) >
      CAPTURE_POSE_STABILITY_TOLERANCE_DEGREES
  ) {
    return {
      anchorPose: latestPose,
      latestPose,
      receivedAtMs,
      stableSinceMs: receivedAtMs,
    };
  }
  return { ...current, latestPose, receivedAtMs };
};

export const evaluatePoseReadiness = (
  tracker: PoseReadinessTracker | null,
  nowMs: number,
): CapturePoseReadiness => {
  if (!tracker) return 'acquiring';
  if (tracker.latestPose.accuracy < MINIMUM_CAPTURE_POSE_ACCURACY) {
    return 'unreliable';
  }
  if (nowMs - tracker.receivedAtMs > MAXIMUM_CAPTURE_POSE_AGE_MS) {
    return 'stale';
  }
  if (nowMs - tracker.stableSinceMs < CAPTURE_POSE_STABILITY_DURATION_MS) {
    return 'stabilizing';
  }
  return 'ready';
};

export const getReadyCapturePose = (
  tracker: PoseReadinessTracker | null,
  nowMs: number,
) =>
  evaluatePoseReadiness(tracker, nowMs) === 'ready'
    ? tracker!.latestPose
    : null;
