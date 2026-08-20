# Pose-Driven Panorama Capture Verification

Timestamp: 2026-08-20 23:43 +03:00 (Europe/Sofia)

## Outcome

The production panorama capture surface was rebuilt around the same spherical
planetarium renderer used by Sky View. The upper half is the live rear-camera
preview; the lower half is a pose-driven planetarium whose camera basis follows
the phone's rear camera. A screen-centred camera footprint uses the measured
rear-camera field of view, captured tiles appear immediately in their saved
world positions, and capture is blocked unless the complete footprint is within
20–80 degrees altitude.

The implementation removes the production Euler-angle/unfolded-map path. One
Android rotation-vector sample now supplies the forward, right, and up vectors
used by the atlas camera, footprint limits, persisted tile centre, and roll.
Magnetic orientation is corrected to true north using the saved profile
location. No extra runtime location request is needed during capture.

## Compatibility

- Existing draft, import, review, manual correction, immutable panorama save,
  panorama rendering, and mask workflows remain on their established storage
  contracts.
- Captured and live footprints use the same measured horizontal and vertical
  field of view.
- A Camera2-derived normal rear-camera field of view is used when available;
  the explicit portrait fallback is 55 by 69 degrees and is marked approximate.
- Sensor loss leaves import/manual placement available. Unreliable sensor
  accuracy disables camera capture and gives calibration guidance.

## Automated Verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 52 suites and 270 tests passed.
- `pnpm build`: Android production export passed.
- `gradlew :app:assembleDebug -x lint --no-daemon`: passed, including the local
  Expo/Kotlin module.
- Release APK emission: passed, 710 Gradle tasks.

Regression coverage includes Android-basis handedness, forward/right/up
orthonormalisation, roll preservation, heading wrap, zenith/horizon poses,
whole-footprint 20/80-degree limits, FOV identity between the guide and saved
tile, split-capture behavior, permission denial/import recovery, draft restart,
review correction, and atomic panorama completion.

## Rendered Android Review

The exact staged release APK was installed on the API 36 Pixel 8 emulator.
Normal 1080×2400 at 420 dpi and constrained 720×1600 at 320 dpi were reviewed.
Both showed:

- an unclipped equal-height camera/planetarium split;
- the live footprint with the measured portrait aspect ratio;
- horizon, altitude guides, zenith-capable globe, and cardinal direction from
  the production planetarium renderer;
- the complete-frame altitude warning and disabled capture state;
- available import and correctly disabled empty-review state;
- a scroll-safe permission primer and draft-resume path.

The constrained viewport remained usable without overlapping controls. Android
runtime and React Native error-only log buffers contained no fatal, ANR, or
React Native error entry after the walkthrough. The emulator was restored to
1080×2400 at 420 dpi and was left running because it was user-owned.

## Release Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,962,666 bytes
- SHA-256: `D20E33535D7A96EA725C2B0A1428CB8DE63ABA6B1FFC1E497FD4AF51E114173C`
- Package: `com.cosmicpickle.astrovisibility`

## Security and Residual Verification

The native module adds no network, storage, analytics, exported component, or
new permission. It unregisters the sensor listener in the background and on
destroy, validates native-call inputs, and emits no profile coordinates or pose
logs. Existing bounded image-import handling remains unchanged.

An emulator cannot prove real magnetometer/gyro alignment, physical-camera FOV
selection, or motion smoothness. Those require the owner to exercise this exact
release APK on a real phone. The coordinate transforms and lifecycle behavior
are deterministic-test covered and the native module was compiled in both
debug and release variants.
