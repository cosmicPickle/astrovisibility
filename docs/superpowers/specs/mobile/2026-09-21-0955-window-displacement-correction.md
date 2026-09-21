# Optional window displacement correction

**Timestamp:** 2026-09-21 09:55 +03:00 (Europe/Sofia)

**Updated:** 2026-09-21 15:30 +03:00 (Europe/Sofia)

**Status:** Implemented and verified on Android emulators; physical-device performance verification remains pending.

**Delivery:** Android application, including creation-time setup and later redefinition.

**Geometry correction:** The front-only limits and corner movement below are
superseded by [the window-sill correction](2026-09-21-1620-window-sill-geometry-fix.md),
authorized after the user reported the 160-degree stop. It preserves this flow and
data format while supporting signed plane distance and a directed opening over 180°.

## Purpose and authority

Approximate the change in a nearby window's usable opening when the telescope's
imaging lens moves around the mount's rotation axis. A panorama represents the
phone's capture viewpoint; a consistent panorama alone does not make that
viewpoint follow an offset telescope lens.

This focused extension follows the user's requested optional lens-offset field,
four-corner window editor, approximate width, and defaults. It supplements the
[product specification](../../../../astro-visibility-spec.md) and the companion
[full-frame visibility specification](2026-09-21-0955-full-frame-obstruction-visibility.md).
It adds optional geometry to local panorama/mask data without adding a third
mask classification or requiring every user to perform window setup.

## Agreed user flow

### Optics: Lens offset

Add an optional `Lens offset` field to optics setup with this short description:

> Distance from the mount's turning axis to the imaging lens. Improves window
> visibility estimates.

Represent a signed sideways distance, with explicit physical units and an
unambiguous left/right convention. A left/right choice plus nonnegative distance
is acceptable; a diagram may explain the measurement but cannot establish scale
by itself. Measure to the center of the imaging light-entry opening, not the
internal sensor or casing center. Empty means zero; explicit zero is valid.
Negative signs, unit conversion, and left/right selection must not disagree.

The first approximation uses one lateral offset. It does not ask for telescope
body dimensions, forward/back offset, or separate elevation-axis measurements.
Those omitted movements are limitations, not implied measurements.

### Panorama: Define a Window

1. Offer an optional `Define a Window` step after both the panorama and its mask
   have been created and saved. The order is panorama, completed mask, optional
   window definition. Skipping returns to the Sky View with the ordinary mask.
2. Open the existing gesture-controlled spherical panorama view. Start four
   connected handles near the center of the current image/view, outlining a
   rectangle. Initial handles are a draft, never an automatically active window.
3. Let the user move the handles to the four inside corners of the clear opening.
   Keep handles connected and constrain the underlying shape to a physical
   rectangle. Do not permit a self-intersecting or arbitrary quadrilateral.
4. Place `Approximate window width` underneath the view, with a visible length
   unit. This is the inside clear width, not the external frame width.
5. Derive height from the fitted rectangle's perspective-corrected width/height
   ratio. Do not request a second height or distance measurement.
6. Save only a valid definition. Back/cancel retains the last saved definition;
   invalid width or impossible geometry stays editable with a short explanation.

Edges and handles are anchored to the panorama's sky directions and follow the
view's projection through pan/zoom. They are not the screen-fixed FOV reticle.
An oblique physical rectangle can look trapezoidal on screen. A rectangle in
azimuth/altitude coordinates or screen pixels is not a valid substitute.

Window definition must remain optional, editable, and removable through the
existing profile/panorama management flow, without a persistent new Sky View
button. Deleting/recreating the panorama deletes its window definition as well.

The user's implementation instruction explicitly requires both entry points:

- After the initial mask is saved, offer `Define a Window` and a direct way to
  skip to the Sky View. Both continuous and manual panorama capture retain their
  normal transition into mask creation, then reach this optional step.
- With an existing panorama and completed mask, expose one action button in the
  Sky View's profile menu, matching its other management actions: `Define window`
  when absent, `Redefine window` when saved. Both open the same editor. Do not add
  separate edit/reset/remove buttons to the profile menu; those operations belong
  inside the editor. Do not require another capture or mask-creation pass to
  define the window later.
