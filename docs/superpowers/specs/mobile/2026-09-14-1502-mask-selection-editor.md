# Directional mask painting and connected selection

Timestamp: 2026-09-14 15:02 +03:00 (Europe/Sofia)

## Purpose and authorization

The owner requests manual and magic brush modes, navigation using the same
directional view as the Sky View, and two compact centered rows of controls.
Implement on the existing `feature/cubemap-background-renderer` worktree, which
already includes the approved time-rendering optimizations. This task does not
authorize merging the cubemap experiment into main.

The root product specification applies with the owner's established obstacle
painting semantics: draw blocks, erase exposes captured sky, and uncaptured
directions remain blocked. The existing binary mask format and panorama
registration remain authoritative and unchanged.

## Behavior

- Manual painting retains a round brush whose displayed size is in screen
  pixels. Zooming permits finer edits, including at north wraparound and zenith.
- Magic painting grows connected, similarly coloured regions from positions
  touched by the brush. Drawing blocks those regions; erasing exposes them.
  Selection is bounded by captured coverage and image colour boundaries.
  Disconnected matching regions are not selected merely because their colours
  match. Similar surfaces and weak edges may still need manual correction.
- A tap must work as well as a stroke. Navigation must never commit a paint
  stroke when a second finger joins or when a gesture is interrupted.
- Keep the panorama and mask aligned using the existing stereographic camera
  and original directional atlas. No panorama regeneration or data migration.
- Row one: decrease, clickable `Brush size: N px`, increase. The label opens
  the existing fine-adjustment slider. Buttons step through 8, 12, 16, 24, 32,
  48, 64, and 72 pixels, clamped at the endpoints.
- Row two: grouped draw/erase icons and grouped wand/hand icons, with accessible
  labels and explicit selected states. Both rows are centered.
- Use the owner's two-finger navigation option. After asking for optional
  clarification, proceed with the stated interpretation: hand means manual
  painting and wand means automatic painting; both use two fingers to navigate.

## Implementation constraints

Reuse the already approved OpenCV Android package for connected selection,
with a separate cohesive Expo editor module running offline on its worker thread.
Cache only the current decoded panorama while
editing; bound image dimensions, input byte lengths, seed count and output size.
Do not add permissions, dependencies, remote processing or sensitive logging.
Keep the image-processing implementation separate from stitching orchestration.

Preserve chronological manual/magic edits and the existing revision-save
transaction. A failed selection must not change the draft; failed save retains
edits. Cancel pending work on editor exit and reject stale results. Release
decoded images and temporary selection resources when leaving the editor.
Maintain original mask resolution; no downsampling of narrow obstacles. Manual
painting projects original texel centres onto the captured screen camera and
tests their distance from the brush path using screen-space segment bins. A
conservative source rectangle bounds the scan: inverse stereographic angular
speed is at most 2 / projection scale, and the upper-hemisphere azimuthal map's
maximum geodesic stretch is the atlas radius. Long segments subdivide only
their search bounds; final pixel classification remains exact. Magic
painting uses that same footprint to seed OpenCV four-connected fixed-range Lab
flood fills (24 luminance, 12 per colour channel in OpenCV's 8-bit Lab encoding).
The brush therefore affects touched areas and selection growth beyond them.
Bound one stroke to 4096 points, 512 distinct flood fills and a five-second
native work deadline checked between scan rows and region operations. A too-detailed
automatic selection fails without changing the draft; smaller/manual brushes
remain available. During commit, retain the screen stroke and briefly prevent
further paint/navigation until its original-resolution result has arrived.
Only the unchanged photo is cube-baked; the changing mask samples its original
alpha raster, avoiding repeated cube preparation for every edit.

OpenCV contract reference:
https://docs.opencv.org/4.13.0/d7/d1b/group__imgproc__misc.html

## Verification and acceptance

- Synthetic native image checks cover connected boundaries, disconnected equal
  colours, multiple seeds, transparent gaps, invalid inputs and cancellation.
- Geometry tests cover north/360, zenith, horizon, zoom, and camera rotation;
  displayed and saved brush boundaries agree within one original mask texel.
- Screen/controller tests cover manual/magic draw and erase ordering, brush
  steps/slider, recoverable failures, saving/reopening and stale results.
- Android gesture checks cover tap, stroke, two-finger navigation, switching
  tools, interruptions and safe areas on normal and constrained phone sizes.
- Run format, typecheck, lint, relevant tests, build and native checks. Inspect
  actual mask alignment and processing responsiveness using synthetic images;
  report measurements and physical-device limitations without promising speed.
