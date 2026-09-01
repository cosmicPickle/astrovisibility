# Shared Celestial Time Transform Verification

**Timestamp:** 2026-09-01 17:48 +03:00 (Europe/Sofia)  
**Branch:** `feature/atlas-shared-time-transform`  
**Status:** Automated, release-build, and Android emulator visual verification
passed; physical-device frame-budget verification remains open.

**Emulator follow-up:** 2026-09-01 18:32 +03:00 (Europe/Sofia)

## Implemented result

- Celestial geometry is prepared once as fixed J2000 vectors for 15,598 stars,
  88 constellations, the Milky Way atlas, 289 DSO cutouts, and filtered
  catalogue targets.
- One shared UTC-millisecond value drives Skia projection during time dragging.
- Stable J2000 catalogue and star residency queries replace full horizontal
  catalogue/sky reconstruction during preview updates.
- Catalogue marks, angular outlines, constellation figures and labels, stars,
  Milky Way, and DSO meshes use the shared celestial projector.
- Star cores and haloes use bounded Skia point batches instead of rebuilding
  two or three circle paths per star per frame.
- The time slider publishes every drag preview to the shared renderer, samples
  JavaScript culling/control state, and commits the exact release timestamp once.
  A selected trajectory remains mounted during same-window movement.

## Automated verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed without warnings.
- `pnpm test`: 80 suites and 412 tests passed.
- Production fixed-residency performance guard passed against the generated
  catalogue and registered star counts.
- Transform accuracy remains within 0.0001 degree and 0.5 screen pixel in the
  focused regression fixtures, including an extended DST window.
- `pnpm build`: catalogue checksum, registered sky assets, and Android Expo
  export passed.
- Fresh release APK: `tmp/artifacts/android/app-release.apk`, 193,106,809 bytes.
- SHA-256:
  `1A7CF214A4E9E9EBBD299DA9FC024B79609EFF4DD525FAE6CAE948D122096FF5`.

No dependency, permission, persistence, network behavior, catalogue membership,
DSO coverage, mask behavior, trajectory calculation, or sensitive logging was
added or changed.

## Exact-release emulator review

The existing `RallyPath_Pixel_8_API_36` AVD was discovered at its established
AVD home after the initial default-context lookup failed. The exact feature-
branch release APK installed and launched on API 36 with software rendering.
Inspection used a synthetic profile and covered both 1080x2400 at 420 dpi and
720x1280 at 320 dpi.

- Fresh install, profile creation, atlas launch, static pan, and native pinch
  zoom completed without an AndroidRuntime, ReactNativeJS, or native fatal log.
- Stars, constellation geometry, grid, Milky Way, target marks, labels, horizon,
  and cardinal direction remained mutually registered during pan and zoom.
- Close zoom crossed the DSO image threshold and displayed the registered
  Andromeda Galaxy optical cutout beneath its vector outline and label.
- Slider movement updated the celestial field while held. With IC 1831
  selected, the whole trajectory remained mounted and its current marker moved
  along the unchanged arc as the displayed time advanced.
- The observing-window date, condition, navigation controls, gradient slider,
  darkness times, and expanded lunar-condition panel remained readable and
  operable at both viewports. The constrained expanded panel scrolled to expose
  the complete slider and darkness controls.

Android `gfxinfo` is not used as an atlas-FPS acceptance claim here: the atlas
is a Skia `TextureView`, while the sampled ViewRoot frames primarily reflect
coalesced React text/control updates. The software-rendered emulator samples
were therefore retained as diagnostics only rather than being presented as the
required Skia or physical-device frame percentiles.

## Remaining blocker

No physical Android device is attached. The specification's Galaxy S24 Ultra
60 Hz target and representative mid-range 50 fps p95/no-stall requirement still
need an exact-release physical-device run. Emulator visual verification is
complete and is not represented as physical performance evidence.
