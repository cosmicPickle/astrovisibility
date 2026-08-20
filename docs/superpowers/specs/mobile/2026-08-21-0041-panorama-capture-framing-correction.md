# Panorama Capture Framing Correction

**Timestamp:** 2026-08-21 00:41 +03:00 (Europe/Sofia)
**Status:** Approved by direct product-owner instruction

## Purpose

Correct three follow-up defects in the pose-driven panorama capture screen
without changing its now-stable heading/orientation pipeline:

1. provide a reachable capture-altitude state for real portrait phone cameras;
2. make the camera footprint size auditable from device camera metadata; and
3. give the lower planetarium modestly more screen area than the preview.

## Altitude contract

The previous complete-footprint 20–80 degree rule is mathematically impossible
when the portrait camera's vertical field of view exceeds 60 degrees. The tested
device/fallback view is approximately 69 degrees tall, so no camera orientation
could ever be accepted.

The corrected asymmetric rule preserves the safety intent and the product's
zenith-capture requirement:

- the lowest direction in the complete spherical camera footprint must be at or
  above 20 degrees altitude;
- the camera's central aiming direction must be at or below 80 degrees altitude;
- the top of the camera footprint may include the zenith.

The lower limit continues to use the complete spherical footprint rather than a
flat centre-minus-half-FOV approximation. The upper centre limit prevents the
user aiming beyond the intended upward range without making a tall camera frame
impossible or prohibiting zenith imagery.

## Camera field-of-view evidence

The footprint continues to use the same FOV values persisted on captured tiles.
When Camera2 metadata is available, the native module returns the physical
sensor dimensions and selected focal length alongside the computed portrait FOV.
The UI displays the rounded horizontal × vertical angle and identifies whether
it came from device metadata or the explicit fallback estimate.

The calculation is `2 × atan(sensorDimension / (2 × focalLength))`, with sensor
axes swapped for the portrait-locked application. The UI does not claim that an
estimated fallback is measured.

## Layout

The live camera preview occupies 44% and the lower planetarium 56% of the
remaining capture surface. Existing controls, safe areas, and permission/error
states remain usable at representative and constrained phone sizes.

## Acceptance criteria

- A 69-degree-tall camera has a meaningful accepted range; a representative
  60-degree centre pose is accepted.
- A frame whose lower boundary is below 20 degrees remains red and cannot
  capture.
- A camera aimed above 80 degrees remains red and cannot capture.
- Heading, roll, vector smoothing, true-north correction, and saved placement
  remain unchanged.
- The lower planetarium is visibly larger than the upper preview.
- The UI shows the FOV angle and metadata/estimate provenance.
- Focused regression tests, repository gates, native release build, and normal
  plus constrained Android visual review pass.

## Non-goals

- No change to sensor selection, pose smoothing, projection, panorama storage,
  mask behavior, review correction, or camera permission behavior.
- No digital zoom, image crop, or invented camera model database.
