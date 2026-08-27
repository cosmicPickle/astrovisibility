# Atlas Density Floor and Overlay Performance Specification

Timestamp: 2026-08-27 23:57 +03:00 (Europe/Sofia)

## Purpose

Keep sparse, deliberately filtered target sets useful at every atlas zoom level
and restore responsive Sky View navigation while the panorama and/or mask overlay
is visible.

## Scope

- Relax zoom/prominence density culling when the normal discovery result contains
  100 or fewer targets.
- Reduce the per-frame CPU and allocation cost of projecting the completed
  directional panorama and raster mask.
- Preserve the existing spherical projection, overlay alignment, opacity,
  independent visibility controls, selected-target exception, and target-label
  collision behavior.

## Target-density behavior

1. The density candidate count is the normal discovery result after category,
   debounced search, search-only classification, and selected-equipment
   suitability filters.
2. When that count is at most 100, prominence-tier and projected-size zoom culls
   are disabled. Every candidate that is in the current view or its normal
   resident overscan is available to render.
3. View-frustum culling, below-horizon handling, label collision avoidance, and
   target selection remain unchanged. "Show all" does not mean drawing targets
   geometrically behind the camera or forcing every label to overlap.
4. The selected search-only target remains the sole exception to normal
   discovery and does not change whether the 100-target density rule applies.
5. Results are deterministic for the same catalogue, filters, equipment, time,
   camera, and selected target.

## Overlay performance behavior

1. Completed panorama and raster-mask overlays continue to use the authoritative
   azimuthal-equidistant directional image and spherical planetarium projection.
2. Directional overlay tessellation uses cells no coarser than five angular
   degrees. This matches the established capture-tile mesh tolerance while
   reducing the default full-hemisphere mesh from 6,961 to 1,753 vertices and
   from 13,680 to 3,384 triangles per enabled overlay.
3. The per-frame projection loop must avoid temporary arrays and repeated generic
   min/max scans per triangle.
4. Triangle rejection around the stereographic singularity remains active so the
   previous stretched/flickering overlay failure cannot return.
5. Opacity zero still unmounts the relevant overlay. Panorama and mask remain
   independently adjustable and may be shown together.
6. No lower-resolution persisted panorama or mask is introduced; authoritative
   mask classification precision and stored user imagery remain unchanged.

## Non-goals

- No projection redesign, shader rewrite, mask contour extraction, persistence
  migration, or visual restyling.
- No change to search-only catalogue classification, list ranking, visibility
  calculations, or cache identity.

## Acceptance criteria

- Automated tests fail first for the 100-target density behavior and the bounded
  directional mesh, then pass with the implementation.
- Existing panorama horizon/singularity and target-density regression tests pass.
- Typecheck, lint, affected tests, and app build pass.
- Android visual QA covers sparse filtered targets and synthetic panorama/mask
  overlays independently and together, including panning at representative and
  constrained phone viewports.
- Work is committed and pushed directly to `main`.

## Performance and safety review

- The target relaxation is bounded by 100 normal candidates, below existing
  resident limits of 320 visible and 480 including overscan.
- The overlay change reduces hot-loop work and allocation without weakening the
  five-degree geometry tolerance used elsewhere.
- No permission, network, dependency, sensitive logging, or user-data format
  changes are introduced.
