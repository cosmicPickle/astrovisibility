# Advanced target filters and ordering

Timestamp: 2026-09-17 13:03 +03:00 (Europe/Sofia)

## Outcome and approved behavior

Extend the shared profile-scoped discovery controls in Sky View options and
View All Targets. Preserve search, categories, selected-target exceptions,
direct search, local-only operation, and the existing observing-window rules.

- Below search, add an Advanced disclosure, collapsed initially, with Min size
  and Max size in sensor pixels and Min visibility duration in minutes.
- Both size limits compare the minor axis, using the existing circular fallback
  when the minor axis is missing. They are additional inclusive restrictions:
  the global 60 px optical suitability minimum always remains in force.
- Blank values add no restriction. Size fields are disabled and size limits
  ignored without selected optics. Values are retained if optics changes.
- Accept finite nonnegative decimal values. Reject invalid text, size minima
  below 60, and inverted size ranges with inline feedback; retain the last valid
  applied limits while the user corrects a draft. Never silently relax the
  global optical suitability rule.
- Duration is the sum of usable astronomical-darkness intervals within the
  observing window, including separated intervals. Without a mask it uses
  above-horizon dark time and retains explicit unassessed-obstruction wording.
- Below the category segments, add Order by: Biggest | Longest Visible as a
  contiguous single-select control. Default to Longest Visible.
- Longest Visible preserves duration-descending, angular-area-descending order.
  Biggest reverses these two comparison priorities. Remaining deterministic
  prominence/name/ID ties and unknown-size placement stay unchanged.
- Limits and ordering share the existing in-memory profile state across both
  screens and navigation remounts; no restart persistence or migration is added.
- Filter/order edits reuse derived visibility results without invalidating the
  astronomy cache. Sky duration filtering must use the same calculations and
  cache context as the target list, with progress/error/retry handling. An
  explicitly selected target remains inspectable when filters exclude it.
- Direct-search-only results retain the established explicit-search exception;
  they are not represented as having calculated visibility.

## Sky ordering scope

Preserve the existing prominence/zoom map density rules. The Sky View Order by
control sets the shared target-list order. Size and duration limits apply to
both surfaces before sky projection. The current map does not rank by duration;
changing its density algorithm is outside this extension of existing rules.

## Implementation and verification

Reuse the existing controls, state, suitability, progressive ranking, and local
summary cache. No new dependencies, permissions, catalogue sources, numerical
tolerances, or persisted data formats. Keep calculation work cancellable and
bounded by existing batches/window limits; filter before sky projection.

Tests cover inclusive size/duration boundaries, global minimum, invalid edits,
no optics, ordering ties, shared state, navigation, no-mask semantics, selected
target bypass, and no recalculation on filter/order edits. Run format,
typecheck, lint, affected tests, and build. Inspect both screens on representative
and constrained Android viewports, including keyboard and collapsed/expanded
states. Review privacy, resource use, and final diff; commit and push to main.