- Reopening loads the saved corners and width. Users can adjust them directly
  or use `Reset corners` to start again in the current view. Reset changes only
  the draft; saving replaces the prior definition atomically.
- `Remove window` restores ordinary mask evaluation. Preserve the original mask
  while defining, redefining, cancelling, or removing a window. Recreating the
  panorama must not be required to correct a window definition.
- Creation-time save or skip continues to the Sky View. Later save, cancel, or
  removal returns to the originating profile flow and refreshes calculations.

This ordering follows the user's explicit correction on 2026-09-21 at 14:08
+03:00; the earlier placement between panorama acceptance and mask completion
was incorrect. Window definition operates on an already completed panorama/mask
pair and does not recreate or overwrite that mask.

## Required defaults

| Inputs | Behavior |
| --- | --- |
| No window | Skip displacement/window calculations; use the ordinary mask path. |
| Window, no selected equipment | Use zero lens offset and center evaluation; do not apply optics-specific constraints. |
| Window, equipment with missing or zero offset | Use the reference viewpoint with zero displacement. |
| Window, equipment with nonzero offset | Evaluate the opening from the approximated moving lens position. |
| No completed mask | Local obstruction visibility remains unassessed, even if a window draft/definition exists. |

Frame-versus-center assessment follows the companion specification. Default zero
is a modeling assumption, not a claim that an actual telescope is centered.

## Geometry and capture reference

Model one upright, flat rectangular opening. Recover its plane, orientation,
distance, and height from its fitted corner directions and entered physical
width. The physical width supplies scale. Account for perspective; screen or
angular width/height ratios are insufficient for oblique or wide openings.

For a centered, front-facing reference fixture, the recovered perpendicular
distance must satisfy `distance = width / (2 * tan(horizontalAngularSpan / 2))`.
This fixture is not a general reconstruction algorithm for oblique windows.
Use calibrated directional rays and a constrained rectangle model, with explicit
conditioning checks and bounded work. The implementation contract below uses a
closed-form solution rather than iterative fitting. Do not claim precise distance
from an unstable fit or an inaccurate panorama.

The phone-to-mount relationship must be defined. Proposed capture guidance from
the discussion is:

> Capture with the phone's lens above the telescope's turning axis, approximately
> level with its imaging lens.

This is an approximate reference convention, not a calibration measurement.
Rotating about the phone lens reduces capture parallax but does not reproduce
the telescope's moving viewpoint. Existing panoramas cannot be assumed to have
been captured at this reference. The reference convention and existing-panorama
limitation are described in the implementation contract below.

Geometry interfaces must distinguish local east/north/up coordinates, equipment
coordinates, horizontal sky directions, image coordinates, and physical lengths.
Specify signed offset, axis origin, angle conventions, and units explicitly.

At each evaluated time, compute the lens position from the offset and physical
mount orientation. EQ and AltAz use different rotation axes. Active field
derotation changes frame orientation but leaves physical mount motion AltAz.
Do not infer physical movement solely from the displayed rectangle's rotation.

Intersect the frame's rays with the opening plane. For an opening wholly in front
of the viewpoint with a nondegenerate forward projection, the projected frame is
convex: testing its four corners against the rectangular opening is sufficient.
This shortcut applies only to this window test, not arbitrary mask obstructions.
Handle parallel rays, intersections behind the lens, grazing angles, and invalid
viewpoints explicitly; never turn invalid geometry into a clear result.

Near crossing times, refine the swept frame/window relationship under the
companion trajectory tolerances. No constant "finish ten minutes early" rule or
uniform shrinkage substitutes for the displacement calculation.

## Relationship to the binary mask

The ordinary two-dimensional mask remains authoritative for other obstructions
and uncaptured directions. Window distance is separate metadata, not grayscale,
probability, or close/medium/far values encoded into that binary mask.

The corrected window boundary must replace the contribution of the same window
at the capture viewpoint. Intersecting the new opening with an unchanged mask
containing the old window border only ever removes visibility; it cannot model
the favorable side of a displacement.

