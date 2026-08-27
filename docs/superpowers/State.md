# Active Tasks

## 2026-08-27 23:57 +03:00 — Atlas density floor and overlay performance

- Controlling specifications: `astro-visibility-spec.md`,
  `docs/superpowers/specs/mobile/2026-08-27-2357-atlas-density-overlay-performance.md`,
  and the direct human instructions in the current task.
- Objective: reveal every normal filtered DSO when the filtered set contains at
  most 100 targets and materially reduce panorama/mask rendering work during Sky
  View gestures.
- Acceptance criteria: all focused-spec criteria; automated regression tests;
  representative and constrained Android QA with synthetic overlays; final app
  build; focused commits and push directly to `main`.
- Checklist:
  - [x] Audit target-density and directional-overlay render paths.
  - [x] Write the focused implementation specification.
  - [x] Add failing density and overlay-work regression tests.
  - [x] Implement the smallest density and mesh hot-loop changes.
  - [ ] Run complete quality gates.
  - [ ] Perform Android overlay visual/performance QA.
  - [ ] Record verification, remove this state, commit, and push `main`.
- Current step: commit the tested implementation, then run complete gates and
  Android overlay QA.
- Blockers/open questions: none. The direct request selects the sparse-filter
  behavior; this spec fixes the deterministic boundary at 100 targets.
