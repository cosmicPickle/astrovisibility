# Panorama Capture Guidance Verification

**Completed:** 2026-08-20 19:31 +03:00 (Europe/Sofia)

## Outcome

The panorama capture screen now uses a single unfolded local-sky guide spanning
0–360 degrees azimuth and 0–90 degrees altitude. Its red N/E/S/W labels define
direction, accepted image footprints are green, and the live camera footprint is
a faded dashed blue rectangle. Footprints crossing north are rendered at both
map edges, so capture coverage remains continuous at the 0/360-degree seam.

The previous overlap suggestion, suggestion point, and overlap-derived next-tile
logic were removed. Capture-mode direction nudge buttons and the dedicated
review azimuth nudge buttons were also removed. Review still supports direct
drag placement plus altitude and roll fine correction, which preserves the
manual fallback required for imports and low-confidence sensors.

Heading and motion readings now use bounded low-pass smoothing. Heading
smoothing follows the shortest circular path across north rather than averaging
358 and 2 degrees through the opposite side of the map.

## Automated Verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 52 suites and 263 tests.
- `pnpm build`: passed, including the Android Expo production export.
- Focused capture, orientation, and geometry suites: passed, including seam,
  horizon/zenith clipping, cardinal placement, circular heading smoothing, and
  removal of overlap/azimuth controls.
- Android release assembly and emission: passed, 669 actionable Gradle tasks.

## Release Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,936,878 bytes
- SHA-256: `8A372D5DAA5082830C2FAEDAAE2D0E900F4DEEFAC998A278A28BFB4A473B10E9`

## Visual and Interaction QA

The exact staged release APK was installed on the existing API 36 Pixel 8
emulator. At 1080×2400/420 dpi, the permission primer, denied-camera/manual
fallback, imported one-tile draft, capture guide, and review screen were
inspected. The capture guide showed the accepted tile in green across both north
edges, the independent live footprint in faded dashed blue, and red cardinal
labels. The overlap UI and azimuth buttons were absent. Review retained drag,
altitude, and roll correction.

The capture guide was then inspected at a constrained 720×1600/320 dpi viewport.
It remained scrollable and readable without clipped controls. The emulator was
restored to 1080×2400/420 dpi, the QA-created draft was discarded, and a clean
release relaunch produced no matching fatal exception, ANR, or React Native error
in logcat.

An emulator cannot validate real magnetometer/device-motion calibration or the
physical phone camera's effective field of view. Those behaviours remain for
real-device review; no physical-sensor accuracy claim is made here.

## Privacy, Security, and Compatibility Review

This change adds no dependency, schema, permission, network request, or remote
data path. Images remain in the established app-local draft/revision storage.
Geometry work is bounded to the small number of capture footprints, and all
coordinates remain explicit in azimuth/altitude degrees. No user location,
image, database, or temporary QA capture was committed.
