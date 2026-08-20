# Active Tasks

## 2026-08-20 17:03 +03:00 — Sky pan render synchronization

Controlling specification:
`docs/superpowers/specs/mobile/2026-08-20-1252-sky-view-major-ux-correction.md`,
owner correction dated 2026-08-20 17:03 +03:00.

Objective: eliminate horizontal-pan release jumps and late/repositioned DSO
population without changing the accepted projection or zoom behavior.

Checklist:

- [x] Trace the UI-thread camera, committed React camera, catalogue query, and
      gesture callback lifecycle.
- [x] Add failing regressions for live catalogue preview, stable gesture/tap
      identity, and exact release handoff.
- [x] Implement bounded preview-driven catalogue population and prevent the
      redundant release camera write.
- [x] Run format, typecheck, lint, affected/full tests, and build.
- [x] Assemble and stage a fresh release APK.
- [x] Perform normal and constrained Android visual/interaction QA focused on
      repeated horizontal pan release, dense DSOs, lines, selection, and zoom.
- [ ] Commit and push `main`, verify exact-SHA CI, then remove this State entry.

Current finding: `PlanetariumScene` projects mounted geometry from a Reanimated
shared camera while `queryCataloguePlanetarium` uses only the last committed
React camera. `SkyCanvas` does not pass the hook's existing preview callback, and
its tap callback captures `visibleTargets`, so release both replaces the
catalogue population and rebuilds the gesture.

Blockers/questions: none.
