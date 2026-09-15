# Continuous panorama capture test build

Timestamp: 2026-09-15 11:45 +03:00 (Europe/Sofia).

## Delivered

Implemented on `feature/cubemap-background-renderer`, based on `41fbc69`.
The single constant in `apps/mobile/src/capture/panoramaCaptureMode.ts` is set to
`continuous`. Changing it to `manual` and rebuilding restores the existing
capture and manual-adjustment flow. There is no runtime setting or automatic
selection between the two implementations.

Continuous capture uses a native Camera2 preview and bounded image analysis in
the existing OpenCV module. ORB features, RANSAC rejection and rotation fitting
correct camera placement while images are selected automatically. Horizontal,
vertical, upward and revisited views use camera bases in east/north/up space.
The last visual correction is applied to fresh sensor samples between analyzed
frames, so atlas movement is not limited to the analysis cadence.

Analysis is limited to five frames per second, 900 features per image, six
reference comparisons and 96 retained images. Frames are acquired with
`acquireLatestImage`; JavaScript receives only tracking metadata and selected
image references, with one unacknowledged image at a time. Weak matches pause
additions with recovery guidance; revisiting coverage does not finish capture.
At the image limit, additions pause and the user can press Stop.

Stop drains native work and waits for durable storage, then opens shared final
alignment/blending, single-panorama review and mask drawing. Continuous review
does not offer tile adjustments. Original sensor readings and accuracy remain
separate from image-corrected placement. Existing panorama/mask formats and
database migrations are unchanged. Saved drafts can be resumed or discarded.

## Verification

- Format, typecheck and lint pass. The full application suite passed 469 tests
  in 94 suites; the final affected capture/review union passes 22 tests. Build
  and the fresh Android release build pass.
- Android instrumentation passes real OpenCV tracking tests: deliberately wrong
  sensor direction, repeat coverage, roll, horizontal/upward sweeps, blank
  rejection, zenith/north-wrap basis round trips and the 96-image bound. Existing
  panorama input and night/day mask checks also pass.
- Device-discovered regressions cover redundant permission requests interrupting
  capture, duplicate preview rotation, and the zero default BitmapFactory sample
  factor when reopening a draft. Native sampling tests verify the resumed image
  dimensions; UI tests verify foreground-only Start, interruption, save failure,
  Stop waiting for persistence and preservation of original sensor roll.
- **Visual QA passed** on Android API 36 at 1080×2400/420 dpi and
  720×1280/320 dpi. Checked live preview versus saved-image orientation, automatic
  capture, continued tracking without duplicate additions, reopened draft
  tracking, background pause/explicit resume, Stop/review, absence of manual
  adjustment controls, and acceptance into the existing mask editor. The native
  camera connection is released on entering mask editing.
- The final APK verifies with its existing v2 signing configuration.

The emulator's synthetic camera and synthetic image tests do not establish S24
sweep quality, nighttime performance or sustained physical-device frame rate.
Those are the purpose of the owner's requested test build. The live atlas shows
accepted images provisionally; full global alignment and seam blending run after
Stop.

## Privacy and resources

No dependency version, permission, network path or persistence schema was added.
The already installed React Android library is explicitly linked for native-view
lifecycle callbacks. Native capture closes on background/unmount. Seed decoding
uses private canonical paths, a 32 MiB file bound, 40 megapixel/12,000-pixel input
bounds and bounded downsampling. Sensor accuracy is preserved. Acknowledged
temporary images are removed, interrupted cache images are age-cleaned and the
existing panorama-cache clearing action includes the new capture cache. No real
user images or coordinates are included in tests, artifacts committed to Git,
or application logs.

## APK

Staged at `tmp/artifacts/android/app-release.apk` in the main workspace, with the
same build retained in the experimental worktree's artifact directory.

- Bytes: **337,049,583**.
- Built: **2026-09-15 11:39:43 +03:00**.
- SHA-256: `6411a5f3496680e93b34ccc1c17af47b5db232995aa30f405c8bde78923b9c4d`.

Changes are committed locally on the experimental branch. No merge or push is
performed; the previously recorded publication approval block remains in effect.
