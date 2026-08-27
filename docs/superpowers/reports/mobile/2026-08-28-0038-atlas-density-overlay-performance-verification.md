# Atlas Density Floor and Overlay Performance Verification

Timestamp: 2026-08-28 00:38 +03:00 (Europe/Sofia)

## Outcome

- Normal discovery sets containing at most 100 deep-sky targets bypass the
  prominence and projected-size zoom culls. Frustum, horizon, label-collision,
  equipment, category, search, and search-only-target rules remain in force.
- Panorama and mask overlays retain their full-resolution stored images and
  authoritative mask sampling. Their display-only hemisphere mesh now uses 265
  vertices and 480 triangles per enabled layer instead of 6,961 vertices and
  13,680 triangles.
- The per-frame projection loop no longer allocates temporary arrays for each
  triangle. Existing singularity and stretched-triangle rejection remains.

## Automated verification

- Focused regression command:
  `pnpm --filter @astrovisibility/mobile test -- directionalAtlas.test.ts planetariumCatalogue.test.ts SkyCanvas.test.tsx`
  — 3 suites and 17 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 64 suites and 324 tests passed.
- `pnpm build` — catalogue validation and Android Expo export passed.
- Every file changed by this task passes Prettier.
- `pnpm format` remains blocked by the same 18 unrelated pre-existing files
  reported before this task's final tuning. No task file appears in that list.
- `git diff --check` — passed before the implementation commits.

The density tests cover the deterministic boundary: 100 normal candidates
relax zoom density, while 101 retain the normal prominence/size rules. A selected
search-only target does not change that decision.

## Android visual and performance QA

QA used the `RallyPath_Pixel_8_API_36` emulator with a synthetic 2048×2048
azimuthal-equidistant panorama, a synthetic 2048×2048 raster mask, and repeated
horizontal Sky View gestures. The fixture contained no user data.

Measured Android `gfxinfo` comparison in the QA debug build:

| State                          | Frames | Janky frames | Median |   P90 |   P95 |
| ------------------------------ | -----: | -----------: | -----: | ----: | ----: |
| No overlays                    |    186 |   35 (18.8%) |  14 ms | 21 ms |     — |
| Previous mesh, panorama + mask |    142 |  114 (80.3%) |  48 ms | 65 ms | 69 ms |
| Final mesh, panorama + mask    |    181 |   71 (39.2%) |  16 ms | 30 ms | 32 ms |

The final combined-overlay median is close to the no-overlay baseline and three
times faster than the previous mesh measurement. This is a comparative debug
measurement rather than a promise of identical frame timing on every device.

Directional-grid visual checks at 1080×2400 and constrained 720×1280 viewports,
with panning and panorama/mask layers independently and together, showed
coherent rings and spokes without cut-up slices, overlap, tearing, or horizon
seams. The sparse-density behavior also passed rendered Sky View inspection.

## Release artifact and cleanup

- Fresh `assembleRelease` build: passed (710 Gradle tasks; 71 executed).
- Staged APK: `tmp/artifacts/android/app-release.apk`
- Size: 184,601,307 bytes.
- SHA-256: `FFC34F092AF76E94A91FCECE2A7169DA3A730AEA60D1AB5205EDA539B8C9ED8C`
- The release APK installed and launched successfully on the QA emulator.
- The QA-only debug installation and synthetic app data were deleted before the
  release smoke test. Metro and the task-owned emulator were stopped.

## Review

No persistence format, permission, dependency, network behavior, logging, or
sensitive-data surface changed. The lower tessellation affects display geometry
only; it does not reduce saved panorama/mask resolution or obstruction
classification precision.
