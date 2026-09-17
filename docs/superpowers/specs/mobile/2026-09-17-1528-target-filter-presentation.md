# Target filter presentation and visibility ordering

Timestamp: 2026-09-17 15:28 +03:00 (Europe/Sofia)

## Approved outcome

Implements the user's approved visual mockup and corrections to
`2026-09-17-1303-advanced-target-filters.md`. These requirements supersede its
Advanced disclosure presentation and Sky View ordering control.

- On both surfaces, put an accessible icon-only funnel button beside search.
  It expands/collapses the advanced fields, initially collapsed. Preserve
  entered values when collapsed; communicate expanded state and active filters.
- Join each field's shaded label cap, numeric input, and shaded unit cap into
  one rounded control with internal dividers, matching category control styling.
  Min/max size share a row; minimum visibility duration occupies the next row.
  Keep validation feedback outside the control and retain no-optics disabling.
- Show Order by only in View All Targets, below category controls. Keep the
  existing profile-scoped ordering state and both comparator modes.
- In either ordering, targets assessed against a local mask with zero usable
  visible time in the observing window rank after other eligible targets,
  before applying existing size/duration and deterministic tie rules within
  each group. Unknown obstruction visibility without a mask is not blocked.
- Preserve minor-axis sensor-pixel filtering, inclusive boundaries, the global
  60 px minimum, dark-time duration semantics, search/category behavior,
  selected-target exceptions, and in-memory navigation persistence.

## Implementation and acceptance

Reuse existing controls, AppIcon, discovery state, and ranking comparator.
No dependencies, permissions, migrations, new persisted data, or calculation
changes. Add regression tests before changing behavior for disclosure toggling,
retained inputs, optional ordering, and blocked-last ordering in both modes,
including unknown size and no-mask semantics.

Run format, typecheck, lint, affected tests, and build in order. Inspect actual
Android rendering at representative and constrained phone sizes, including
both screens, expanded/collapsed controls, numeric keyboard, validation, and
shared state. Review privacy/security and the final diff; clean up owned QA
processes and restore emulator data. Build/stage/link the current local release
APK, commit and push to main, and remove this task from State.md.
