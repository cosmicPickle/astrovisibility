# Panorama Vertical Orientation Verification

**Completed:** 2026-08-20 19:53 +03:00 (Europe/Sofia)

## Outcome

The panorama capture guide now derives altitude from the rear camera's optical
axis instead of subtracting 90 degrees from the magnitude of Expo's pitch value.
The previous expression could never produce a positive altitude from Android's
documented -90–90 degree pitch range, so the live footprint was always clamped
to the horizon.

The corrected calculation uses both pitch and roll to determine the rear
camera's signed vertical component. It therefore distinguishes a rear camera
aimed upward from a phone laid screen-up, clamps below-horizon directions out of
the capture sky, and preserves the existing first-sample and smoothed-update
behavior.

Reference behavior was checked against the installed Expo Sensors 57.0.2
Android implementation and Android's `SensorManager.getOrientation` contract.

## Automated Verification

- Focused regression was observed failing under the prior implementation.
- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 52 suites and 264 tests.
- `pnpm build`: passed, including catalogue validation and Android Expo export.
- Release `assembleRelease`: passed, 669 actionable Gradle tasks.

The regression suite covers valid Android/Expo sensor poses for a horizontal
rear camera (0 degrees), 30 degrees upward, zenith (90 degrees), rear-camera-down
clamping, first-fix immediacy, later smoothing, and unchanged circular heading
smoothing across north.

## Release Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,937,410 bytes
- SHA-256: `1D2E0C05F1B9B9EC5D19B951974A6979B3BD9464E727FF75754904D5B24FC32E`

## Visual QA

The exact staged release APK was installed on the existing API 36 Pixel 8
emulator. The capture flow and denied-camera/manual fallback rendered correctly
at 1080×2400/420 dpi and the constrained 720×1600/320 dpi viewport. The unfolded
map, live footprint, heading/altitude readout, guidance, and fallback controls
remained readable and scrollable. The display was restored to 1080×2400/420 dpi,
the QA-created empty draft was discarded, and a clean release launch produced no
matching fatal exception, ANR, or React Native error in logcat.

The emulator does not expose a controllable physical rear-camera pose sensor, so
real movement from horizon to zenith must be confirmed on a physical phone. The
coordinate conversion itself is deterministic-test covered with the native
platform's valid pitch/roll ranges.

## Privacy and Security Review

This change adds no dependency, permission, persistence, network, import, or
logging path. It only changes an in-memory transformation of sensor values that
were already collected during active capture. No precise location, image,
database, device identifier, or temporary QA artifact was committed.
