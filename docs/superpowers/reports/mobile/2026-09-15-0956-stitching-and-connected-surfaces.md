# Stitching and connected surface fixes

Timestamp: 2026-09-15 09:56 +03:00 (Europe/Sofia)

## Delivered behaviour

Implemented on `feature/cubemap-background-renderer` in
`tmp/panorama-stitching-main`, preserving the optimization and cubemap work.
Main remains at `f9c6b2f`; no merge or push was performed.

OpenCV now retains strong, geometrically verified matches between heavily
overlapping photos. Small captures match every pair; larger captures retain
bounded spatial and chronological candidates. Lens initialization comes from
captured FOV, avoiding invented focal lengths when nearly identical photos cannot
constrain the lens. Relative rotations and useful focal refinements still come
from the library's feature matching and bundle adjustment.

Manual adjustment preserves the recovered positions, roll and FOV in one draft
transaction. Previous/next controls select coincident tiles, and larger roll
buttons rotate by one degree. Re-stitching recomputes coverage, seams and blending
at the reviewed positions without optimizing away user corrections. Acceptance
still saves one panorama image. Original sensor snapshots remain untouched.
Forward migration 9 preserves existing drafts and permits recovered centres below
the horizon; only the upper-hemisphere footprint enters the panorama/mask.
The existing initial capture-framing clamp remains unchanged.

Magic painting already used Canny edges, but a fixed colour distance from the
seed fragmented shaded surfaces. Neighbour-relative growth now follows a
connected surface across shading while respecting detected edges, local colour
steps and transparent coverage. Original-resolution denoising, centre-path seeds,
thin-feature handling, limits and the native cache remain in use. No dependency,
permission or model download was added.

## Verification

- Test-first regressions reproduced discarded duplicate matches, invented lens
  FOV, missing manual preservation/roll flow and a daylight wall limited to
  24–32% of its interior. The final wall check selects 100% from either its bright
  or dark side, with no sky leakage.
- Native C++ checks pass for three duplicates with incorrect sensor poses,
  multi-photo upward captures with 15–25 degree sensor errors, zenith/north-wrap
  and roll round trips, unchanged recomposed coverage, single/black images,
  200 featureless images and cancellation. Recomposition's small interpolation
  tolerance is defined in the controlling spec.
- Android instrumentation passes the daylight, existing night/noise, narrow
  branch, alpha-gap, centre-path, projection, invalid-input and cancellation
  cases. Night noise levels 3/5/7 retain at least 99.9% of checked sky interiors,
  all checked tree interiors and no wrong-side interior pixels. The 2048-square
  noisy case has zero pinholes in 3,269,242 checked sky pixels and zero checked
  trunk leakage. Emulator preparation measured 518 ms, cached selection 25 ms;
  these are not physical-phone performance claims.
- Format, typecheck, lint, all **463 tests in 92 suites**, build and the fresh
  Gradle release build pass. The APK's v2 signature verifies.
- **Visual QA passed** on Android at 1080×2400/420 dpi and 720×1280/320 dpi:
  daylight draw/erase/save/reopen, dark tree/branch versus sky selection,
  overlapping-photo selection, roll/directional controls and re-stitching.
  Tile 2 retains azimuth 1°, altitude 65°, roll −1° and FOV 75° after re-stitch
  and restart; its original measured azimuth 20° remains unchanged.
- The six public `opencv_extra` 4.13.0 boat images stitch without unmatched-photo
  warnings. Panning showed no obvious doubled edges at the inspected joins, and
  accepting the result opened mask creation. These are the existing public
  fixtures documented in `2026-09-14-1040-panorama-stitching-proof.md`.
- Reviewed local-path checks, image/count/work limits, SQL transaction rollback,
  version-eight migration, foreign keys and sensitive-data handling. No user
  images, coordinates or device data were committed or uploaded.

The isolated Android user and instrumentation package were removed. Original
emulator app code and viewport settings were restored; the owned emulator,
adb server and Gradle/Kotlin daemons were stopped. Synthetic/public-only QA
artifacts remain ignored in root `tmp/stitch-mask-qa`.

## Artifact and limits

Fresh release: `C:\Web\astrovisibility\tmp\artifacts\android\app-release.apk`.
Built 2026-09-15 09:54 +03:00; **337,018,599 bytes**.
SHA-256: `a1972d23a1cf1ea4146032c7cad2faf8602a367ef31e8925142a6b35fa46f376`.
The worktree and canonical staged copies have identical checksums.

Magic selection is not semantic object recognition. Strong internal texture or
missing/ambiguous boundaries can still require additional strokes or manual
correction. Panorama parallax, poor feature detail and erroneous absolute heading
remain limitations of the rotational stitching model. Real owner captures still
need owner inspection; synthetic success is not a general image-quality claim.

Changes are committed locally. The previous automatic approval review rejected
publishing private repository code to an unverified GitHub destination; that
publication block remains unresolved and was not retried.

Controlling specification:
`docs/superpowers/specs/mobile/2026-09-15-0918-stitching-and-connected-surfaces.md`.
