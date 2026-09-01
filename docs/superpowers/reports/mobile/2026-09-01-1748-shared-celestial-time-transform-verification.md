# Shared Celestial Time Transform Verification

**Timestamp:** 2026-09-01 17:48 +03:00 (Europe/Sofia)  
**Branch:** `feature/atlas-shared-time-transform`  
**Status:** Automated and release-build verification passed; Android visual QA
blocked by the absence of an attached device or configured emulator.

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

No dependency, permission, persistence, network behavior, catalogue membership,
DSO coverage, mask behavior, trajectory calculation, or sensitive logging was
added or changed.

## Remaining blocker

Visual QA is blocked. `adb devices -l` reported no attached devices, and the
configured Android SDK contains no AVDs (`emulator.exe -list-avds` returned no
entries). Consequently the representative/constrained screenshots, live drag
inspection, and physical-device frame percentiles cannot be claimed. The APK is
ready to install on an Android device for that final acceptance step.
