# Active Tasks

## 2026-08-28 17:59 +03:00 — Deterministic atlas density control

- Controlling specifications: `astro-visibility-spec.md`,
  `docs/superpowers/specs/mobile/2026-08-28-1759-deterministic-atlas-density-control.md`,
  and the direct human instructions in the current task.
- Objective: add a release-committed 10–200 atlas target floor, guarantee
  deterministic camera-independent density backfill, verify optics refresh, and
  centre every slider thumb on its track.
- Acceptance criteria: all focused-spec criteria, test-first regressions,
  Android visual QA at representative and constrained viewports, release build,
  focused commits, and direct push to `main`.
- Checklist:
  - [x] Inspect the existing density, optics, and slider paths.
  - [x] Write the focused implementation specification.
  - [ ] Add and confirm failing density, optics-refresh, slider-release, and
        geometry tests.
  - [ ] Implement deterministic density selection and View Options control.
  - [ ] Correct shared slider geometry.
  - [ ] Run quality gates and Android visual QA.
  - [ ] Build and stage the release APK.
  - [ ] Record verification, clear this state, commit, and push `main`.
- Current step: add failing regressions before production changes.
- Blockers/open questions: none. The human selected a dynamic 10–200 setting
  defaulting to 100 and release-only updates.
