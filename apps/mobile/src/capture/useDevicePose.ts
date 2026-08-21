import AstrovisibilityDevicePose, {
  type NativeDevicePose,
} from 'astrovisibility-device-pose';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProfileRecord } from '../storage/profileRepository';
import {
  smoothDevicePose,
  validateDevicePoseSample,
  type CaptureCameraFieldOfView,
  type DevicePoseSample,
} from './devicePose';
import {
  advancePoseReadiness,
  evaluatePoseReadiness,
  getReadyCapturePose,
  type CapturePoseReadiness,
  type PoseReadinessTracker,
} from './poseReadiness';

const DEFAULT_FIELD_OF_VIEW: CaptureCameraFieldOfView = {
  approximate: true,
  horizontalDegrees: 55,
  verticalDegrees: 69,
};
const POSE_SMOOTHING_FACTOR = 0.35;

export interface DevicePoseState {
  available: boolean | null;
  error: string | null;
  fieldOfView: CaptureCameraFieldOfView;
  getCapturePose(): DevicePoseSample | null;
  pose: DevicePoseSample | null;
  readiness: CapturePoseReadiness;
}

export const useDevicePose = (
  active: boolean,
  profile: ProfileRecord | null,
): DevicePoseState => {
  const previousPose = useRef<DevicePoseSample | null>(null);
  const readinessTracker = useRef<PoseReadinessTracker | null>(null);
  const [state, setState] = useState<DevicePoseState>({
    available: null,
    error: null,
    fieldOfView: DEFAULT_FIELD_OF_VIEW,
    getCapturePose: () => null,
    pose: null,
    readiness: 'acquiring',
  });

  const getCapturePose = useCallback(
    () => getReadyCapturePose(readinessTracker.current, Date.now()),
    [],
  );

  useEffect(() => {
    if (!active || !profile) {
      previousPose.current = null;
      readinessTracker.current = null;
      return undefined;
    }
    let mounted = true;
    let subscription: { remove(): void } | undefined;
    const configure = async () => {
      await AstrovisibilityDevicePose.configureObserverAsync(
        profile.latitudeDegreesNorth,
        profile.longitudeDegreesEast,
        profile.elevationMetersAboveMeanSeaLevel,
        Date.now(),
      );
      const [available, fieldOfView] = await Promise.all([
        AstrovisibilityDevicePose.isAvailableAsync(),
        AstrovisibilityDevicePose.getRearCameraFieldOfViewAsync(),
      ]);
      if (!mounted) return;
      setState((current) => ({
        ...current,
        available,
        error: available
          ? null
          : 'This phone does not provide a usable rotation-vector sensor.',
        fieldOfView,
      }));
      if (!available) return;
      subscription = AstrovisibilityDevicePose.addListener(
        'onPoseChanged',
        (nativePose: NativeDevicePose) => {
          if (!mounted) return;
          try {
            const validated = validateDevicePoseSample(nativePose);
            const pose = previousPose.current
              ? smoothDevicePose(
                  previousPose.current,
                  validated,
                  POSE_SMOOTHING_FACTOR,
                )
              : validated;
            previousPose.current = pose;
            readinessTracker.current = advancePoseReadiness(
              readinessTracker.current,
              validated,
              Date.now(),
            );
            setState((current) => ({
              ...current,
              available: true,
              error: null,
              pose,
              readiness: evaluatePoseReadiness(
                readinessTracker.current,
                Date.now(),
              ),
            }));
          } catch {
            setState((current) => ({
              ...current,
              error: 'The phone returned an invalid orientation sample.',
              pose: null,
              readiness: 'acquiring',
            }));
          }
        },
      );
    };
    void configure().catch(() => {
      if (!mounted) return;
      setState((current) => ({
        ...current,
        available: false,
        error:
          'Phone orientation is unavailable. Capture requires a usable rotation-vector sensor.',
        readiness: 'acquiring',
      }));
    });
    const freshnessTimer = setInterval(() => {
      if (!mounted) return;
      setState((current) => {
        const readiness = evaluatePoseReadiness(
          readinessTracker.current,
          Date.now(),
        );
        return current.readiness === readiness
          ? current
          : { ...current, readiness };
      });
    }, 100);
    return () => {
      clearInterval(freshnessTimer);
      mounted = false;
      previousPose.current = null;
      readinessTracker.current = null;
      subscription?.remove();
    };
  }, [active, profile]);

  return active && profile
    ? { ...state, getCapturePose }
    : { ...state, getCapturePose, pose: null, readiness: 'acquiring' };
};
