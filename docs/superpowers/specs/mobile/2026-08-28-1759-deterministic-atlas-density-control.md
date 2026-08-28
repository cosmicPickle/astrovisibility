# Deterministic Atlas Density Control

Timestamp: 2026-08-28 17:59 +03:00 (Europe/Sofia)

## Purpose

Keep a useful, user-controlled minimum number of deep-sky target markers in the
Sky View without making target membership depend on camera direction or
reintroducing panning-related target snapping.

## Scope

- Add a `Minimum atlas targets` slider to View Options.
- Allow integer values from 10 through 200 in steps of 10, defaulting to 100 for
  each newly mounted Sky View.
- Preview the slider value while dragging, but update the atlas only when the
  gesture is released or terminated. Accessibility increments commit directly.
- Refresh target suitability and atlas membership immediately after the active
  optics profile changes.
- Vertically centre every slider thumb on its track. This includes target
  density, opacity, field-of-view orientation, mask brush size, and observing
  time controls.

## Density Model

The density floor applies after search/category discovery filtering and active
optics suitability filtering. Search-only, unclassified, star-like, unknown-size,
and optically unsuitable targets do not enter the normal atlas pool. A directly
selected search-only target remains the explicit exception.

Only targets above the horizon at the selected atlas time count toward the
floor. If fewer than the requested number are available, all are eligible. If
the normal zoom rules admit fewer than requested, the atlas adds the targets
closest to becoming readable at that zoom until the floor is met.

Each known-size target receives a camera-direction-independent reveal field of
view derived from its prominence tier and centre-scale projected minor axis. A
target is normally eligible when the current field of view is at or narrower
than that reveal threshold. The deterministic floor is the requested number of
above-horizon targets with the widest reveal thresholds, with canonical target
identifier as the final tie-breaker. The rendered set is the union of:

- targets normally eligible at the current zoom;
- deterministic floor targets;
- the selected target.

This makes membership independent of camera azimuth/altitude and monotonic while
zooming inward. Spatial bins, overscan, off-screen culling, resident safety caps,
and label collision suppression remain rendering concerns and do not decide the
global floor membership. The floor guarantees target markers across the
above-horizon sky, not 10–200 simultaneously visible text labels or markers
inside every viewport.

## State and Persistence

The selected minimum is dynamic Sky View state, like field-of-view orientation
and overlay opacity. It is not stored in an observing profile or optics profile.
Opening a new Sky View starts at 100.

## Performance

- Reuse the existing projected catalogue and spatial-bin index.
- Compute the deterministic floor only when the projected catalogue, canvas
  dimensions, requested minimum, or resident zoom anchor changes.
- Use an identifier set for constant-time floor membership during the existing
  bounded spatial scan.
- Preserve the existing maximum visible/resident safety limits and buffered
  resident refresh thresholds.

## Acceptance Criteria

1. The View Options sheet contains an accessible 10–200 target slider showing
   its current integer value and defaulting to 100.
2. Dragging changes only the displayed preview; renderer density props and
   target membership change once on release/termination.
3. If the above-horizon eligible pool is smaller than the chosen floor, every
   eligible target is admitted by density rules.
4. If normal zoom rules admit fewer than the chosen floor, deterministic
   backfill reaches the floor when enough eligible targets exist.
5. Backfill membership is identical at the same zoom after camera pans and uses
   canonical identifier ordering for equal reveal thresholds.
6. Zooming inward adds normally eligible targets without removing floor targets.
7. Directly selected search-only targets remain present without contributing
   unrelated catalogue rows.
8. Changing optics immediately recalculates the discovery pool, target count,
   projected atlas targets, field-of-view frame, and density floor.
9. Every slider thumb is visually centred on its track at representative and
   constrained Android phone viewports.
10. Focused tests, repository quality gates, Android visual QA, release build,
    direct `main` commits, and push complete successfully.

## Non-goals

- Persisting the density preference.
- Guaranteeing the floor inside the current viewport.
- Showing all floor target labels despite collisions.
- Changing target-list ranking or visibility calculations.
- Changing the telescope suitability threshold.