Conversely, simply erasing everything outside the old opening can remove real
walls, branches, or unrelated blocked strokes. A photograph of the near wall
does not reveal the distant surroundings behind it. Captured image coverage is
not evidence that newly exposed sky is unobstructed.

The implementation contract below defines how the user-supplied window and
interior mask obstacles are kept distinct and the assumption for newly revealed
background. Do not present that assumption as semantic recognition of an existing
flattened mask. Keep the final assessed result binary and preserve
uncaptured-direction blocking; no unknown mask state is introduced.

The mask/window presentation must allow a user to understand which boundary
governs the selected trajectory. Do not display the original phone boundary as
though it were the corrected telescope boundary without explanation.

## Persistence, lifecycle, and recovery

- Store lens offset with equipment; store the optional window with its profile's
  specific panorama revision. Preserve the fitted reference and its format version.
- Use forward-only migrations. Existing offset defaults to zero; existing windows
  are absent. Preserve all existing panoramas, masks, equipment, and profile data.
- Keep incomplete window edits in the established draft/recovery lifecycle.
  Atomic saves must not pair new corners with stale width or an unrelated panorama.
- Restart restores the last valid definition. A failed save retains the previous
  definition and allows retry. Deletion removes linked metadata coherently.
- Equipment offset, tracking mode, panorama alignment, window edits/removal, and
  mask edits invalidate dependent calculations and caches. Removing an offset
  must immediately restore zero-displacement behavior.
- No new permission, network request, remote data store, dependency, or hardware
  integration is authorized. Validate finite positive width, finite offset,
  complete corner sets, convexity, nondegeneracy, and supported numerical limits.
- Bound geometry fitting, edge tessellation, and trajectory refinement. Do not log
  images, masks, location, room dimensions, or personal paths.

## Performance and approximation limits

Fit and validate the window once per saved edit. Cache its plane/basis and bounds;
per-time work consists of small rigid transforms and ray/plane tests. Do not
reconstruct geometry, decode images, or fit a plane inside catalogue loops.
Reuse the companion task's scheduling, cancellation, cache identity, and test
workloads. Benchmark no-window, zero-offset, and nonzero-offset cases separately.

Preserve the existing physical Android target of at least 50 fps at p95 and no
interaction stall over 100 ms. Record selected-target/full-catalogue latency and
memory with and without correction; agree incremental calculation budgets before
shipping. Performance is an acceptance requirement, not an unmeasured promise.

This first approximation excludes multiple/deep window planes, wall thickness,
arbitrary foreground depth, binocular aperture placement, finite-aperture
vignetting, forward/back and elevation-axis offsets, mount flexure, and hardware
alignment errors. Panorama direction errors and handheld translation remain.
It must not claim zero false negatives or perfectly accurate obstruction times.
If required hardware motion cannot be represented by the agreed single offset,
obtain a bounded approximation decision instead of silently adding measurements.

## Verification and acceptance

Develop deterministic geometry and persistence tests before implementation:

- Front-facing analytic rectangle, oblique rectangle, unequal width/height, and
  consistent reconstruction across viewport changes, north wrap, and zoom.
- Doubling physical width doubles recovered lengths at unchanged angular corners;
  scaling both window geometry and offset equally preserves angular results.
- Zero/missing offset agrees with the reference opening; no window agrees exactly
  with the ordinary evaluator. Positive/negative offsets produce the expected
  opposite effects on synthetic window-edge crossing cases.
- Different mount modes use the intended physical motion; active derotation uses
  AltAz displacement while the companion frame follows celestial orientation.
- First frame clipping, fully blocked frame, grazing contact, invalid/behind-plane
  intersections, and rapid/brief crossings agree with independent reference cases.
- Other mask obstructions survive; old window edges are not double-counted;
  newly revealed but unobserved background is not silently treated as clear.
- Invalid/empty width, collapsed/crossed corners, poorly conditioned fits,
  interrupted edits, failed writes, restart, deletion, and legacy-data migration.
- Trajectory/list agreement and cache invalidation for every geometry input.

Use the visual-QA skill on representative and constrained Android phones: skip
the step; edit all four connected corners; pan/pinch without detaching handles;
enter width with keyboard open; save/reopen/cancel/remove; and inspect oblique
windows and corrected trajectories. Confirm touch targets and readable short copy.

