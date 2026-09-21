# Optional window displacement correction

**Timestamp:** 2026-09-21 09:55 +03:00 (Europe/Sofia)

**Status:** Specification for review; agreed scope recorded, geometry and mask integration decisions listed below.

**Delivery:** Android application implementation is a subsequent task.

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

1. Offer an optional `Define a Window` step after the panorama is accepted and
   before mask completion. Skipping continues the normal mask workflow.
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
Use calibrated directional rays and a constrained rectangle fit, with explicit
conditioning checks and bounded iteration. Do not claim precise distance from
an unstable fit or an inaccurate panorama.

The phone-to-mount relationship must be defined. Proposed capture guidance from
the discussion is:

> Capture with the phone's lens above the telescope's turning axis, approximately
> level with its imaging lens.

This is an approximate reference convention, not a calibration measurement.
Rotating about the phone lens reduces capture parallax but does not reproduce
the telescope's moving viewpoint. Existing panoramas cannot be assumed to have
been captured at this reference. Resolve their eligibility and the EQ reference
convention before implementation; see the decisions below.

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

Before implementation, decide how window-owned obstruction and other mask data
are kept distinct, and what remains blocked when displacement reveals directions
whose background was hidden. Never infer semantic ownership from an existing
flattened mask or silently mark unseen background clear. Keep the final assessed
result binary and preserve uncaptured-direction blocking. This is a required
integration decision, not permission to add an unknown mask state.

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
release APK through the build-share skill. This documentation task does not
require app gates or an APK.

## Decisions to settle before implementation

1. **Physical reference and equipment convention:** define signed sideways offset
   from the user's viewing perspective, the scalar-offset kinematics for EQ,
   singularity handling, and the capture reference shared by the modes. Decide
   how to handle an existing panorama captured elsewhere without inventing its
   original position or adding unapproved measurements.
2. **Window/mask ownership and unseen background:** choose the minimal storage and
   editing behavior that separates the replaceable window boundary from unrelated
   blocks, preserves existing user masks, and defines safe behavior for revealed
   background. The current flattened binary mask cannot supply that distinction.
   Any assumption that hidden background is clear needs explicit human approval.
3. **Constrained corner editing and limits:** specify how dragging each handle
   adjusts the fitted physical rectangle, how fitting failure is presented, and
   the supported width/offset ranges, geometric tolerances, and fit rejection
   threshold. Do not enforce a screen rectangle that prevents oblique windows.

These are implementation prerequisites within the agreed optional feature, not
additional approved calibration screens. Resolve them in this specification
before dependent production work.
