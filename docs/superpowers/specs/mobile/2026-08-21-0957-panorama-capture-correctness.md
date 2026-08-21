# Panorama Capture Correctness

**Timestamp:** 2026-08-21 09:57 +03:00 (Europe/Sofia)
**Status:** Approved by direct product-owner instruction

## Purpose

Correct the panorama capture restrictions and directional metadata that govern
the later visibility mask. Keep the Android-first capture surface simple: the
rear camera is fixed at 1×, capture is camera-only, and no user-facing lens or
field-of-view calibration workflow is introduced.

## Scope

- Allow camera-centre directions from the horizon through the zenith,
  inclusively. A photograph may contain ground below the horizon or directions
  beyond the zenith; only its intersection with the 0°–90° astronomical sky is
  authoritative mask coverage.
- Replace flat axis-aligned coverage rectangles with a sampled boundary of the
  same rolled rectilinear camera footprint used to project the captured image
  onto the sphere. Clip that boundary to the astronomical hemisphere before it
  becomes mask coverage.
- Treat camera capture as ready only when the rotation-vector pose is fresh,
  sufficiently accurate, and steady. A sample is fresh for 500 ms. Android
  accuracy must be medium or high. The camera must remain within 1.5° of a
  stable anchor for 300 ms. These values tolerate ordinary 50 ms sensor cadence
  and brief JS scheduling jitter while rejecting a moving or stalled phone.
- Snapshot the latest validated pose at shutter invocation instead of relying
  on a render-time closure.
- Explicitly use the back camera at Expo zoom 0, which maps to CameraX 1×, with
  zoom gestures absent and the existing 4:3 capture ratio. Continue persisting
  the current Camera2 metadata-derived FOV, labelled as an estimate rather than
  a calibrated measurement.
- Remove image import, the obsolete `capture-proof` route, its Euler-angle
  orientation path, and their now-unused Expo dependencies.

## Geometry contract

- A camera tile is a rectilinear image plane defined by centre azimuth,
  centre altitude, roll, horizontal FOV, and vertical FOV.
- Camera-plane boundary points are converted through the horizontal spherical
  camera basis. Boundary sampling is at most 1° between samples; horizon
  intersections are refined by bisection before the boundary is clipped to
  altitude 0°–90°.
- The same resulting polygon is persisted with the panorama tile and reused by
  mask creation.
- The live blue guide remains a rectangular screen-space camera frame. This
  specification changes its altitude validity state, not its visual shape.

## Functional and failure behavior

- Capture is allowed at centre altitude 0° and 90° when pose readiness passes.
- Capture is blocked only when the camera centre is below the horizon, pose is
  missing/stale/moving, sensor accuracy is below medium, camera permission is
  unavailable, or another capture operation is active.
- The UI explains acquiring, moving, stale, and unreliable states concisely.
- Camera denial retains settings recovery and navigation back to the profile.
- Draft durability, size/tile bounds, manual review corrections, atomic
  completion, partial panorama support, and panorama/mask deletion semantics
  remain unchanged.

## Migration and privacy

- A forward migration invalidates and deletes existing panorama revisions,
  visibility-mask revisions, and panorama capture drafts because their flat
  coverage cannot be mixed safely with the corrected model. Profiles,
  equipment, catalogue data, and other settings remain intact.
- The database deletion occurs transactionally. Existing startup orphan
  maintenance then removes the no-longer-referenced app-owned image files.
- Coverage polygon JSON keeps its existing shape and bounds after migration.
- No new permission, network path, sensor persistence, or sensitive logging is
  introduced. Removing import and the old proof route reduces permission and
  dependency surface.

## Acceptance criteria

1. Centre-altitude fixtures at 0°, 45°, 80°, and 90° are allowed; a centre below
   0° is rejected regardless of how much of the frame sees sky.
2. A low-centred camera may include ground, and its persisted coverage begins
   on the 0° horizon rather than rejecting the photograph.
3. Rolled and zenith-crossing coverage follows the spherical camera footprint,
   preserves seam continuity, and differs from the former axis-aligned box.
4. The forward migration preserves profiles/equipment while removing all old
   panorama, mask, and draft records; startup cleanup removes their image files.
5. Missing, stale, low-accuracy, and moving poses disable Capture; a fresh
   medium/high-accuracy pose held steady for 300 ms enables it.
6. Shutter metadata uses the latest validated ready pose.
7. `CameraView` explicitly uses the back camera, zoom 0, and 4:3 ratio.
8. Image import, `capture-proof`, the Euler orientation hook, and their unused
   dependencies are absent from the shipped app.
9. Focused tests, root quality gates, Android production build, and capture-flow
   visual QA at representative and constrained phone viewports pass.

## Non-goals

- Selecting a physical Android camera ID or adding camera calibration UI.
- User-facing zoom, lens, import, or per-tile management controls.
- Attempting to translate old flat panorama coverage into the new geometry.
- Changing the visibility-mask drawing tools or obstruction calculation
  tolerance.
