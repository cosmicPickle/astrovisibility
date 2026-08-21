# Active Tasks

## 2026-08-21 21:58 +03:00 — Sky visibility and target-discovery polish

- Controlling specifications: `astro-visibility-spec.md`,
  `docs/superpowers/specs/mobile/2026-08-21-2158-sky-target-discovery-polish.md`,
  and direct human instructions in the current task.
- Objective: implement astronomical-darkness trajectory/ranking semantics,
  consolidate Sky View controls, simplify target/opacity UI, and add target-list
  search plus multi-select categories.
- Acceptance criteria: all criteria in the focused specification; fresh release
  APK; representative and constrained Android QA; frequent focused commits on
  `main`; final push to `origin/main`.
- Checklist:
  - [x] Read product source of truth and create focused implementation spec.
  - [x] Implement/test astronomical darkness intervals, arc grouping, and dark
        visibility totals/ranking.
  - [x] Implement/test revised equipment suitability and known-size ordering.
  - [ ] Implement/test Sky View icon menu, opacity sheets, and compact target
        summary.
  - [x] Implement/test target search and segmented category filter.
  - [ ] Run complete gates and exact-release Android visual/device QA.
  - [ ] Remove this active state, commit final report, and push `main`.
- Current step: consolidate Sky View controls and selected-target information.
- Blockers/open questions: none; category mapping and darkness threshold are
  resolved by the focused specification.
