# Panorama horizon acceptance verification

Timestamp: 2026-08-21 18:34 +03:00

## Outcome

- Reproduced the reported `Use panorama` failure with two genuine Android camera
  JPEGs after nudging a tile. The failure occurred when the camera image crossed
  below the horizon: capture correctly allowed a horizon-centred photo, but the
  upper-hemisphere atlas projection rejected its below-horizon mesh vertices.
- The compositor now clips crossing triangles at altitude 0°, retains their valid
  upper-sky portion, and discards geometry wholly below the horizon.
- Returning from alignment now checks the already-granted camera permission as soon
  as the capture view mounts, so the live 1× rear-camera preview appears immediately.
- All four alignment directions now use one identical up-arrow glyph rotated into
  place, avoiding platform-font differences between separate Unicode arrows.

## Automated verification

- Focused regression tests passed: 3 suites and 18 tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed: 60 suites and 296 tests.
- `pnpm build` — passed Android Expo export.
- Android release Gradle build — passed: 710 tasks; fresh release APK staged at
  `tmp/artifacts/android/app-release.apk`.
- All task files pass Prettier and `git diff --check`. Repository-wide
  `pnpm format` continues to report the same 20 pre-existing unrelated files.

## Android visual and interaction verification

Visual QA passed with the exact staged release APK on the API 36 Android emulator
at 1080 × 2400 / 420 dpi and 720 × 1280 / 320 dpi.

- Used two JPEG files produced by the Android camera app, placed at 5° altitude so
  their 69° vertical field crossed the horizon, and moved one tile right before
  acceptance.
- Confirmed `Use panorama` completes and opens the single-image `Paint obstacles`
  screen at both viewports.
- Confirmed `Back to camera` returns directly to `POINT AND CAPTURE` and displays
  `Rear camera preview at 1x`, with no false permission-denied panel.
- Confirmed four separate, non-overlapping orthogonal buttons with visually matching
  rotated arrows at both viewports.
- No React Native error or Android runtime exception appeared during acceptance.
- Removed the generated camera images and QA panorama, restored the pre-test app
  database, and reset the emulator to 1080 × 2400 / 420 dpi.

## Security and privacy review

No dependency, permission, network, or logging changes were introduced. Projection
work remains bounded by the existing fixed atlas and per-tile mesh sizes. QA used
only the emulator's synthetic camera scene; no user panorama or location was added
to the repository.
