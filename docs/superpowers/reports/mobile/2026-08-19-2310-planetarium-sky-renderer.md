# Planetarium Sky Renderer Verification

**Timestamp:** 2026-08-19 23:10 +03:00

**Branch:** `codex/planetarium-sky-renderer`

**Result:** Complete

## Outcome

Sky View now uses one spherical camera and an equidistant fisheye projection
rendered with React Native Skia. Panning rotates the sky sphere under the held
finger, pinch zoom remains anchored at the gesture focal direction, and ending
a gesture commits the already-visible camera without applying a second
projection or reset. The widest field of view is a circular 360-degree sky.

The grid, cardinal labels, catalogue targets and outlines, selected trajectory,
time and transition markers, imaging frame, panorama mesh, mask regions, and hit
testing all use the same live camera. Catalogue selection includes a buffered
spherical field so objects can enter while a gesture is still active.

Selected trajectories are densified by spherical interpolation before
projection. Paths through north and the zenith remain time-ordered curves rather
than folding at the old cylindrical seam.

## Root cause

The former renderer was an azimuth/altitude cylinder. During a gesture it moved
an already-projected SVG scene with a temporary affine transform and only
reprojected on release. That architecture directly caused the frozen-image
effect, delayed catalogue reveal, release snap, fixed-looking coordinate lines,
and seam/zenith trajectory distortion. Refining its translation arithmetic
could not produce planetarium navigation or an all-sky fisheye.

## Technology decision

`@shopify/react-native-skia` 2.6.2 is now an approved mobile rendering
dependency. The app retains Gesture Handler and Reanimated for UI-thread input.
Stellarium Web Engine was not embedded because its browser/WebAssembly runtime,
AGPL licensing, parallel astronomy stack, and local-overlay integration surface
are disproportionate for this app.

## Automated verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 44 suites and 208 tests passed.
- `pnpm build`: passed, including the production Android export and catalogue
  integrity check.
- Native Android release build: passed, 669 Gradle tasks.
- `git diff --check`: passed.

Projection tests cover forward/inverse round trips, full-sky fisheye geometry,
point-under-finger pan invariance, focal-point pinch anchoring, release
idempotence, north/zenith paths, seam densification, spherical catalogue
buffering, and whole-sphere target selection.

## Release visual and interaction QA

The exact emitted release APK was installed on the API 36 Pixel 8 emulator and
checked at 1080 x 2400 / 420 dpi and 720 x 1600 / 320 dpi.

- One-finger drag moved grid, labels, targets, and newly entering catalogue
  objects continuously as one sky.
- A rooted Type-B two-pointer input trace exercised real pinch input. Live and
  released endpoint captures were byte-identical, providing direct evidence
  that gesture completion no longer snaps the camera.
- Zooming fully out produced the intended circular 360-degree fisheye.
- The constrained viewport retained readable controls and an unclipped sky.
- Selecting Andromeda restored the requested window and rendered a smooth,
  time-ordered trajectory through the spherical view without an S-fold.
- Logcat contained no fatal exception, ANR, React Native, Skia, or worklet error.

Android's ViewRoot frame report does not measure Skia TextureView refreshes
reliably, and ADB gesture injection limited the observable input cadence. The
mixed diagnostic showed a 5 ms median GPU draw time, but it is not presented as
a physical-device frame-rate result. Mid-range physical-device frame pacing and
camera/sensor behavior remain hardware checks, not release claims.

## Artifact

- Package: `com.cosmicpickle.astrovisibility`
- Version: `0.0.1` (`versionCode` 1)
- Size: 184,904,574 bytes
- SHA-256: `7C0CA424D9A88CF969D08CAE32FB899A975270B955A9D8DD1759AF061E10EB40`
- Staged path: `tmp/artifacts/android/app-release.apk`

## Dependency audit

The production audit remains unchanged at two high `image-size` advisories and
one moderate `uuid` advisory. All paths are transitive Expo/Metro/Xcode build
tooling paths, not Android release-runtime code. No incompatible resolution was
forced; the disposition remains documented pending upstream Expo dependency
updates. React Native Skia introduced no additional reported advisory.
