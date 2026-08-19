# Smooth Sky Navigation Verification

## Outcome

Sky View pan and pinch now remain on the UI thread for the full gesture, use one immutable session baseline for simultaneous translation and focal zoom, and atomically rebase the astronomical viewport before clearing the held transform. A two-times hardware-backed scene with a bounded half-viewport catalogue/guide buffer reveals incoming sky without making React/SVG the animation engine. Target selection auto-fit yields permanently to manual navigation for the active selection.

Trajectory paths, transitions, and 30-minute markers now share the trajectory's time-ordered unwrapped azimuth branch. North crossings remain continuous; a near-zenith azimuth singularity is split instead of being joined by a false S-shaped connector. Rounded joins remove remaining polyline corners.

## Test evidence

- `pnpm format`: pass
- `pnpm typecheck`: pass
- `pnpm lint`: pass
- `pnpm test`: 43 suites, 199 tests pass
- `pnpm build`: Expo Android production export pass
- `gradlew :app:assembleRelease`: pass, 568 tasks
- Focused navigation coverage: combined pan/pinch focal invariance, idempotent release, atomic session rebase, bounded catalogue overscan, north wrap, branch-aligned markers, and near-zenith discontinuity

An early implementation that reprojected React/SVG on every animation frame was rejected after release-emulator profiling measured 105 ms p50 and 150 ms p95. The final UI-thread/atomic-rebase release measured 24 ms p50, 42 ms p95, and 85 ms p99 over 225 frames of repeated ADB pan gestures on the API 36 Pixel 8 emulator. Modern frame-deadline jank was 21.33%; only one vsync was missed. ADB swipe sampling and the emulator are not substitutes for physical-device touch/performance verification.

## Visual QA

Visual QA passed on the exact release APK at 1080×2400/420 dpi and 720×1600/320 dpi. Checks covered pan in both directions, two-finger zoom in/out, new buffered targets entering the viewport, release rebase, repeated gestures, selection, full observing trajectory, near-zenith handling, target/marker controls, constrained layout, and edge-label suppression. No crash, ANR, Android runtime fatal, or React Native error appeared in final logcat review. Emulator geometry was restored to its original settings.

## Artifact

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: 141,240,445 bytes
- SHA-256: `89B7DEC8BA5B49CD9ED571C55DD0B362E01D8299B9FC2D5FDB913F3DA2149B32`
- Installed package: `com.cosmicpickle.astrovisibility`
