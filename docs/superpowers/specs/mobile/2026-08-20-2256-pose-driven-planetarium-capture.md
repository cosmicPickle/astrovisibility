# Pose-Driven Planetarium Panorama Capture

**Timestamp:** 2026-08-20 22:56 +03:00 (Europe/Sofia)
**Status:** Approved by direct product-owner instruction

## Purpose

Replace the failed unfolded 2D panorama guidance with a split-screen capture
surface whose lower half is the same spherical planetarium scene used by Sky
View. The planetarium camera follows the rear phone camera's complete fused 3D
pose. Captured images are projected back onto their measured region of that
same sky sphere.

This is a replacement, not another correction to the Euler-angle/SVG guide.

## User experience

- After the existing contextual permission primer, capture mode fills the
  available screen without a scrolling document.
- The top half is the live rear-camera preview.
- The bottom half is the existing Skia planetarium scene and projection, with
  the local horizon/ground, zenith-capable grid, cardinal directions, and faint
  celestial equator.
- The lower planetarium camera's forward, right, and up vectors follow the rear
  camera pose. Tilting and rotating the phone moves the virtual view as one
  rigid camera; there is no independent pan gesture in capture mode.
- A faded blue phone/camera footprint stays centered in the planetarium. The sky
  rotates beneath it, including phone roll. The footprint uses the active rear
  camera's measured portrait field of view.
- A prominent capture button overlays the lower scene. Review and import remain
  available without obscuring the core aiming view.
- Each accepted image immediately appears as a green-tinted projected tile on
  the relevant part of the lower sky. It stays fixed to the world while the
  phone/virtual camera moves.
- The existing review/correction and partial-panorama save flow remains
  available. No 360-degree capture requirement is introduced.

## Pose architecture

The existing `expo-sensors` `DeviceMotion.rotation` Euler-angle path is removed
from production capture guidance. Android exposes a fused
`TYPE_ROTATION_VECTOR`; reducing its rotation matrix to alpha/beta/gamma near a
portrait camera pose introduces a gimbal singularity and loses the stable basis
needed for this feature.

A focused Android Expo local module will:

1. subscribe to the platform fused rotation-vector sensor only while a JS
   listener exists and the app is foregrounded;
2. preserve the platform rotation matrix;
3. derive the rear-camera forward vector from device `-Z`, phone-right from
   device `+X`, and phone-up from device `+Y`;
4. express those vectors in east/up/true-north coordinates;
5. correct magnetic north to true north using Android `GeomagneticField` and
   the already-saved observing location, without logging or persisting that
   location in the module;
6. report platform sensor accuracy and stop all listeners on background,
   unsubscription, or module destruction;
7. report the primary rear camera's physical portrait horizontal and vertical
   field of view from Camera2 sensor size/focal-length characteristics, with a
   conservative explicit fallback only when characteristics are unavailable.

The TypeScript boundary validates every finite vector/FOV sample, normalizes and
orthogonalizes the camera basis, rejects degenerate samples, and performs only a
short vector low-pass interpolation. It never reconstructs the pose through
Euler angles or combines it with `Location.watchHeadingAsync`.

The native module uses Expo Modules API, an already approved architectural
pattern proven in Rallypath. It is Android-only for the current Android release
scope and adds no permission, external service, or third-party dependency.

## Coordinate contract

- Android device axes: `+X` right, `+Y` toward the phone top, `+Z` out through
  the display; the rear camera looks along `-Z`.
- Native world axes are converted to the planetarium convention: `+X` east,
  `+Y` up/zenith, `+Z` true north.
- The lower scene consumes the resulting orthonormal `forward/right/up` basis
  directly as a `PlanetariumCamera`; no azimuth/altitude projection occurs in
  the live render path.
- A saved tile derives centre azimuth/altitude and roll once from that same
  basis. Its physical camera FOV and captured image dimensions are persisted and
  reused by the existing spherical panorama mesh.
- The complete captured footprint must remain between 20° and 80° altitude.
  The limit is evaluated along the complete spherical FOV boundary, not only
  its corners, the camera centre, or a rotated 2D approximation.

## Functional and failure behavior

- If fused pose is unavailable, stale, inaccurate, or invalid, the virtual
  scene remains visible but capture is disabled with concise calibration/manual
  import guidance. A wrong direction must never be presented as trustworthy.
- Camera denial retains the lower sky view, import, settings recovery, and
  review of already accepted tiles.
- Missing Camera2 characteristics use the documented fallback FOV and disclose
  that the frame is approximate; capture remains possible.
- Storage failure leaves the draft and already accepted tiles intact, as in the
  existing atomic draft model.
- Existing saved panorama/mask revisions and draft tiles remain readable. No
  schema migration or destructive rewrite is required.

## Acceptance criteria

1. Top and bottom capture regions each occupy half of the available capture
   surface on representative and constrained portrait phones.
2. Rear-camera forward/right/up platform fixtures drive the identical
   planetarium camera basis without Euler conversion.
3. North/east/south/west, horizon, zenith, and ±roll fixtures project in the
   expected direction with an orthonormal camera basis.
4. The lower scene uses `PlanetariumScene`, not a separate SVG atlas or a second
   sky projection.
5. The blue ghost uses the same camera FOV persisted on a newly accepted tile.
6. A newly accepted tile is rendered by the existing spherical panorama mesh,
   fixed in world coordinates while subsequent pose changes move the camera.
7. Capture limits use the complete spherical camera-frame boundary and preserve
   the inclusive 20°–80° contract.
8. Pose listeners are lifecycle-bound; no sensitive coordinates or raw sensor
   streams are logged or persisted beyond the existing compact orientation
   snapshot.
9. Existing import, manual review/correction, restart-safe draft, completion,
   panorama display, and later mask generation remain functional.

## Verification

- Add failing-first pure tests for basis validation/smoothing, cardinal and roll
  pose fixtures, FOV-corner limits, and pose-to-saved-placement identity.
- Add component tests for the split layout, disabled invalid/stale pose,
  capture/review/import actions, and accepted-tile planetarium wiring.
- Compile the native Android module through a clean prebuild/release build.
- Run repository format/typecheck/lint/test/build gates.
- Install the exact release APK and visually inspect normal and constrained
  portrait viewports, permission denial, unavailable-pose state, capture/review,
  restart, and projected accepted tiles.
- The product owner performs the final physical-device directional/latency
  confirmation because an emulator cannot reproduce a real magnetic and held
  device pose.

## Security and privacy

No new permission or network path. Profile coordinates are passed only in
memory to compute declination and are not logged by the module. Sensor listeners
are foreground- and subscription-scoped. Camera characteristic queries and
rotation vectors are bounded platform data; malformed native payloads are
rejected at the TypeScript trust boundary.
