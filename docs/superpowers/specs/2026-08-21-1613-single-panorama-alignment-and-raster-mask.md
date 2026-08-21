# Single Panorama Alignment and Raster Mask

**Timestamp:** 2026-08-21 16:13 +03:00
**Status:** Approved by direct human instruction

## Purpose

Make manual tile alignment understandable and keep capture-time tiles out of the
completed profile. A completed profile owns one directional panorama image and
one binary obstruction-mask image, so neither the editor nor Sky View can expose
tile overlap seams, tile selection decoration, or raw brush-operation layers.

## User flow

1. Capture Panorama remains a resumable, sensor-aligned tile draft.
2. Capture Panorama exposes `Align Tiles` once at least one tile exists.
3. `Align Tiles` opens a dedicated spherical atlas view. Phone orientation does
   not move this view; drag and pinch gestures use the same planetarium navigation
   model as Sky View.
4. All draft tiles are overlaid on the atlas and can be selected by tapping.
5. A selected tile is adjusted with a four-quadrant donut control containing only
   up, down, left, and right arrows. Each press changes altitude or azimuth by one
   degree and persists immediately. Roll remains sensor-derived and is not exposed
   in this simplified control.
6. `Back to camera` returns to the existing draft and permits more captures.
7. `Use panorama` rasterizes the current tile placements into one immutable image,
   activates it, removes the draft tile files, and opens masking. Captures cannot
   be added afterward; recreation deletes the panorama/mask pair and starts over.
8. The mask editor paints blocked obstacles and erases them with a hard-edged brush.
   Completion writes one binary directional mask image. No raw strokes or tile
   decoration are rendered in Sky View.

## Directional image format

- Panorama and mask use a 2048 by 2048 azimuthal-equidistant upper-hemisphere
  atlas: zenith is the centre, north is the top, east is the right, and the horizon
  is the circle edge.
- Panorama pixels outside captured coverage are transparent.
- The mask image is binary: an opaque pixel means blocked and a transparent pixel
  means visible. Uncaptured directions are written blocked. User-painted obstacles
  are written blocked; erasing inside captured coverage restores visible.
- Panorama and mask use the same mapping and dimensions. One pixel is at most
  0.088 degrees radially and approximately 0.176 degrees tangentially at the
  horizon. This is finer than the minimum practical touch brush.
- PNG is used because both assets require deterministic alpha and the mask must
  remain lossless and binary.

## Rendering and classification

- The mask editor shows the single panorama atlas directly. It does not project
  photo rectangles through a sphere on every frame.
- Sky View maps one panorama texture and one mask texture onto the hemisphere.
- The mask texture is tinted one neutral light gray at the selected opacity.
- Visibility evaluation samples the decoded binary mask atlas. It does not replay
  finger paths or infer a one-dimensional horizon. Segment refinement remains
  conservative at raster-cell boundaries.

## Persistence and migration

- Draft tiles remain local files only while capture/alignment is unfinished.
- A completed panorama revision references exactly one PNG file plus its fixed
  projection metadata.
- A completed mask revision references exactly one PNG file plus its fixed
  projection metadata.
- Existing panorama/mask revisions and capture drafts are invalid under this
  representation and are deleted by the forward migration, as explicitly approved.
- Saving is failure-safe: source draft files remain until the composite file and
  database activation complete. Failed mask saves leave the previous active mask
  intact.

## Acceptance criteria

- Capture has an `Align Tiles` action and never completes directly from the shutter
  screen.
- Alignment is a separate gesture-controlled spherical screen with clickable tiles,
  the four-arrow donut, `Back to camera`, and `Use panorama`.
- Reopening capture after accepting is rejected until the panorama/mask pair is
  deleted.
- The mask editor stays spatially stable through pan/zoom and displays one composite
  panorama without overlapping photo slices.
- Completing a mask produces one binary image; Sky View displays one continuous
  neutral mask overlay without tile borders or raw red finger strokes.
- Visibility classification comes from the binary raster, including blocked
  uncaptured directions and narrow separate obstructions.
- Persistence restart, recreation/deletion, targeted tests, repository quality
  gates, Android visual QA, release APK build, commit, and direct push to `main`
  succeed.

## Non-goals

- Automatic seam blending, exposure matching, feature matching, or tile warping.
- Adding tiles after panorama acceptance.
- Polygon/vector extraction from the raster mask.
- Backward compatibility for existing panorama, mask, or unfinished capture data.
