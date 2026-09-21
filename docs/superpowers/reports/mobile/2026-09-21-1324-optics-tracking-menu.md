# Optics tracking-menu correction

**Timestamp:** 2026-09-21 13:24 +03:00 (Europe/Sofia)

Implemented the user's approved [preview](../../previews/2026-09-21-1308-optics-tracking-control.png):
the root Optics menu contains one joined `AltAz | EQ | AltAz+FieldCorr` row
directly beneath Orientation. The Orientation sheet contains only the angle,
its reference explanation and save/error feedback.

The shared `SegmentedControl` now supports compact labels and a disabled state.
Only the outer ends are rounded; segments touch with single dividers. The
field-correction label permits a centered line break after `AltAz+` at enlarged
text sizes. Existing selection, persistence, error recovery and calculation
behavior remain intact. `AGENTS.md` documents the convention for single- and
multi-select groups. The README and controlling full-frame spec are updated.

Validation passed in order: `pnpm format`, `pnpm typecheck`, `pnpm lint`, the
affected Sky View/Profile Form suites (31 tests), and `pnpm build`. The navigation
regressions failed before the move and pass afterward. Tests cover the root
selector, absence of modes in Orientation, selection persistence, failure/retry
and disabled controls without optics. Existing shared-control consumers pass.

**Visual QA passed:** Android API 36 emulator at 1080×2400/420 dpi and
720×1280/320 dpi, including the constrained screen at 1.3× font scale. Verified
all three mode choices, angle-only navigation, saved settings after Android
restart, readable labels and root-menu placement. Synthetic QA data only;
local screenshots are in `tmp/optics-controls/`. Release runtime error logs were
empty. The read-only emulator and agent-owned ADB daemon were stopped after
restoring font scale, size, density and ADB privilege state.

The final release APK was built and staged using the repository skill at
`tmp/artifacts/android/app-release.apk`, 413,894,095 bytes.
SHA-256: `b2140bed470a52549e0f160efead1781aa3ff00227d112dcfad729444d93608a`.
No app inputs changed after that build. No permissions, dependencies, migrations,
network behavior or sensitive logging were added. The existing physical-device
performance follow-up in `State.md` is unrelated to this presentation correction.
