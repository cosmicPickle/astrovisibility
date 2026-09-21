# Full-frame obstruction visibility

**Timestamp:** 2026-09-21 09:55 +03:00 (Europe/Sofia)

**Status:** Implementation authorized by the user on 2026-09-21; implementation contract recorded below.

**Updated:** 2026-09-21 +03:00 (Europe/Sofia)

**Delivery:** Task one Android implementation, regression checks, visual QA and local release APK.

## Purpose and authority

When optics are selected, predict when the entire imaging frame clears local
obstructions. A clear target center must not imply that an image containing a
wall, roof, or branch is usable.

The user explicitly selected full-frame evaluation and three tracking choices.
This supersedes the center-only allowance in sections 8.1 and 18 of the
[product specification](../../../../astro-visibility-spec.md) for selected
optics. Other product invariants remain in force.

The companion [window displacement specification](2026-09-21-0955-window-displacement-correction.md)
adds an optional geometric obstruction. This task must also work independently
with ordinary panorama masks and no window.

## Agreed scope

- Selected optics: classify the complete rectangular imaging footprint.
- No selected optics: retain center-point evaluation and omit optical suitability
  filtering, as required by the product specification.
- Reuse the beginning frame-orientation control and expose three simple choices:
  `AltAz`, `EQ`, and `AltAz + field rotator`.
- Use the same authoritative results for selected-target trajectories, transition
  labels, all visibility intervals, total usable duration, and target-list ranking.
- Keep setup short, calculations bounded, and the Sky View uncluttered.

This does not implement hardware control, telescope connections, automatic
framing detection, arbitrary rotator schedules, depth painting, or the companion
window editor. It does not automatically stop exposures or schedule a telescope.

## Tracking and orientation contract

| Choice | Idealized behavior |
| --- | --- |
| AltAz | A rigid frame tracks with the local mount; away from coordinate singularities, its roll is fixed relative to the local altitude/azimuth tangent basis. |
| EQ | A rigid frame retains its celestial position angle while its orientation relative to local obstructions changes. |
| AltAz + field rotator | Active field derotation retains the celestial position angle; physical mount motion remains AltAz. |

The third choice means active compensation during tracking. A motorized rotator
used only to choose an initial angle does not qualify. In the idealized model,
EQ and active derotation can share frame-orientation calculations but must retain
distinct physical-mount identities for window displacement.

Initial orientation must have an explicit reference direction and, when needed,
reference target and UTC instant. A screen-relative reticle rotation alone is
not an astronomical orientation. Panning, zooming, device rotation, or changing
the displayed time must not silently redefine the initial physical framing.

Use the existing coordinate adapter, refraction convention, and time conversion
rules. Distinguish equatorial position angle, local frame roll, screen rotation,
and mount orientation at API boundaries. Use stable 3D tangent bases rather than
subtracting azimuth angles near the zenith or across north.

## Classification and trajectory requirements

1. Derive angular frame dimensions from the selected equipment's existing optical
   fields. Center the evaluated frame on the selected target's coordinates;
   arbitrary off-center compositions and mosaics are outside this task.
2. Construct the physical angular footprint at each evaluated instant, including
   its orientation. The result must not depend on viewport size or projection.
3. With a completed mask, the frame is visible only when its entire footprint is
   in the defined visible region. An obstruction inside the footprint counts,
   even if the center, corners, and perimeter are clear.
4. Do not approximate arbitrary-mask intersection with just four corners or an
   unverified sparse sample grid. The raster's actual cells and coverage determine
   supported obstruction detail. Numerical precision cannot recover geometry
   absent from the captured mask.
5. Frame portions below the applicable horizon or outside completed-mask coverage
   are blocked. A profile with no mask remains unassessed for local obstruction
   visibility; optics do not make those results known.
6. Refine intervals whenever the swept, rotating footprint can encounter a mask
   boundary, even when endpoint classifications agree. Preserve multiple entries
   and exits, including brief branch crossings and rotation-only intersections.
7. Preserve the existing 30-second transition and 0.05-degree spatial refinement
   targets near boundaries. Define footprint-intersection tolerance explicitly
   before implementation; do not silently introduce a larger angular buffer.
8. Keep the target's central trajectory as its path, with segment classification
   determined by the full frame. Existing time-marker cadence and unrelated arc
   styling are outside this change.

Changing equipment, mode, framing, mask, observing location, or observing period
must invalidate affected results. Pending work must not display stale results
under the new settings. Selected-target and target-list paths must agree for
identical inputs, even when their scheduling or initial sampling differs.

The UI must identify full-frame versus center-based assessment concisely.
Full-frame visible time can legitimately be shorter than center-visible time;
this is not a reason to add a hidden safety margin or silently fall back to the
center calculation. No separate center-visible discovery mode is approved by
this specification.

## Storage, lifecycle, and compatibility

- Current anchors include `apps/mobile/src/astronomy/obstructionVisibility.ts`,
  `apps/mobile/src/mask/visibilityMask.ts`, equipment FOV calculations, and the
  Sky View orientation control. Reuse their ownership boundaries.
- The current obstruction input has no equipment footprint; its classification
  evaluates one horizontal direction. Extend the shared calculation contract,
  rather than adding unrelated UI-only classification.
- Persist physical tracking/framing settings with explicit ownership after the
  decision below. Preserve them coherently across restart and equipment switching.
- Add forward-only migrations. Preserve existing equipment, selected equipment,
  profiles, panoramas, masks, and user edits. Never invent an existing user's
  physical mount type from a zero-valued historical screen rotation.
