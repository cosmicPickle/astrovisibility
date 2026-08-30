# Sky Visuals and Mask Modes

**Timestamp:** 2026-08-30 10:34 +03:00 (Europe/Sofia)

## Status and authority

Approved for implementation by the product owner in the current task. This
focused specification supplements the registered-sky specifications and directly
supersedes the older Sky View requirement for independent panorama and mask
opacity controls. Panorama capture, alignment, and mask editing behavior are not
changed.

## Purpose

Make the registered sky read as a smooth, luminous astronomical view while
preserving responsive mobile interaction. Show useful survey imagery for every
nearby bundled deep-sky object in the current view, permit inspection at much
closer zoom, expose constellation opacity, and prevent the dark sky contained in
a panorama from covering the rendered sky.

## Scope

- Improve the visual treatment of registered stars, the Gaia Milky Way atlas,
  and Western constellation figures.
- Reduce the minimum camera field of view from 8 degrees to 0.25 degrees.
- Render all bundled DSO survey images that are close enough and intersect the
  current camera view, not only the selected DSO.
- Add the selected target's approximate minor-axis pixel coverage when an optics
  configuration is selected.
- Replace the independent Sky View panorama and mask appearance controls with a
  mask mode, optional mask color, and one shared mask-opacity control.
- Adopt a bounded mobile color-picker package for the approved color choice.

## Non-goals

- Do not change catalogue membership, survey assets, target coordinates, mask
  drawing semantics, panorama capture/alignment, or trajectory calculations.
- Do not add a runtime network source, service, cache, analytics path, or new
  platform permission.
- Do not apply full-canvas blur or create one React/Skia component per star.
- Do not persist these display-only controls in v1; like the existing opacity
  controls, they are session state for the mounted Sky View.

## Functional requirements

### Registered sky

1. Each existing batched star path receives one low-opacity blurred halo pass and
   one higher-intensity core pass. Star positions and batched selection remain
   unchanged.
2. The deterministic Gaia request is reduced from 2048 x 1024 to 256 x 128 so
   the source service performs an offline low-pass resample of the survey noise.
   The atlas also uses trilinear-style linear mipmap sampling when scaled down.
   Its wide-field maximum opacity increases to approximately 0.5, while it fades
   at very narrow fields so detailed DSO imagery remains legible.
3. Constellation lines use a 1.5-pixel stroke and a fainter default opacity of 30
   percent. A 0-100 percent Constellation opacity control governs figures and
   their labels.
4. Pinch and button zoom may reach a 0.25-degree vertical field of view. Existing
   camera clamping and numerical stability remain in force.

### DSO survey images

1. The app prepares registered meshes for all 289 bundled physical DSO image
   records when observer/time-dependent registration changes.
2. During camera interaction it performs a bounded pure visibility pass over
   those meshes and renders every image whose angular footprint intersects the
   view and whose zoom-dependent opacity is non-zero.
3. No arbitrary object-count cap may hide an otherwise eligible in-frame image.
   Only intersecting images mount image-decoding/render nodes.
4. The selected object remains visually prioritized by draw order and the
   existing selection overlay, but selection is not required for imagery.
5. Survey images remain offline, registered to their recorded ICRS footprint,
   and are drawn beneath panorama/mask presentation and vector targets.

### Selected-target optics summary

When a target and optics configuration are selected, the summary displays
`About X px along minor axis` immediately below the obstruction-derived visible
duration. `X` uses the existing equipment-suitability calculation and is rounded
for display. No estimate is shown when the required angular dimension or optics
configuration is unavailable.

### Mask presentation

1. Sky View exposes `Mask mode: Panorama | Color` as a segmented choice.
2. `Panorama` is the default when the profile has a completed mask and aligned
   panorama. It draws the panorama only through blocked pixels of the completed
   binary mask. Visible-sky pixels remain transparent so the registered sky is
   not covered.
3. `Color` draws the chosen solid color only through blocked mask pixels. The
   default color preserves the current blocked-region visual character.
4. The color picker is shown only in Color mode and updates the sky after a
   completed color gesture, avoiding high-frequency scene reconstruction during
   dragging.
5. One `Mask opacity` control, 0-100 percent and defaulting to 60 percent,
   controls the resulting clipped panorama or color layer.
6. The former independent panorama opacity control and standalone panorama
   presentation in Sky View are removed. Panorama capture, alignment, preview,
   and mask-editor surfaces continue to show the full panorama where required.
7. A profile without a completed mask shows neither presentation; it does not
   imply known obstruction visibility.

## Rendering and performance design

Layer order is: base sky, Gaia atlas, stars, constellations, DSO imagery,
mask-mode presentation, trajectories, vector targets, labels, and selection UI.

- Star glow adds one draw pass per existing magnitude/color batch, not per star.
- Gaia smoothing uses a smaller deterministic source atlas plus texture
  sampling/mipmaps; no dynamic full-screen blur or generated texture is
  introduced. The smaller texture lowers runtime memory and transfer work.
- The DSO registration workload is 289 x 25 projected vertices only when the
  observing registration changes. Camera updates scan 289 mesh bounds and mount
  only intersecting images.
- Panorama mode clips the already-prepared panorama atlas/tile group once using
  the existing mask alpha image. Color mode clips one solid paint layer through
  the same mask.
- Existing resident-camera throttling and the 50 fps p95 physical-device target
  remain controlling. The implementation must not add synchronous file or
  network work to gesture paths.

## Dependency decision

Adopt `reanimated-color-picker` 5.1.2 in `apps/mobile`. As reviewed on
2026-08-30, it is MIT licensed, pure JavaScript, has no runtime dependencies,
and is actively/popularly used. Its required React Native Gesture Handler and
Reanimated peers are already present in compatible newer versions. It adds no
native permission, service, data collection, runtime network path, or storage.
The picker is loaded only in the Mask appearance sheet. Existing-platform
controls and a custom picker were rejected because React Native supplies no
equivalent full color picker and a bespoke gesture/color implementation would
carry more accessibility and maintenance risk.

## Verification and acceptance

- Add failing unit tests for the 0.25-degree zoom clamp, DSO intersection and
  opacity selection, mask-mode presentation inputs, and optics-summary copy.
- Add component tests for mask mode, picker visibility, shared opacity, and
  constellation opacity wiring.
- Run format, typecheck, lint, the focused/complete relevant test union, and
  build in final-state order.
- Validate package licence/advisory state and ensure lockfile changes are limited
  to the adopted package.
- Inspect the rendered Sky View on a representative Android phone viewport and a
  constrained phone viewport. Verify glow, smooth Gaia downsampling,
  constellation opacity extremes, close zoom, multiple simultaneous DSO images,
  both mask modes, and selected-target summary layout.
- Confirm no unexpected interaction regression or obvious frame instability;
  physical 50 fps p95 evidence remains the existing open device-validation task
  if no representative physical device is connected.
