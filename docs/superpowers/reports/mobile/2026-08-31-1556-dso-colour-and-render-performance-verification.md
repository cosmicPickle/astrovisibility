# DSO Colour and Render Performance Verification

**Completed:** 2026-08-31 15:56 +03:00 (Europe/Sofia)

## Outcome

The DSO image shader path was already colour-neutral: Skia receives each JPEG
without a tint or colour matrix. The reported green, purple, yellow, seams, and
square coverage artifacts were present in the bundled Pan-STARRS `i-r-g` and
AllWISE infrared composites themselves.

All 289 registered DSO cutouts now come from the optical full-sky CDS DSS2
colour HiPS (`CDS/P/DSS2/color`). The CDS record publishes ODbL-1.0 licensing;
the bundled licence screen retains CDS/STScI acknowledgement and links to the
official record. The regenerated 256×256 JPEG set totals 4,109,915 bytes,
737,600 bytes less than the replaced set.

Representative source and final-asset inspection covered NGC 7000, M 42,
Eta Carinae, and M 31. The native release close-zoom check rendered M 31 with
neutral optical colour and no false-colour tint, seams, or square coverage
artifacts.

## Behavior-Preserving Optimizations

- Static star, DSO, panorama, mask, constellation, path, label, and marker
  directions cache normalized unit vectors rather than recomputing trigonometry
  every frame.
- A frame-local stereographic projection context reuses camera and scale values.
  The prepared unit-vector path uses the equivalent identity
  `tan(angle / 2) = sin(angle) / (1 + cos(angle))` and preserves the compatibility
  path for callers without prepared data.
- Panorama meshes share one camera context per combined projection.
- Resident-star culling uses an equivalent dot-product threshold instead of
  repeated angular-separation trigonometry.
- Gesture-time JS cache previews are sampled once every four native gesture
  updates. The native shared camera still updates every event, the existing
  full-screen cache overscan is unchanged, and the final camera is always
  previewed and committed.
- Marker projection is calculated once rather than twice per frame.

No catalogue thresholds, star density, DSO coverage, layer visibility,
panorama/mask behavior, zoom range, gestures, or selected-target behavior were
removed or changed.

## Measurements

A temporary pure projection diagnostic (removed after measurement) projected
1,296 stars over 200 frames:

- compatibility path: 276.001 ms;
- prepared path: 89.111 ms;
- prepared/compatibility ratio: 0.323 (about 68% less time in that isolated
  projection workload).

Long gestures now issue 75% fewer JS cache-preview bridge callbacks. These are
structural diagnostics, not a claim about end-to-end physical-device FPS.

The constrained software-rendered Android emulator interaction sample recorded
80 frames, 9 ms p95, one janky frame (1.25%), no missed vsync, and no slow UI
thread frames. Emulator timing is diagnostic only; the open physical-device
acceptance criterion remains 50 fps p95 on representative Android hardware.

## Verification

The final intended state passed, in order:

1. `pnpm format`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test` — 72 suites, 368 tests
5. `pnpm build` — catalogue, 15,598 stars, 88 constellations, and 289 DSO
   assets validated; Android production export completed

Native visual inspection used the fresh release APK on the Pixel 8 API 36
emulator at 1080×2400 and 720×1280. It covered profile-to-sky navigation,
registered sky rendering, close-zoom DSO imagery, selection/trajectory overlay,
pan and zoom interaction, and constrained layout. No clipping, crash, stale
frame, or image-colour regression was observed.

## Release Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 193,070,045 bytes
- SHA-256: `A17099FF90F0D9AE7C24CFD644D5A79415CB0D832E1E19841D0EF7B854A8FCDB`

## Security and Privacy Review

No runtime service, dependency, permission, persistence format, or user-data
flow changed. The build-time downloader continues to constrain origins,
redirects, response size, content type, and 256×256 dimensions. No precise
location, panorama, mask, or device identifier is logged or uploaded.