- Version cache entries and include every classification input in their identity,
  including equipment geometry, mode, physical orientation/reference, and the
  optional companion window revision. Do not reuse center-only cached intervals.
- Failed writes preserve the prior valid settings. Calculation failure or resource
  exhaustion must expose a retryable failure, not fabricated clear/blocked results.

## Performance and privacy

Prepare equipment geometry and reusable mask acceleration data outside the
per-sample path. Reuse decoded masks; do not decode images or scan the full atlas
for every footprint. Use bounded spatial queries, adaptive refinement, existing
yield/cancellation facilities, and selected-target priority over catalogue work.

Benchmark cold and warm selected-target calculations and the complete current
catalogue over representative nights and the supported 25-hour maximum. Include
dense branch masks, narrow openings, large frames, zenith crossings, and repeated
setting changes. Record device, catalogue count, mask dimensions, elapsed time,
peak memory, refinement work, and cancellation latency against the center-only
baseline. Set explicit work/memory limits and calculation latency budgets before
shipping; do not invent acceptable results when a limit is reached.

Retain the existing physical Android interaction target: at least 50 fps at p95
and no stall over 100 ms in representative pan/pinch/selected-path interactions.
See the [sky engine specification](2026-08-20-0942-stellarium-sky-engine-rewrite.md).
Emulator measurements do not prove physical-device performance.

All processing and persistence stay local and offline. No new permissions,
dependencies, telemetry, or services are authorized. Validate finite dimensions,
angles, enums, and bounded work. Do not log coordinates, masks, or panoramas.

## Verification and acceptance

Develop behavior test-first, including a regression where the center remains
clear while a frame edge hits a wall. Required deterministic cases include:

- A blocked island or narrow branch inside an otherwise clear frame; all corners
  clear but the frame blocked; gaps, overhangs, and disjoint visible intervals.
- A frame leaving captured coverage, crossing the horizon, wrapping north, and
  approaching zenith or celestial-pole coordinate singularities.
- Non-square frames with different initial angles; AltAz versus EQ; ideal EQ and
  active derotation agreement for matching celestial orientation.
- A rotating corner entering an obstacle between clear endpoint samples; temporal
  precision verified against independent high-resolution reference fixtures.
- No equipment, no mask, equipment deletion/switching, cache invalidation, stale
  result cancellation, persistence restart, and migration from prior data.
- Agreement among target-list intervals, totals/ranking, and selected trajectories.

Visually exercise orientation and mode selection, time changes, frame inspection,
target-list return, and no-mask states on representative and constrained Android
phone viewports using the visual-QA skill. A planning reticle must not falsely
suggest that a screen-fixed rectangle proves physical orientation at all times.

Implementation delivery requires final format, typecheck, lint, relevant tests,
build, numerical/performance evidence, privacy review, and a current staged release
APK through the build-share skill. This specification-only task requires none of
the app build or device gates.

## Implementation contract

The user authorized task one. Optional questions about ownership and defaults
received no answer during independent geometry work; the agent proceeded with
the recommended defaults announced in the conversation. These are implementation
choices, not additional answers attributed to the user.

- Save mode and angle per equipment configuration. All targets use that equipment's
  physical angle. Zero means local altitude-up for AltAz and celestial north for
  EQ/active derotation. Positive angle rotates the sensor vertical axis toward
  the local increasing-azimuth direction or celestial east respectively. The
  rectangular frame repeats after 180 degrees. No reference target/time is needed
  for these absolute basis conventions.
- Existing and new optics visibly default to AltAz and zero degrees. The orientation
  sheet explicitly exposes all three modes and the angle reference. Changing a
  mode reinterprets the saved number in the displayed reference basis. It does
  not infer the physical mount. Ordinary equipment edits preserve framing.
- Migration 10 adds the equipment fields and removes derived cached intervals;
  other user data and historical migrations remain unchanged. Cache version and
  identity include physical FOV, tracking mode and angle.
- Use the existing immutable directional raster masks, up to 2048 by 2048 pixels.
  Preserve legacy center-only vector fixtures; a non-raster full-frame request
  fails explicitly rather than silently evaluating only its center.
- Physical dimensions must be finite, greater than zero and less than 180 degrees.
  Intersect the spherical tangent-plane rectangle with actual raster pixel cells.
  Boundary contact counts as blocked; curved-cell intersection tolerance is
  0.0001 degrees, much smaller than an atlas pixel. There is no added safety margin.
- A cached occupancy pyramid and spherical-cap index use less than 9.8 MB per
  maximum-size raster, excluding the existing mask itself. Indexes are held by
  weak mask identity and reused. Each query has a 100,000-node work limit; the
  existing 100,000-sample trajectory limit and 25-hour period limit still apply.
  Limits raise calculation errors and must never manufacture visibility.
- Swept bounding caps only eliminate intervals proved clear or blocked. Other
  intervals refine to 30 seconds and 0.05 degrees of center/corner motion. Brief
  full-frame blocked intervals are retained instead of applying the old
  center-only flicker merge. Selected/list calculations share their projection,
  sampling and mask geometry; the displayed selected frame uses the same basis.
- Desktop regression budgets: 256 representative targets within one second;
  the eligible production catalogue within five seconds for 12- and 25-hour
  windows (twice these limits under CI). Catalogue work yields between targets
  after 12 ms, with existing cancellation and selected-target async refinement.
  These budgets do not establish physical Android latency or frame rate.

Physical-device performance remains a delivery verification requirement. Record
actual evidence and any unavailable-device blocker in State.md and the delivery
report; do not represent emulator or desktop results as phone measurements.
