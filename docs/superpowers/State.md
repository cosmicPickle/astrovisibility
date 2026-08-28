# Active Tasks

## 2026-08-28 09:54 +03:00 — Atlas focus, profile setup, and optics controls

- Controlling specifications: `astro-visibility-spec.md`,
  `docs/superpowers/specs/mobile/2026-08-28-0954-atlas-focus-profile-optics-controls.md`,
  and the direct human instructions in the current task.
- Objective: implement one-shot selected-target focus, a dedicated Sky View
  optics menu with dynamic orientation, Current/Custom profile location and
  timezone setup, and compact resolution-based optics forms.
- Acceptance criteria: all focused-spec criteria, forward migration and
  regression coverage, device visual QA, release build, focused commits, and
  direct push to `main`.
- Checklist:
  - [x] Audit current selection, navigation, profile, optics, and persistence
        ownership.
  - [x] Write the focused implementation specification.
  - [ ] Add and confirm failing behavior and migration tests.
  - [ ] Implement target focus and Sky View optics controls.
  - [ ] Implement observing-profile Current/Custom flows and timezone dropdown.
  - [ ] Implement resolution-based optics forms and forward migration.
  - [ ] Run quality gates and dependency security review.
  - [ ] Perform Android visual/interaction QA and build the release APK.
  - [ ] Record verification, clear this state, commit, and push `main`.
- Current step: install the approved timezone-list dependency, then add failing
  regression tests before production changes.
- Blockers/open questions: none. The focused spec fixes the one-shot focus,
  unique 0–180-degree orientation range, and existing-profile edit behavior.
