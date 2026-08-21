# Alignment regression verification

Timestamp: 2026-08-21 17:31 +03:00

## Outcome

- Replaced the overlapping circular tile control with four separate orthogonal
  buttons. Up/down are 72 × 48 and left/right are 48 × 72, with a clear empty centre.
- `Back to camera` now opens the capture route in live-capture mode and reloads the
  existing draft instead of showing the introduction.
- Replaced whole-draft GPU compositing with a CPU-backed 2048 × 2048 atlas that loads,
  draws, flushes, and disposes one full-resolution tile at a time.

## Automated verification

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed: 60 suites and 293 tests.
- `pnpm build` — passed Android Expo export.
- Android release Gradle build — passed: 710 tasks; the fresh APK was staged by the
  repository build/share workflow.
- All changed files pass Prettier. Repository-wide `pnpm format` still reports 20
  pre-existing unrelated files, which were left untouched.
- `git diff --check` — passed with line-ending notices only.

## Android visual and interaction verification

Visual QA passed on the Android emulator at 1080 × 2400 and 720 × 1280.

- Confirmed the D-pad buttons are separate, arrows are visible, and reciprocal
  dimensions are preserved at both sizes.
- Confirmed `Back to camera` returns to `POINT AND CAPTURE` with the 12-tile draft and
  live camera surface, not the capture introduction.
- Accepted a synthetic 12-tile, full-horizontal draft. `Use panorama` completed and
  opened `Paint obstacles` without an error.
- Confirmed the resulting single panorama is present in the mask editor.
- Removed the synthetic draft/panorama and restored the emulator to 1080 × 2400.

## Security and privacy review

No dependency, permission, network, logging, or data-contract changes were added.
The compositor continues to use app-owned local paths, keeps the fixed 2048 × 2048
output bound, and now reduces peak decoded-image retention to one source tile.
