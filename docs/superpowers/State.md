# Active Tasks

## 2026-08-27 17:24 +03:00 — Target discovery and visibility-cache performance

- Controlling specifications: `astro-visibility-spec.md`,
  `docs/superpowers/specs/mobile/2026-08-27-1724-target-discovery-performance.md`,
  and the direct human instructions in the current task.
- Objective: make overlay opacity commits responsive, keep low-value catalogue
  objects search-only, share debounced discovery controls between Sky View and
  View All Targets, enforce optical suitability in both, and persist expensive
  visibility results locally.
- Acceptance criteria: all criteria in the focused specification; regression
  tests; representative and constrained Android QA; fresh release APK; focused
  commits and final push directly to `main`.
- Checklist:
  - [x] Audit current catalogue, rendering, filtering, opacity, calculation, and
        persistence paths.
  - [x] Write the focused implementation specification.
  - [x] Implement and test deferred opacity commits and zero-disable behavior.
  - [x] Implement and test the shared debounced discovery state and controls.
  - [x] Implement and test search-only catalogue classification, name/alias
        search, optical filtering, atlas filtering, and counts.
  - [x] Add and test the persistent visibility cache and migration.
  - [ ] Run complete gates and exact-release Android visual/device QA.
  - [ ] Remove this active state, write the verification report, commit, and
        push `main`.
- Current step: run the complete quality gates, then perform exact-release
  Android visual/device QA and stage the release APK.
- Blockers/open questions: none. Direct human direction resolves catalogue
  discovery behavior and persistence scope; the spec records conservative
  decisions for selected-target exceptions and cache bounds.
