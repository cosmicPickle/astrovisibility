# Integrate cubemap backgrounds with optimized live time

**Timestamp:** 2026-09-14 14:05 +03:00 (Europe/Sofia)
**Authorization:** Owner requested the optimization branch merge into main and
allowed merging main into the existing cubemap branch with conflict resolution.
**Branch:** `feature/cubemap-background-renderer`; cubemap merge to main remains
subject to owner inspection.

Reuse both approved implementations. Main retains the complete optimized
celestial scene and live time slider plus Android stitching. The cubemap branch
replaces only Milky Way and saved panorama/mask background projection. Preserve
batched stars/catalogue outlines, immutable J2000 data, shared preview time,
DSO culling, selected trajectory behavior and exact time commits.

The Milky Way shader must derive its east/up/north-to-J2000 orientation on the
UI path from the same window transform and shared UTC milliseconds consumed by
stars and other celestial layers. Transpose the existing orthogonal geometric
rotation; retain the cube shader's tested inverse refraction table. Never use a
React-committed timestamp for that shader during preview. Local panorama/mask
layers receive no celestial transform and remain fixed when time changes.

No new dependency, storage format, permission, control, density change or cache
rebake on time movement. Existing source fallback, cancellation, immutable mask
revisions and narrow-boundary refinement remain intact.

Acceptance checks:

- Add a failing regression proving a shared timestamp change updates Milky Way
  uniforms without a React rerender or cube preparation; local mask uniforms
  remain unchanged.
- Verify orientation against authoritative J2000 astronomy and the optimized
  forward projector at multiple instants, 25-hour window boundaries and poles.
  Keep the cube branch's existing 0.01-degree background registration and
  one-source-texel mask rendering bounds; do not weaken tighter star/target
  tolerances from the shared-time specification.
- Run actual Skia pixel checks with the shared-time orientation path, plus the
  existing live-slider, release, residency and trajectory regressions.
- Run format, typecheck, lint, tests and build on merged main before pushing it,
  then again on the integrated cubemap branch. Build a fresh Android release.
- Inspect actual in-progress time dragging and final release with Milky Way,
  stars and a selected target/trajectory; stationary mask and smooth panorama
  geometry; pan, zoom and mode changes on representative/constrained Android
  viewports. Report measured results without claiming physical-phone speed.

Keep uploaded user photos out of commits and fixtures. Use a temporary Android
user with synthetic data, clean owned processes afterward, and push the
combined branch without merging cubemaps to main.
