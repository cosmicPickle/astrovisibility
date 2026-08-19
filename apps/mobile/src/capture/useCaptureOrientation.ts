import * as Location from 'expo-location';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useState } from 'react';

import type { OrientationSnapshot } from './captureSession';

const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const headingUncertaintyDegrees = (accuracyGrade: number) => {
  if (accuracyGrade >= 3) return 20;
  if (accuracyGrade === 2) return 35;
  if (accuracyGrade === 1) return 50;
  return null;
};

export const orientationFromDeviceMotion = (
  current: OrientationSnapshot,
  measurement: DeviceMotionMeasurement,
): OrientationSnapshot => {
  const { rotation } = measurement;
  if (!rotation) return current;

  return {
    ...current,
    // DeviceOrientation beta is about 90° while the phone is upright and the
    // back camera points at the horizon. Values beyond that represent an upward
    // pitch. This remains an estimate until a physical-device calibration pass.
    estimatedAltitudeDegrees: clamp(
      Math.abs(radiansToDegrees(rotation.beta)) - 90,
      0,
      90,
    ),
    rollDegrees: radiansToDegrees(rotation.gamma),
    rawRotation: {
      alphaRadians: rotation.alpha,
      betaRadians: rotation.beta,
      gammaRadians: rotation.gamma,
    },
  };
};

const initialOrientation: OrientationSnapshot = {
  trueHeadingDegrees: 0,
  headingAccuracyDegrees: null,
  estimatedAltitudeDegrees: 0,
  rollDegrees: 0,
  rawRotation: null,
};

export const useCaptureOrientation = (
  active: boolean,
  foregroundLocationGranted: boolean,
) => {
  const [orientation, setOrientation] =
    useState<OrientationSnapshot>(initialOrientation);
  const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);
  const [sensorError, setSensorError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    void DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setMotionAvailable(available);
        if (!available) return;
        DeviceMotion.setUpdateInterval(100);
        subscription = DeviceMotion.addListener((measurement) => {
          setOrientation((current) =>
            orientationFromDeviceMotion(current, measurement),
          );
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMotionAvailable(false);
          setSensorError('Motion sensor unavailable; use manual correction.');
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active]);

  useEffect(() => {
    if (!active || !foregroundLocationGranted) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchHeadingAsync((heading) => {
      if (cancelled) return;
      const trueHeadingDegrees =
        heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
      setOrientation((current) => ({
        ...current,
        trueHeadingDegrees,
        headingAccuracyDegrees: headingUncertaintyDegrees(heading.accuracy),
      }));
    })
      .then((nextSubscription) => {
        if (cancelled) nextSubscription.remove();
        else subscription = nextSubscription;
      })
      .catch(() => {
        if (!cancelled) {
          setSensorError(
            'True-north heading unavailable; align tiles manually.',
          );
        }
      });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, foregroundLocationGranted]);

  return {
    motionAvailable,
    orientation,
    sensorError,
    setOrientation,
  };
};
