# Panorama Capture Vertical Orientation

**Timestamp:** 2026-08-20 19:43 +03:00 (Europe/Sofia)
**Status:** Approved by direct owner bug report

## Purpose

Make the live blue capture footprint represent the rear camera's vertical sky
direction. It currently remains on the horizon because every valid Android pitch
sample is reduced to a non-positive altitude and clamped to zero.

## Coordinate model

Expo DeviceMotion uses portrait device axes: X left-to-right, Y bottom-to-top,
and Z through the screen from back to front. The rear camera looks along the
negative Z axis.

On Android, Expo derives `rotation.beta` and `rotation.gamma` from
`SensorManager.getOrientation`. Android pitch is limited to -90–90 degrees. The
vertical world component of the rear-camera optical axis is:

`-cos(beta) * cos(gamma)`

The signed rear-camera elevation is the arcsine of that component. Capture only
models the sky above the local horizon, so negative elevations are clamped to
zero and positive elevations are bounded to 90 degrees.

This replaces the invalid `abs(beta) - 90°` shortcut. That shortcut can never
produce a positive result for Android's documented pitch range.

## Requirements

1. Rear-camera horizontal orientation maps to 0 degrees altitude.
2. A rear camera aimed 30 degrees upward maps to approximately 30 degrees.
3. A rear camera aimed at the zenith maps to 90 degrees.
4. A rear camera aimed below the horizon does not appear in the sky map and is
   clamped to 0 degrees.
5. Existing first-sample immediacy and subsequent low-pass smoothing remain.
6. Heading, circular north smoothing, roll storage, capture footprints, durable
   drafts, imports, and manual review remain unchanged.

## Verification

- Add pure regression coverage using valid Expo/Android beta/gamma ranges.
- Run the capture orientation/component tests and the required root gates.
- Build and install the release APK.
- Inspect the capture screen at representative and constrained Android phone
  viewports. Emulator QA can verify layout and mapped synthetic calculations,
  but real physical movement must be confirmed by the owner because the emulator
  has no equivalent physical rear-camera pose sensor.

## Privacy, security, and compatibility

No dependency, permission, persistence, network, or logging change is required.
The calculation consumes the same transient sensor readings already used during
capture and stores no additional device data.
