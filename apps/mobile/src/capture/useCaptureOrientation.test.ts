import type { DeviceMotionMeasurement } from 'expo-sensors';

import {
  headingUncertaintyDegrees,
  orientationFromDeviceMotion,
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
  it('maps an upright camera to the horizon and an upward pitch toward zenith', () => {
    const horizon = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: Math.PI / 2, gamma: 0 },
    } as DeviceMotionMeasurement);
    const upward = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: Math.PI, gamma: 0.1 },
    } as DeviceMotionMeasurement);

    expect(horizon.estimatedAltitudeDegrees).toBeCloseTo(0);
    expect(upward.estimatedAltitudeDegrees).toBeCloseTo(90);
    expect(upward.rollDegrees).toBeCloseTo(5.73, 1);
    expect(upward.trueHeadingDegrees).toBe(120);
  });

  it('smooths subsequent altitude and roll samples without delaying the first fix', () => {
    const first = orientationFromDeviceMotion(initial, {
      rotation: { alpha: 0, beta: (2 * Math.PI) / 3, gamma: 0.2 },
    } as DeviceMotionMeasurement);
    const subsequent = orientationFromDeviceMotion(
      {
        ...first,
        rawRotation: { alphaRadians: 0, betaRadians: 2, gammaRadians: 0 },
      },
      {
        rotation: { alpha: 0, beta: Math.PI, gamma: 0.4 },
      } as DeviceMotionMeasurement,
    );

    expect(first.estimatedAltitudeDegrees).toBeCloseTo(30);
    expect(subsequent.estimatedAltitudeDegrees).toBeGreaterThan(30);
    expect(subsequent.estimatedAltitudeDegrees).toBeLessThan(90);
    expect(subsequent.rollDegrees).toBeGreaterThan(first.rollDegrees);
    expect(subsequent.rollDegrees).toBeLessThan(22.92);
  });

  it('smooths headings across north using the short circular path', () => {
    expect(smoothHeadingDegrees(358, 2)).toBeCloseTo(359);
    expect(smoothHeadingDegrees(2, 358)).toBeCloseTo(1);
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
