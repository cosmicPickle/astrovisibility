# Panorama Capture Pose Stability and Limits

**Timestamp:** 2026-08-20 21:11 +03:00 (Europe/Sofia)
**Status:** Approved by direct owner instruction

## Purpose

Keep the live capture footprint visually stable while the phone is held still,
and prevent unreliable camera captures too close to the horizon or zenith.

## Scope and decisions

- Preserve the existing 0–360 degree azimuth by 0–90 degree altitude capture
  map, camera/import flow, durable drafts, review, and panorama/mask alignment.
- Treat the rectangular camera footprint's roll as an axial angle with a
  180-degree period. A rectangle at 179 degrees is visually adjacent to one at
  -1 degree; it must not be smoothed through a needless 180-degree turn.
- Apply small deadbands before low-pass filtering heading, altitude, and roll so
  sensor noise does not visibly twitch a stationary footprint.
- Allow camera capture when the rear-camera centre altitude is inclusively
  between 20 and 80 degrees. The approximate camera field still reaches the
  horizon and zenith from those centre limits.
- Keep image import and manual review available outside those automatic sensor
  limits. They are the recovery path for unavailable or unreliable sensors and
  do not trigger a live camera shutter.

## Functional requirements

1. A steady roll crossing Android's +180/-180 representation boundary does not
   make the footprint spin or change its apparent orientation.
2. Small heading, altitude, and roll changes below the presentation deadband do
   not move the displayed footprint.
3. Larger intentional movement remains responsive through bounded low-pass
   smoothing and north-wrap-aware heading interpolation.
4. At 20 through 80 degrees altitude, the live footprint remains blue and the
   camera capture action is available when camera permission is granted.
5. Below 20 degrees, the live footprint and camera reticle turn red, an
   accessible message asks the user to aim higher, and camera capture is
   disabled.
6. Above 80 degrees, the same red state asks the user to aim lower and camera
   capture is disabled.
7. The 20- and 80-degree boundary values are valid.
8. Existing heading-confidence and sensor-unavailable guidance remains visible
   and image import remains usable.

## Verification

- Add failing-first pure tests for axial roll wrapping, deadbands, smoothing,
  and inclusive altitude limits.
- Add component coverage for valid, too-low, and too-high capture guidance and
  shutter blocking.
- Run the focused capture suites and required root quality gates.
- Build and install a release APK, then inspect the capture flow at representative
  and constrained Android phone viewports.
- Emulator review can verify colour, messages, control state, and layout. Final
  stationary-pose stability remains a physical-phone confirmation because the
  emulator cannot reproduce real magnetometer/device-motion noise.

## Privacy, security, and compatibility

No dependency, permission, persistence, schema, network, or logging change is
required. Processing remains bounded to transient sensor samples while the
capture screen is active.
