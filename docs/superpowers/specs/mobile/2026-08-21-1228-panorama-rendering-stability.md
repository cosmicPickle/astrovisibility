# Panorama Rendering Stability

**Timestamp:** 2026-08-21 12:28 +03:00 (Europe/Sofia)
**Status:** Approved by direct product-owner instruction

## Purpose

Keep captured panorama imagery usable without allowing full-resolution camera
textures or off-screen spherical mesh triangles to destabilize the capture
atlas, Sky View, or mask editor. Remove the panorama alignment confirmation from
the active v1 flow and continue directly to mask drawing.

## Scope

- Select a supported 4:3 camera picture size near 1600 x 1200 before capture.
  Prefer the largest supported size at or below that target and use the smallest
  larger size only when no smaller option exists. The existing JPEG quality and
  silent shutter settings remain in force.
- Cull panorama tiles that cannot intersect the stereographic canvas and omit
  mesh triangles whose projected vertices cross the projection singularity or
  exceed a bounded off-canvas margin.
- Start the mask editor fitted to narrow captured coverage and cap its initial
  working view at 120 degrees for wider captures. Wider and full panoramas start
  on the first captured direction and remain reachable with the existing pan
  gesture instead of shrinking every photo into a thin strip.
- Render the flat mask-editor panorama at full opacity so overlap does not
  create translucent flashing bands. Exact stitching and seam blending remain
  out of scope.
- Keep the alignment-review implementation available behind a local feature
  constant, but disable it. The capture and resumable-draft actions complete the
  panorama atomically and navigate directly to mask editing.

## Functional and failure behavior

- If camera picture-size discovery fails, capture remains available using the
  platform-selected 4:3 size; this is a recoverable optimization failure, not a
  capture blocker.
- At least one captured tile is required before `Draw mask` is enabled.
- Completion failure leaves the durable draft available and reports the existing
  retryable error.
- Directions near the stereographic antipode never generate enormous panorama
  vertices or triangles spanning the canvas.
- Partial panoramas remain valid. Mask completion continues to make unmarked and
  uncaptured directions blocked.

## Performance and privacy

- A target capture of 1600 x 1200 bounds decoded RGBA texture memory to roughly
  7.3 MiB per tile instead of the tens of MiB used by common 12-megapixel phone
  captures.
- Off-screen tiles produce no draw indices, reducing raster and texture sampling
  work as tile count grows. Geometry work remains linearly bounded by the
  existing maximum tile count and mesh resolution.
- No new dependency, permission, network path, persistence format, or sensitive
  logging is introduced.

## Acceptance criteria

1. Picture-size selection is deterministic across malformed, smaller, exact,
   larger, and mixed-aspect availability lists.
2. The active CameraView receives the selected picture size while remaining back
   facing, 1x, and 4:3.
3. A tile centered opposite the atlas camera produces no rendered triangles;
   visible tiles retain bounded finite vertices and valid triangle indices.
4. One or a few captured tiles open at a useful fitted mask-editor scale. Wider
   and full-sky coverage opens at no more than 120 degrees and remains pannable,
   including across the north seam.
5. `Review` and `Review draft` are absent from the active flow. `Draw mask`
   completes the draft and invokes the mask-editor navigation callback.
6. Focused tests, repository quality gates, Android production build, and visual
   QA on representative and constrained Android phone viewports pass.

## Non-goals

- Perfect stitching, exposure matching, seam blending, or a generated composite
  panorama bitmap.
- Tile import, tile management, lens selection, zoom controls, or a calibration
  flow.
- Removing the dormant manual alignment-review source code.
- Changing mask semantics, storage schema, or astronomy calculations.
