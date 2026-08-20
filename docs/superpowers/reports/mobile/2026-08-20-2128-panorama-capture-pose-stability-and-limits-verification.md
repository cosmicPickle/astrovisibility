# Panorama Capture Pose Stability and Limits Verification

**Completed:** 2026-08-20 21:28 +03:00 (Europe/Sofia)

## Outcome

The live panorama-capture footprint now treats camera roll as a rectangular
axial orientation with a 180-degree period. Android's equivalent +180 and -180
degree representations therefore remain adjacent instead of being averaged
through a false half-turn. Small stationary heading, altitude, and roll changes
are ignored before the existing low-pass filter, while intentional larger
movement remains smoothed.

Camera captures are now allowed only when the rear-camera centre is inclusively
between 20 and 80 degrees altitude. Outside that range the camera reticle and
unfolded-map footprint turn red, an accessible message asks the user to aim
higher or lower, and the camera shutter is disabled. Image import and manual
placement remain available as the sensor/permission fallback.

## Automated verification

- The new orientation, limit, and component regressions were observed failing
  against the prior implementation before production changes.
- Focused capture suites: passed, 20 tests across orientation, capture-domain,
  and capture-screen behavior.
- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 52 suites and 269 tests.
- `pnpm build`: passed, including catalogue validation and Android export.
- Android release `assembleRelease`: passed, 669 actionable Gradle tasks.

Coverage includes Android +180/-180 roll wrap, rectangular 180-degree symmetry,
stationary-pose deadbands, north-wrap heading smoothing, 20/80-degree inclusive
boundaries, too-low and too-high messages, red guidance, blocked camera shutter,
and retained import recovery.

## Release artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,939,746 bytes
- SHA-256: `68D3C04478DFEC13AFAE826A95ADD8B1B0DB02FEADC8F292CAE40D12F0D91BFE`

## Visual QA

Visual QA passed on the API 36 Pixel 8 emulator. At 1080×2400/420 dpi and the
constrained 720×1600/320 dpi viewport, the denied-camera/manual-fallback capture
flow showed the red reticle, red seam-split live footprint, and readable
aim-higher guidance. Scrolling exposed a genuinely disabled `Capture tile`
action alongside an enabled `Import image` action without clipping or overlap.
The final staged release APK was reinstalled after the final source refinement
and the same representative capture state received a release smoke check.

The viewport was restored to 1080×2400/420 dpi. The QA-created empty draft was
discarded through the app, and a clean final release launch produced no matching
fatal exception, ANR, or React Native error in logcat. The pre-existing emulator
was left running with the final release installed.

The emulator cannot reproduce a physical phone's magnetometer/device-motion
noise. Roll continuity and deadbands are deterministic-test covered, but final
stationary-pose smoothness requires the owner's physical-device review.

## Privacy and security review

This change adds no dependency, permission, persistence, schema, network,
import, or logging path. Sensor calculations remain transient and bounded to
the active capture screen. No precise location, image, device identifier,
database, or temporary QA artifact is included in source control.
