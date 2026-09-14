# Optimized time and cubemap integration

**Timestamp:** 2026-09-14 14:16 +03:00 (Europe/Sofia)
**Specification:** [Cubemap time integration](../../specs/mobile/2026-09-14-1405-cubemap-time-integration.md).
**Status:** Optimization merge approved and pushed to main; combined cubemap
branch delivered for owner inspection, with no cubemap-to-main merge.

## Branch outcome

Merged all four commits from `feature/atlas-shared-time-transform` through
`5557b3e` into main as `f9c6b2f`. The merge was conflict-free and preserves
Android panorama stitching from `63c87a6`. Main passed format, typecheck, lint,
84 suites / 432 tests, catalogue and sky-asset checks, and Android Expo export
before commit/push.

Merged updated main into the existing `feature/cubemap-background-renderer`
branch rather than replacing it. Four files conflicted. Resolution preserves
the optimized scene, live slider, shared preview time, fixed J2000 geometry,
star/catalogue batching, residency and DSO projection/culling. The branch's
SkyViewScreen, SkyCanvas, and ObservingWindowSheet match optimized main.
PlanetariumScene differs only in the saved panorama/mask and Milky Way layers.

The Milky Way now transposes the same geometric frame used by live celestial
layers into shader basis uniforms. Those uniforms read shared preview time on
the UI path, with the same observing-window clamp. The existing inverse
refraction table, cube cache, cancellation and mask-edge refinement remain.
Local panorama/mask layers receive no celestial transform and stay fixed.

## Automated verification

- Added a regression that failed before the integration and passed afterward:
  shared time changes Milky Way orientation without rerendering the component
  or calling cube preparation again. A companion check keeps local panorama
  and mask uniforms unchanged.
- Compared shared cube orientation against the authoritative rotation across
  25-hour windows and latitudes from -80 to +80 degrees, including window-end
  clamps. Existing pole, refraction, maximum-zoom and mask checks remain.
- Final combined gates passed in order: format, typecheck, lint, 88 suites /
  443 tests, catalogue/sky-asset checks and Android Expo export.
- Real Skia shader pixel verification passed: 433,770 sampled mask pixels,
  maximum alpha error 1/255 in comparable regions, zero violations of the
  one-source-texel boundary tolerance, and 7,409 thin-feature pixels. Across
  three shared preview instants, maximum celestial color-channel error against
  the authoritative orientation was 0.890/255.
- Built a fresh Android release with the repository build/share skill; native
  build, installation and APK signature verification passed.

## Android visual QA

**Visual QA passed:** API 36 Pixel 8 emulator using SwiftShader, 1080 by 2400
at 420 dpi and 720 by 1280 at 320 dpi. A temporary Android user contained only
synthetic panorama/mask profiles and bundled public celestial assets.

Verified actual DOWN/MOVE events before UP: the sky moved from 18:00 toward
21:33 and then 23:30 while the synthetic panorama and selected M13 trajectory
stayed fixed. The Milky Way and celestial marks moved together. The released
instant settled at 23:30 without a sky rollback; a subsequent drag crossed
midnight. Repeated pre-release movement on the constrained viewport from
18:02 to 21:22 with the same stationary local background.

Also inspected mask color/panorama modes, source changes between profiles,
no-mask messaging, upward panning, actual two-pointer zoom in/out, and smooth
synthetic beams. Existing dense trajectory transition labels overlap for the
deliberately repetitive beam fixture; this integration does not change their
layout. No fatal native errors appeared in the inspected log window.

A single three-second slider swipe at 720 by 1280, default FOV, panorama mode
at 60% opacity and no selected target produced an Android whole-app gfxinfo
median of 23 ms and p95 of 38 ms (161 frame records across app/dialog windows;
GPU median 2 ms, p95 12 ms). These records are not independent Skia presentation
counts or a controlled baseline comparison. Software-emulator evidence cannot
establish phone FPS or a cubemap performance advantage. The existing cube
memory overhead and physical-device measurement limits still apply.

## APK and cleanup

The combined release APK is staged at `tmp/artifacts/android/app-release.apk`:
336,983,907 bytes, built 2026-09-14 14:10 +03:00. Only documentation changed
after this build. SHA-256:

```text
b89bcea5eb1ce979b899e382f6d53108060d8062705b44a457915b900e206047
```

No dependency, permission, persistence migration, sensitive logging or network
feature was added. Original photos and masks remain unchanged; cube preparation
stays bounded and does not run for time dragging. Uploaded user photos, QA
images, databases and APKs are excluded from Git. Temporary Android test data
and helper files were removed, prior app code/display/time settings restored,
and task-owned emulator/build helpers stopped after verification.
