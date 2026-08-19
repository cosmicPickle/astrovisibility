# Planetarium Sky Renderer Decision

**Timestamp:** 2026-08-19 22:21 +03:00
**Status:** Approved by product owner on 2026-08-19

## Problem

The current Sky View is a cylindrical azimuth/altitude chart. Gesture-time affine
transforms can move that chart smoothly, but they cannot behave like a
planetarium camera: the grid remains a flat chart, newly projected geometry is
not generated under the finger, the zenith is singular, and the widest view
cannot become an all-sky fisheye dome.

The prior decision in
`docs/superpowers/specs/mobile/2026-08-19-2105-smooth-sky-navigation.md` to keep
the cylindrical projection is therefore superseded.

## Decision

- Adopt Expo 57's recommended `@shopify/react-native-skia` version `2.6.2` as
  the GPU canvas for the Sky View.
- Retain React Native Gesture Handler and Reanimated 4 for UI-thread camera
  input and animation.
- Replace the cylindrical viewport with a unit-vector spherical camera using an
  equidistant fisheye projection. The maximum field of view is 360 degrees
  across the fisheye diameter; narrower fields remain centred on the camera's
  azimuth/altitude direction.
- Reproject the horizontal coordinate grid, cardinal directions, catalogue
  targets, angular outlines, trajectory, transition/time markers, selected
  equipment frame, panorama mesh, and mask geometry through the same camera on
  every rendered frame.
- Preserve persisted panorama and mask alt/az geometry. This is a rendering
  change, not a persistence migration.
- Perform target and trajectory-marker hit testing by inverse-projecting the
  touch direction rather than attaching stale SVG hit regions.

## Why not embed Stellarium

Stellarium Web Engine is a browser-oriented WebGL/WebAssembly engine licensed
under AGPL-3.0. Embedding it would add a browser runtime, a separate astronomy
and catalogue stack, a materially larger integration and licensing surface, and
would still require custom bridging for Astrovisibility's local panorama/mask
model. It is not selected.

## Technology impact

- React Native Skia is MIT licensed and officially supported by Expo 57.
- Its documented Android binary-size increase is approximately 4 MB.
- It requires the Android NDK, already present for the current Reanimated native
  build.
- It introduces no permission, account, network, analytics, persistence, or
  privacy change.

## Acceptance boundary

- Dragging rotates a celestial sphere continuously; every grid, target, overlay,
  and selected trajectory remains registered to the same sky direction.
- Pinch is focal-point anchored and continuously changes angular field of view.
- Gesture release cannot reproject or snap to a different camera.
- The minimum zoom shows a recognisable 360-degree circular fisheye sky.
- North wrap and zenith trajectories are time-ordered spherical curves without
  cylindrical S-folds.
- Panorama and mask alignment remains correct at narrow, seam-crossing, upward,
  and wide fields of view.
- Release-device frame pacing is measured on the exact APK; automated tests do
  not substitute for visual gesture QA.
