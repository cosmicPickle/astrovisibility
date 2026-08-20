# DSO Atlas Population and Imaging Suitability Correction

**Timestamp:** 2026-08-20 17:57 +03:00
**Status:** Approved by direct owner instruction on 2026-08-20

## Purpose

Correct the Sky View catalogue population without changing the accepted camera,
gesture, stereographic projection, ground, trajectory, panorama, mask, or field-
of-view geometry. Deep-sky objects must enter and leave the atlas predictably
during continuous pan and zoom, never appear only after release or a later
gesture, and never leave a visible region empty because catalogue work used an
older camera.

Correct equipment suitability at the same time: a target that merely fits in a
sensor frame is not necessarily a useful imaging target. Known-size targets must
span at least 60 sensor pixels across their minor axis.

## Confirmed defects

- The UI-thread camera moves immediately, while React reselects catalogue rows
  from a delayed camera anchor.
- The current query scans and sorts the catalogue during gesture previews, then
  globally truncates it to 120 rows. A dense region can consume the cap and hide
  another visible region.
- Candidate membership, projected positions, and label collision decisions are
  mixed in one React calculation even though Skia projects mounted objects from
  the live camera.
- The retained Stage 0 synthetic SVG renderer and its unreachable proof screen
  are obsolete and make renderer ownership unclear.
- Equipment suitability accepts a known-size target at only eight sensor pixels
  across its minor axis. This admits targets such as a roughly nine-pixel
  planetary nebula even though its detail is not meaningfully resolved.

## Production ownership

- `PlanetariumScene` remains the only production atlas renderer.
- The live shared camera remains the sole authority for screen projection,
  visibility, grid registration, hit geometry, and movement.
- React may publish immutable catalogue data but must not publish projected
  target positions or write camera state.
- The obsolete synthetic renderer, technical-proof screen, and any exclusively
  owned legacy navigation code are removed when repository reference checks
  prove they are unreachable.

## Resident catalogue model

At each observation instant, build a stable ID-keyed spherical index over the
horizontal target directions. Catalogue membership is managed as a resident
set rather than a one-frame viewport query.

- The resident region covers the visible stereographic viewport plus a broad
  directional guard band sufficient for ordinary held movement.
- Neighbouring spatial cells are selected before they cross the visible edge.
- When the resident region must move, publish the union of the previous and next
  sets first. Remove old rows only after the replacement is available, and never
  remove a row that is visible in the current camera.
- Bound work with per-cell quotas and deterministic prominence/magnitude/name
  ordering. Do not apply one global priority truncation before spatial coverage.
- Keep the selected target resident regardless of prominence, angular-size
  threshold, or current guard-band membership.
- Catalogue refresh cannot update camera state. Gesture release cannot trigger a
  second, visibly different population transaction.
- Marker membership and label membership are separate. Underlying DSO marks may
  remain resident while labels are independently limited and collision-filtered.
- Labels move with their target from the live camera. Collision membership may
  be refreshed after a settled camera update, but it cannot move an underlying
  mark or make the mark wait for release.

The exact resident guard band and per-cell bounds are implementation constants
validated with the full 13,371-row catalogue and emulator frame measurements,
not user-facing behavior.

## Angular-size rendering

For known-size targets, derive the projected minor-axis diameter from the
current stereographic zoom's centre plate scale. Using the centre scale avoids
letting the strong magnification near a stereographic edge make an otherwise
unreadable object enter only at that edge. The rendered outline itself still
uses the exact local projection scale at the target's spherical direction.

- Known-size targets whose projected minor axis is below the atlas readability
  threshold are excluded before Skia nodes are mounted.
- Unknown-size targets continue to use prominence and magnitude rules.
- The selected target is always retained.
- A rendered outline uses its real projected angular dimensions; a tiny target
  is not inflated into a misleading minimum-size physical outline.
- Touch hit size remains an independent accessibility target and does not imply
  that the astronomical object itself is physically that large.

The atlas threshold is a screen-presentation rule and remains separate from the
equipment sensor-pixel rule below.

## Equipment suitability

For known-size targets and selected equipment:

1. The target's long and short angular axes must fit within 90% of the sensor
   frame, allowing portrait or landscape orientation as before.
2. The target's angular minor axis divided by the setup's image scale must be at
   least **60 sensor pixels**.
3. Targets below 60 pixels are excluded before expensive trajectory and mask
   calculations.
4. Explanations report the calculated minor-axis pixel span and the 60-pixel
   requirement. They must not describe frame fit alone as optical suitability.
5. Unknown angular sizes remain included but explicitly unassessed, preserving
   existing product behavior.

No persistence, equipment schema, or migration change is required.

## Compatibility and non-goals

- Preserve target coordinates, catalogue identity, current observation instant,
  selected target, target trajectory, panorama/mask alignment, ground/cardinals,
  field-of-view reticle, and target-list ranking after suitability prefiltering.
- Preserve no-mask versus completed-partial-mask semantics.
- Do not change the accepted pan/pinch camera math or initial camera.
- Do not add a dependency, network service, account, permission, schema, or
  native module.
- Do not add photorealistic DSO imagery.

## Test-first acceptance criteria

- A deterministic horizontal sweep across multiple resident regions has no
  frame where a target geometrically inside the viewport is absent while it is
  eligible at that zoom.
- Rapid reverse pans preserve the union until replacement and do not produce an
  empty or stale edge.
- Gesture preview and release at an identical camera produce identical eligible
  target IDs.
- Spatial quotas preserve coverage in multiple visible cells even when one cell
  contains more candidates than the total historic cap.
- Catalogue work does not write or reconcile the live camera.
- Selected targets remain available outside normal size/tier/resident filters.
- Known-size targets below the atlas screen-size threshold are omitted; targets
  above it and unknown-size prominent targets remain eligible.
- Equipment tests reject 9 px and 59.9 px minor axes, accept 60 px, retain the
  90% maximum-frame rule, and retain unknown-size inclusion.
- The production catalogue benchmark is bounded and materially avoids a full
  scan/sort on every pointer update.
- Root format, typecheck, lint, affected/full tests, and build pass.
- Exact Android release visual QA covers sustained horizontal pan, immediate
  reverse pan, zoom-tier changes, dense DSO regions, target selection, normal
  and constrained phone viewports, and checks for late, sporadic, edge-only,
  missing, or detached targets.

## Privacy and security

The change processes only the bundled catalogue and existing local equipment
parameters. It adds no logging of profile coordinates, device identifiers,
panoramas, masks, or filesystem paths and introduces no new import or dependency
surface.
