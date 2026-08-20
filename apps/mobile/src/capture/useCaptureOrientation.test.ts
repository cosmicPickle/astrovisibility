import type { DeviceMotionMeasurement } from 'expo-sensors';

import {
  cameraRollDegreesFromGammaRadians,
  headingUncertaintyDegrees,
  orientationFromDeviceMotion,
  rearCameraAltitudeDegrees,
  smoothCameraRollDegrees,
  smoothHeadingDegrees,
} from './useCaptureOrientation';

const initial = {
  trueHeadingDegrees: 120,
  headingAccuracyDegrees: 20,
  estimatedAltitudeDegrees: 0,
  rollDegrees: 0,
  rawRotation: null,
};

describe('capture orientation samples', () => {
  it('derives rear-camera altitude from valid Android pitch and roll ranges', () => {
    expect(rearCameraAltitudeDegrees(Math.PI / 2, 0)).toBeCloseTo(0);
    expect(rearCameraAltitudeDegrees(-Math.PI / 3, Math.PI)).toBeCloseTo(30);
    expect(rearCameraAltitudeDegrees(0, Math.PI)).toBeCloseTo(90);
    expect(rearCameraAltitudeDegrees(0, 0)).toBe(0);
  });

  it('maps an upright camera to the horizon and an upward rear camera toward zenith', () => {
    const horizon = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: Math.PI / 2, gamma: 0 },
    } as DeviceMotionMeasurement);
    const upward = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: -Math.PI / 3, gamma: Math.PI },
    } as DeviceMotionMeasurement);

    expect(horizon.estimatedAltitudeDegrees).toBeCloseTo(0);
    expect(upward.estimatedAltitudeDegrees).toBeCloseTo(30);
    expect(upward.trueHeadingDegrees).toBe(120);
  });

  it('smooths subsequent altitude and roll samples without delaying the first fix', () => {
    const first = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: -Math.PI / 3, gamma: Math.PI },
    } as DeviceMotionMeasurement);
    const subsequent = orientationFromDeviceMotion(
      {
        ...first,
        rawRotation: {
          alphaRadians: 0,
          betaRadians: -Math.PI / 3,
          gammaRadians: Math.PI,
        },
      },
      {
        rotation: { alpha: 0, beta: 0, gamma: Math.PI },
      } as DeviceMotionMeasurement,
    );

    expect(first.estimatedAltitudeDegrees).toBeCloseTo(30);
    expect(subsequent.estimatedAltitudeDegrees).toBeGreaterThan(30);
    expect(subsequent.estimatedAltitudeDegrees).toBeLessThan(90);
    expect(subsequent.rollDegrees).toBeCloseTo(first.rollDegrees);
  });

  it('treats a rectangular footprint roll as a 180-degree axial angle', () => {
    expect(
      cameraRollDegreesFromGammaRadians((179 * Math.PI) / 180),
    ).toBeCloseTo(-1);
    expect(
      cameraRollDegreesFromGammaRadians((-179 * Math.PI) / 180),
    ).toBeCloseTo(1);
    expect(smoothCameraRollDegrees(-1, 1)).toBeCloseTo(-0.76);
    expect(smoothCameraRollDegrees(89, -89)).toBeCloseTo(89.24);
  });

  it('ignores small stationary-pose noise before smoothing larger motion', () => {
    expect(smoothHeadingDegrees(120, 120.9)).toBe(120);
    expect(smoothHeadingDegrees(120, 122)).toBeCloseTo(120.24);

    const steady = orientationFromDeviceMotion(
      {
        ...initial,
        estimatedAltitudeDegrees: 30,
        rollDegrees: 0,
        rawRotation: {
          alphaRadians: 0,
          betaRadians: -Math.PI / 3,
          gammaRadians: Math.PI,
        },
      },
      {
        rotation: {
          alpha: 0,
          beta: (-59.7 * Math.PI) / 180,
          gamma: (179.7 * Math.PI) / 180,
        },
      } as DeviceMotionMeasurement,
    );

    expect(steady.estimatedAltitudeDegrees).toBe(30);
    expect(steady.rollDegrees).toBe(0);
  });

  it('smooths headings across north using the short circular path', () => {
    expect(smoothHeadingDegrees(358, 2)).toBeCloseTo(358.48);
    expect(smoothHeadingDegrees(2, 358)).toBeCloseTo(1.52);
  });

  it('turns Expo heading grades into conservative degree warnings', () => {
    expect(headingUncertaintyDegrees(3)).toBe(20);
    expect(headingUncertaintyDegrees(2)).toBe(35);
    expect(headingUncertaintyDegrees(1)).toBe(50);
    expect(headingUncertaintyDegrees(0)).toBeNull();
  });

  it('keeps the previous orientation when a device has no rotation sample', () => {
    expect(
      orientationFromDeviceMotion(initial, {
        rotation: undefined,
      } as unknown as DeviceMotionMeasurement),
    ).toEqual(initial);
  });
});
