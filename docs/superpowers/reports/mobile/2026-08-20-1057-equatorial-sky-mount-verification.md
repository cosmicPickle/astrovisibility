# Equatorial Sky Mount Verification

**Timestamp:** 2026-08-20 10:57 +03:00
**Branch:** `codex/equatorial-sky-mount`

## Outcome

The Sky View now uses an equatorial navigation mount while retaining the
Stellarium-compatible stereographic projector. The celestial pole defines
screen-up, the celestial equator is locally horizontal, and the local Alt/Az
grid, horizon, panorama, mask, and equipment geometry carry the correct
observer-dependent tilt.

Target selection, trajectory arrival, classification updates, and deselection
no longer write camera state. The previously scheduled selected-direction and
full-trajectory fits were removed, including their manual-navigation race.

## Geometry verification

Automated contracts verify:

- fixed-declination directions project as a circle centred on the celestial
  pole;
- symmetric equatorial directions have the same screen Y coordinate;
- horizontal directions round-trip through an equatorial camera at the seam,
  horizon, and zenith;
- incremental dragging preserves the equatorial mount frame and cannot
  accumulate roll;
- pinch changes only field of view;
- selection, trajectory arrival, and deselection preserve centre, FOV, forward,
  right, and up camera values.

The trajectory remains the exact one-minute, time-evaluated portion of the
selected observing window. Normal refraction remains enabled near the horizon.
No 24-hour path or great-circle interpolation was introduced.

## Release visual verification

The freshly emitted release APK was installed on the API 36 Pixel 8 emulator.
At 1080x2400 / 420 dpi:

- the purple celestial equator was level while the Alt/Az grid was visibly
  tilted;
- selecting Pleiades left all grid intersections and catalogue targets at their
  existing screen positions;
- its path appeared promptly as a smooth circular segment;
- closing the selection removed the path/card with no camera change or stale
  frame;
- a 1.4-second held drag updated the real projected sky during the gesture;
  screenshots immediately after release and 700 ms later were byte-identical,
  proving no release snap;
- ten representative drag passes recorded 0/10 Android UI frames as janky,
  with p95 6 ms. Skia renders on its own surface, so this diagnostic does not
  replace physical-device frame profiling.

The same release passed layout review at 720x1600 / 320 dpi. The emulator was
restored to 1080x2400 / 420 dpi. Logcat contained no fatal exception, ANR, or
React Native error match.

Panorama and mask persistence were not changed. Their mesh/operations remain in
horizontal coordinates and enter the same tested horizontal-to-equatorial
projection used by the grid and catalogue. Visibility classification remains
camera-independent.

## Quality gates

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: 49 suites, 226 tests
- `pnpm build`
- fresh native `assembleRelease`: 669 tasks, successful
- `git diff --check`

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Bytes: 184,913,242
- SHA-256: `B6B7F148B92D0A31D036841E75F238E3C85FB050F984202209B0857A01EC3543`

The identical APK is staged for the owner at
`C:\Web\rallypath\tmp\artifacts\android\astrovisibility.apk`.

## Residual limitation

No physical Android device was attached. True two-finger pinch and mid-range
physical-device Skia frame pacing remain device checks; deterministic gesture
tests cover FOV-only zoom and exact held/released camera identity.