Implementation delivery requires format, typecheck, lint, relevant tests, build,
geometry/performance evidence, privacy review, and the current staged Android
release APK through the build-share skill.

## Implementation contract — 2026-09-21 15:05 +03:00

The user instructed implementation to start after the background discussion and
the creation-order/menu corrections. At the start of implementation, the assistant
stated the clear-background approximation being used. The editor exposes that
assumption directly; it is not a claim of recovered photographic information.

- **Reference and offset:** use east/up/north metre coordinates, with the origin
  at the mount turning axis at imaging-lens height. Positive offset is right when
  looking out along the telescope. AltAz uses local up; EQ uses celestial north.
  EQ right is the normalized cross product of the celestial pole and pointing
  direction. At its singularity use east as the deterministic reference; retain
  conservative refinement around it. Active derotation retains AltAz movement.
  Sensor orientation does not rotate this assumed physical mount offset. The
  editor help states the capture reference and that an old panorama is only as
  suitable as its capture position. There is no fabricated position measurement
  or extra calibration screen.
- **Rectangle model:** persist the two vertical edges' azimuths, the top/bottom
  height-to-left-range slopes, the right/left horizontal range ratio, physical
  clear width, and format version. The two horizontal endpoint rays and range
  ratio determine a dimensionless width; dividing measured width by that length
  determines both ranges. Common top/bottom heights then determine the upright
  plane and height exactly. This handles oblique windows and north wrap without
  a screen-space width/height ratio or an iterative solver.
- **Linked corners:** dragging either left corner changes that row's height and
  the left edge azimuth. Dragging either right corner adjusts the range ratio
  and right edge azimuth while retaining the left edge. The connected other
  right corner follows the physical rectangle. Reject invalid moves and retain
  the last valid draft. Pan away from handles; pinch to zoom. Reset starts a new
  rectangle around the current view, without overwriting the saved definition.
- **Limits:** clear width 1–10,000 cm, signed offset at most 10,000 mm in magnitude,
  angular width 0.1–160 degrees, range ratio 0.05–20, absolute slopes at most 100,
  slope-height difference at least 0.001, plane distance at least 0.001 times the
  width. Finite inputs are required. Contact tolerance is 0.0000001 metres;
  parallel/behind-plane intersections are blocked. Limits reject unstable
  geometry rather than silently claiming a successful definition.
- **Mask interpretation:** retain the original bitmap unchanged. Within the
  reference opening preserve its blocked pixels; outside it let the separately
  defined window supply the nearby boundary. Newly revealed background is
  assumed clear only within captured coverage. This does not identify hidden
  buildings or trees. Removing or redefining the window uses the original mask,
  so no destructive reinterpretation is persisted. Prepare a separate derived
  raster in bounded 16,384-pixel chunks with event-loop yields, only when loading
  a defined window. No image decoding or reconstruction occurs in target loops.
- **Persistence:** migration 11 adds a zero-default signed equipment offset and
  a window table keyed to the panorama revision with cascading deletion. Window
  save requires the active completed mask and is atomic. Width and corners are
  one validated record. Failed saves and Cancel retain the previous definition;
  unsaved edits follow the mask editor's in-memory draft lifecycle. Restart
  restores the last saved definition. Save/remove invalidate derived cache data;
  all geometry and offset values are also included in calculation cache identity.
- **Visibility and rendering:** trajectory, list, and instant count use the same
  classifier. A blocked center can reject a full-frame window check early; a
  clear center never substitutes for its four-corner test. Refinement bounds
  lens travel over the current time interval, uses the full offset diameter near
  mount singularities, and retains 30-second/0.05-degree tolerances. The yellow
  outline shows the opening at the selected target's lens position. Overlay
  controls explain that the photograph retains the phone's original viewpoint.
- **Performance verification:** retain the five-second reference desktop
  catalogue guardrail, with hosted-CI allowance as in the companion task. Measure
  absent-window, zero-offset, and nonzero-offset 2048-square workloads separately.
  Physical-device frame timing remains a separate required acceptance check.
