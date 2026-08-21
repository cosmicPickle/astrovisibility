# Stable Projected Obstacle-Mask Editor

**Timestamp:** 2026-08-21 13:58 +03:00 (Europe/Sofia)

**Status:** Approved by direct product-owner instruction

## Purpose

Make panorama-backed mask editing predictable and direct. Rectilinear camera
images must remain aligned while panning and zooming, and the user must paint
obstacles rather than construct visible-region polygons.

## Projection decision

The editor uses an azimuthal equidistant hemisphere projection: zenith is the
center, the horizon is the circle edge, and azimuth runs around the circle. This
has no north seam and no zenith singularity. Each source photograph is no longer
displayed as a cropped SVG rectangle. Instead, its calibrated rectilinear camera
projection is sampled as a bounded triangle mesh and every mesh vertex is
projected into the hemisphere disk.

This removes the inconsistent rectangle-to-rectangle approximation while
keeping pan/zoom interaction. Mesh texture coordinates remain fixed to the
photograph, so zoom changes only the common sky projection and cannot
independently squeeze or overlap image slices.

## Mask interaction

- Captured directional coverage is the visible base of a new mask.
- `Draw` paints blocked obstacle strokes.
- `Erase` paints ordered visible correction strokes over blocked strokes.
- `Brush size` is one continuous screen-space control. The selected screen
  radius is converted to an angular radius when each stroke is committed.
- Drawn obstacles appear immediately over the panorama in bright red with
  fully hard edges: no blur, feathering, dashed outline, polygon outline, or
  translucent blue visible-region fill.
- One-finger drags draw or erase. Two-finger drags pan and pinches zoom, so a
  separate pan tool is unnecessary.
- Back and completion remain workflow actions, not drawing tools. Existing
  completion error recovery and local persistence remain in force.

## Persistence and visibility semantics

The existing version-1 operation schema is retained. For a new mask, each
captured coverage polygon is stored as an internal visible base operation.
Blocked and visible stroke operations are then evaluated in order. Directions
outside captured coverage remain blocked. This avoids a schema migration and
keeps saved masks compatible with the existing trajectory evaluator.

## Acceptance criteria

1. Panorama texture vertices and mask points use the same hemisphere-circle
   projection, with no discontinuity at north or zenith.
2. At two-times zoom, projected angular distances scale by two without changing
   texture topology, aspect by arbitrary SVG cropping, or tile ordering.
3. The editor exposes Draw, Erase, and Brush size controls; polygon, pan-tool,
   before/after, per-operation removal, reset, undo, and redo controls are absent.
4. New masks contain visible coverage bases automatically and can be completed
   with zero painted obstacles.
5. Draw commits `blockedStroke`; Erase commits `visibleStroke`; both persist the
   brush radius derived from its screen size at the current zoom.
6. The editor preview composites ordered strokes as a hard-edged bright red
   obstacle mask, with erase strokes removing red.
7. Focused tests, repository quality gates, and Android visual QA at normal and
   constrained phone viewports pass.

## Non-goals

- Panorama stitching, exposure blending, seam removal, or generating a composite
  bitmap.
- Changing capture pose, camera selection, or field-of-view calibration.
- Adding dependencies or changing the database schema.
