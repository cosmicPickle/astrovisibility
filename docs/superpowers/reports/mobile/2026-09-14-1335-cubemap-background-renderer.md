# Cube-map background renderer review

**Timestamp:** 2026-09-14 13:35 +03:00 (Europe/Sofia)
**Branch:** `feature/cubemap-background-renderer`, based on `63c87a6`.
**Decision:** Delivered for owner inspection; no merge authorized or performed.
**Specification:** [Cube-map background renderer](../../specs/mobile/2026-09-14-1248-cubemap-background-renderer.md).

## Result

Milky Way and saved panorama/raster-mask backgrounds now use Skia shaders
sampling padded cube-face atlases. Background vertex projection and its
piecewise triangle distortion are removed. Camera uniforms update on gestures;
the celestial orientation updates at the existing scene instant. Stars,
constellations, targets and DSO/capture-tile meshes keep their current paths.

Panorama mode remains clipped to the mask and photo coverage. Color mode and
the existing mask opacity remain unchanged. The mask editor continues to use
its original 2D source atlas. Saved data and obstruction calculations are
unchanged; no dependency, permission, migration or remote service was added.

This is an accuracy-checked implementation experiment, not a demonstrated phone
performance improvement. Each local cube holds about 24 MiB of RGBA pixels;
the Milky Way adds about 6 MiB. Raster transfer copies and GPU allocations add
to those pixels. Source images remain available for fallback and mask-edge
refinement. The software emulator did not establish a consistent speed win.

## Verification

- Test-first geometry and lifecycle coverage, plus a native-context transfer
  regression that failed before the fix and passed afterward.
- Final gates: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (80 suites, 420 tests), and `pnpm build` all passed in that order.
- Actual CanvasKit/Skia shader compilation and pixel checks passed via
  `node apps/mobile/scripts/sky-assets/checkCubeRendering.mjs`:
  433,770 sampled pixels, maximum mask alpha error 1/255 in comparable regions,
  zero violations of the one-source-texel edge tolerance, and 7,409 tested thin
  feature pixels. Independent encoded celestial direction colors differed by
  at most 0.883/255 per channel.
- Coordinate tests compared the J2000 transform and refraction lookup with the
  authoritative astronomy adapter across dates, latitudes, poles and horizon;
  angular error stayed below 0.01 degree. Cube axes, edges, corners, north wrap,
  zenith/nadir and supported 0.25–235 degree FOV were checked separately.
- Built a fresh Android release through the repository build/share skill.
  Installation and APK v2 signature verification passed.

Android QA used API 36, a Pixel 8 emulator with SwiftShader, at 1080 by 2400
(420 dpi) and 720 by 1280 (320 dpi). Only synthetic profiles and public bundled
sky assets were used in a separate temporary Android user. The owner's photo
and observing data were not copied into fixtures or committed.

Inspected smooth synthetic beams, upward/pole views, panning across cube
boundaries, actual two-pointer pinch zoom, both mask modes, zero opacity,
no-mask behavior, and a time change with the Milky Way registered to the stars.
An edited mask was explicitly saved through the binary-mask confirmation;
its new stroke appeared in panorama mode and remained after process restart.
No fatal native errors appeared in the inspected final log window.

Initial native QA caught blank backgrounds after cube preparation: a GPU
snapshot from the preparation context was not portable to the native Canvas.
The shipped build converts the snapshot to a raster image before disposing
the surface; the native Canvas uploads it once. Actual device rendering was
rechecked after this correction.

## Diagnostic performance comparison

Both release APKs used the same synthetic data, observing time 18:00 UTC,
default camera/FOV, 1080 by 2400 viewport, and four 1.5-second horizontal and
vertical swipes following a fresh process launch and eight-second settling
period. Panorama mode used the default mask opacity. No builds or tests ran
concurrently with these final samples. An earlier unrelated stuck numerical
probe was stopped before all samples below; earlier timings were discarded.

| Backgrounds               | Renderer/trial | Android frames | Median |    p95 | GPU median/p95 | Total PSS (KiB) |
| ------------------------- | -------------- | -------------: | -----: | -----: | -------------: | --------------: |
| Milky Way + panorama/mask | Mesh 1         |             40 |  85 ms | 200 ms |      4 / 17 ms |         528,120 |
| Milky Way + panorama/mask | Mesh 2         |             52 |  85 ms | 150 ms |      4 / 10 ms |         501,372 |
| Milky Way + panorama/mask | Cube 1         |             38 |  77 ms | 200 ms |       3 / 8 ms |         502,539 |
| Milky Way + panorama/mask | Cube 2         |             51 |  81 ms | 150 ms |      4 / 16 ms |         511,626 |
| Milky Way only            | Mesh           |             59 |  77 ms | 150 ms |      3 / 14 ms |         486,053 |
| Milky Way only            | Cube           |             52 |  73 ms | 250 ms |      4 / 14 ms |         492,585 |

These are coarse `dumpsys gfxinfo` whole-application frame histograms, not a
direct measurement of every Skia TextureView presentation or isolated shader
cost. Software GPU emulation, small sample counts, runtime allocation/GC and
variable swap usage limit comparisons. They do not establish a frame-rate
target or a reliable memory delta. Slow-frame tails overlap or worsen even
where medians improve. Physical-phone responsiveness and memory are the
remaining acceptance checks for the owner.

## Artifact and review boundary

The staged APK is `tmp/artifacts/android/app-release.apk`, 336,944,355 bytes,
built on 2026-09-14 at 13:17 +03:00 from this branch's final executable changes.
Only documentation changed afterward. SHA-256:

```text
c130ccb4f96cf4dafdea66a8a9fb3718ece6bfabd9983c5bfaa9ae7c1f95d1dc
```

The implementation bounds cube dimensions and serializes temporary surfaces;
cancelled/replaced caches are disposed and failed bakes retain source shader
rendering. The existing source image validation and persistence lifecycle
remain authoritative. The universal refraction table contains no user data.
No private images, test databases, APKs, logs or device identifiers are included
in the commit. The temporary Android user and helper files were removed,
original display/time settings and baseline app code restored, and the owned
emulator stopped after QA.

The owner may merge or discard this branch after checking the APK on the phone.
No automatic merge or production release is part of this delivery.
