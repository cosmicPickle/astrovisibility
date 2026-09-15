# Cube-map background renderer

**Timestamp:** 2026-09-14 12:48 +03:00 (Europe/Sofia)
**Status:** Implementation authorized; merge requires the owner's inspection.
**Branch:** `feature/cubemap-background-renderer`, based on `63c87a6`.

**Integration update, 2026-09-14 14:16 +03:00:** The owner approved merging the
shared-time optimization branch into main and main into this branch. The
[integration specification](2026-09-14-1405-cubemap-time-integration.md)
supersedes the earlier exclusion of that branch. Milky Way orientation now
uses its shared renderer time, retaining the tested cube projection/refraction.

Replace the Milky Way and saved panorama/raster-mask background meshes with
Skia runtime shaders sampling baked cube faces. Preserve stars, constellation
figures, DSO cutouts, targets, trajectories, navigation and layer order. The
other unmerged celestial-time branch is outside this task.

## Behavior and ownership

- Preserve the current mask color/panorama modes. Panorama mode is clipped to
  the mask and photographic coverage; color mode does not need photo sampling.
  The standalone image path remains available to capture preview/mask editing.
- Keep source panoramas, binary masks and visibility calculations unchanged.
  Cube images are derived in-memory render resources, rebuilt on source changes
  and released with their consumers. No migration, new dependency, permission,
  upload, cache files or automatic merge.
- Bake six padded faces with the existing Skia library. Use bounded image sizes
  and serialize preparation to avoid concurrent large temporary allocations.
  Never rebake for pan/zoom or merely for a time change. The celestial cube is
  fixed in J2000; the local cube is fixed in east/up/north.
- Source image and render failure must not silently drop an obstruction or
  replace saved user data. Preparation retains the exact inverse-projected
  source rendering until a cube is ready; errors keep that functional rendering.
  Both paths replace the mesh and preserve the same directional equations.
- Legacy vector masks retain their authoritative paths. Individual capture
  tiles and DSO image meshes are outside the saved-background replacement.

## Geometry and accuracy

- Reuse the camera's stereographic projection (0.25..235 degree FOV), including
  zenith, nadir, north wrap, camera roll and constrained aspect ratios.
- A frame updates only camera basis/scale and small orientation uniforms; no
  background vertex arrays are projected or reconstructed.
- J2000 orientation comes from Astronomy Engine at the existing scene instant.
  Inverse normal refraction must remain consistent with the other celestial
  layers. A bounded lookup may replace runtime trigonometry only after tests
  quantify its error against the authoritative adapter.
- Verify cube face/edge/corner orientation against independent directions;
  preserve Milky Way RA origin 6 h, decreasing to the right, north at the top.
- Check Milky Way registration across seasons/latitudes, pole/zenith/north and
  horizon against the authoritative projector, with conversion error below
  0.01 degree (well below its source texel). Do not treat photographic features
  or existing coarse meshes as authoritative astrometry.
- Check mask alpha and photograph registration with independent synthetic
  source patterns, gaps, narrow blocked/visible strips, edges crossing cube
  faces, horizon, upward views and outside-coverage directions. Bound the
  resampling displacement to one source texel; increase render resolution or
  retain exact source sampling at boundaries if necessary. Never change binary
  visibility classification to match a rendered approximation.

## Verification and review

Test geometry and lifecycle first, including source replacement, failed bake,
unmount, mask mode changes and alpha coverage. Exercise actual Skia shader
compilation and rendering, not only a TypeScript mirror. Run format, typecheck,
lint, the affected test suites and build, then build a fresh branch release APK
using the build/share skill.

Visually inspect representative and constrained Android viewports using only
synthetic/public fixtures. Compare identical baseline/branch pan workloads,
report frame percentiles, layer state, memory and device. Emulator evidence is
diagnostic; physical-phone performance and merge acceptance belong to the
owner. Keep the branch unmerged whether or not the emulator result improves.

## Implemented resource and accuracy choices

Faces use a 3 by 2 atlas with two-pixel gutters: 512 pixels per Milky Way face
(1548 by 1032 RGBA, approximately 6 MiB), and 1024 per local image/mask face
(3084 by 2056 RGBA, approximately 24 MiB each). The combined panorama/mask
therefore retains roughly 54 MiB of cube pixels alongside the original images;
native raster copies, GPU uploads and temporary surfaces can increase actual
memory. These are render caches, not persisted replacements or export formats.

Cube resampling alone lost thin mask details in the first pixel test. Mixed
alpha pixels now use the original mask's exact directional lookup. Solid mask
regions retain the cube fast path. The test bounds residual edge displacement
to one source texel and checks narrow blocked and visible strips; this is a
sampled rendering tolerance, not a change to binary visibility accuracy.

Normal refraction uses a universal 4096 by 2 opaque RG16 coefficient table
(32 KiB). Preparation uses 40 bounded bisection iterations against Astronomy
Engine's forward refraction model because its inverse helper can fail to
converge at sub-ULP tolerance. The table is independent of user location/time.

Android preparation and the native Canvas have separate graphics contexts.
Each completed bake is copied to a transferable raster image before disposing
the temporary texture/surface. The Canvas uploads it once. Native QA caught
and fixed a blank-background failure when this transfer was missing; a
regression test verifies transfer and resource disposal.

Performance acceptance remains an owner decision on the physical phone. The
software-rendered emulator checks correctness and supplies diagnostic timing
and memory comparisons, not a promise that cube sampling beats the old mesh.
