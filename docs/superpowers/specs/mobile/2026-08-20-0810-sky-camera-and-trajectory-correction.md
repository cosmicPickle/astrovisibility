# Sky Camera and Trajectory Correction

**Timestamp:** 2026-08-20 08:10 +03:00

**Status:** Approved by direct owner feedback on 2026-08-20

## Purpose

Correct the remaining Sky View motion and trajectory defects after the first
spherical-renderer release. The user outcome is Stellarium-like navigation:
zoom does not appear to orbit around a displaced viewpoint, DSO membership and
labels do not snap only when a gesture ends, and a target's diurnal path reads
as a smooth celestial circle rather than a bent polyline.

## Findings

- The current azimuthal-equidistant projection is Stellarium's optional
  fish-eye projection, not its default projection. Astrovisibility also extends
  it to a 360-degree diameter, while Stellarium documents a 180-degree maximum
  for this mode.
- Stellarium's default stereographic projection preserves local angles and maps
  spherical circles to screen circles or lines. Its documented maximum field of
  view is 235 degrees.
- Astrovisibility follows every reported pinch centroid movement. Android
  centroid noise therefore rotates the camera during an otherwise symmetric
  zoom.
- Catalogue candidates and collision decisions are recomputed only from the
  released camera. The GPU scene moves continuously, but candidate membership
  and labels can change as one release-time batch.
- Trajectory samples are currently joined directly. The prior verification
  report incorrectly said they were densified before projection.

## Requirements

1. Use a stereographic unit-sphere projection with a maximum 235-degree field
   of view, matching Stellarium's default projection and documented limit.
2. Keep projection and inverse projection mathematically paired. Preserve the
   direction under a fixed initial pinch centroid while scale changes.
3. Treat one-finger drag as camera rotation. Do not turn noisy two-finger
   centroid movement into unintended camera translation.
4. Update the bounded catalogue candidate set during a held gesture without
   writing a delayed camera back over the UI-thread camera.
5. Keep target identity deterministic and rendering bounded. Do not mount the
   full 13,371-object catalogue.
6. Densify each contiguous above-horizon trajectory segment on the sphere
   before projection. Preserve shared visibility-transition endpoints and time
   order.
7. Keep panorama, mask, grid, field-of-view, targets, trajectory, markers, and
   hit testing on the same projection and camera.
8. Preserve persistence, permissions, privacy, catalogue data, and local-only
   behavior.

## Acceptance Criteria

- A synthetic spherical small circle projects to a circle within a defined
  numerical tolerance when it does not contain the projection antipode.
- Projection/inverse-projection round trips remain accurate across the supported
  field of view.
- A stationary off-centre pinch anchor remains at the same screen coordinate,
  and injected centroid jitter cannot change the anchor used for zoom.
- Candidate refreshes occur during a held gesture and cannot reset the live
  camera. Release does not produce a final candidate/layout jump.
- A north-, seam-, and zenith-crossing trajectory is continuous, time ordered,
  and visibly smooth at normal and widest zoom.
- The exact Android release passes representative and constrained viewport
  gesture and selected-trajectory review without fatal, ANR, React Native,
  Skia, or worklet errors.

## Verification

- Add failing projection-circle, fixed-pinch-anchor, live-candidate-refresh,
  and trajectory-densification regression tests before production changes.
- Run root format, typecheck, lint, relevant tests, full tests, and build.
- Build and inspect the exact release APK on the Android emulator at 1080 x 2400
  / 420 dpi and 720 x 1600 / 320 dpi.

## Sources

- Stellarium 26.2 source sets `ProjectionStereographic` as the default.
- Stellarium 26.2 User Guide section 4.4.1.1 documents stereographic projection
  at a 235-degree maximum and fish-eye as azimuthal equidistant at a 180-degree
  maximum.
