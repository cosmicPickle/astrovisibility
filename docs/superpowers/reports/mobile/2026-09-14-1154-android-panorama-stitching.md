# Android automatic panorama stitching

**Timestamp:** 2026-09-14 11:54 +03:00 (Europe/Sofia)

## Delivered behavior

The Android capture flow now opens automatic OpenCV stitching through **Create
panorama**, followed by a single pannable panorama preview. **Use panorama**
saves the directional PNG and coverage atomically through the existing
repository, then opens mask drawing. The existing manual controls remain an
explicit fallback. No desktop tool, server, runtime download, new permission,
or schema migration is required.

OpenCV supplies ORB matching, camera estimation and bundle adjustment, exposure
compensation, graph-cut seams and multiband blending. The app adapter preserves
east/up/north coordinates and the existing upper-hemisphere atlas, including
zenith. Unconnected photos retain measured placement and are disclosed in the
preview. Drafts survive cancellation, processing failure and failed saves.

Implementation specification:
`docs/superpowers/specs/mobile/2026-09-14-1051-android-panorama-stitching.md`.

## Verification

- Format, TypeScript, ESLint, all 412 tests across 77 suites, asset checks, and
  Android Expo export passed. New screen and prebuild tests were observed failing
  before their implementation. The first native configuration failed on missing
  implementation sources, then the completed native tests passed.
- Native C++ tests ran on Android x86_64: independent known upward rotations
  within one degree, zenith/north geometry, independent horizontal/vertical FOV,
  2048 RGBA output and 524,288-byte coverage, opaque black pixels, single photo,
  200 unmatched photos, and cancellation. The final native suite took 1.00 s on
  the emulator host; this is not a physical-phone timing claim.
- `:astrovisibility-panorama:connectedDebugAndroidTest` reported one passing
  aggregate platform test, zero skipped/failed. It exercises EXIF orientation,
  private-path restrictions, remote-path rejection, pose/count limits, and
  malformed/oversized source rejection using Android's actual decoder.
- **Visual QA passed:** Android API 36 emulator at 1080×2400/420 dpi and
  720×1280/320 dpi. Checked real capture-button routing, six public OpenCV boat
  photos stitched without an unmatched warning, synthetic upward capture,
  panning, single-image preview, unmatched black-photo warning, corrupted-source
  recovery, hardware-back cancellation with all six source photos retained,
  manual fallback and its header, and offline licence display. Compact footer
  text was corrected and rechecked in the final installed release.
- Accepting the upward panorama opened the mask editor. After force-stop and
  restart, the stored panorama remained available; SQLite contained one complete
  2048×2048 panorama and its full-length directional coverage bitset. Its source
  draft was removed only after successful save. The unrelated test drafts stayed
  intact.
- The existing delete-all-data flow removed the isolated test user's records
  and the new native stitching cache. No existing user database was copied;
  testing used a newly created, empty Android user with synthetic/public inputs.

Local QA images/logs are under `tmp/panorama-android-qa` in the original workspace
and are not committed. The six real-photo fixtures are OpenCV's public
`opencv_extra` stitching boat dataset, not a user's observing surroundings.

## Native package and artifact

The official Maven AAR omits stitching symbols despite shipping their headers.
The build links the matching SDK's static stitching archive; it verifies the
official release ZIP's published SHA-256 before extraction. All 32 upstream
licence/notice assets are bundled and readable offline. The four ABI C++ runtime
export sets agree; the prebuild fix retains one runtime per ABI.

The final release was built with the repository's build/share script and
installed successfully. APK signature verification and 16 KB ZIP alignment pass.
Both 64-bit ABIs' OpenCV, app bridge, and C++ runtime ELF segments are 16 KB
aligned. Upstream 32-bit OpenCV/runtime segments retain 4 KB alignment; those
ABIs serve the existing 32-bit device targets. No test executable is shipped.

- Artifact: `C:/Web/astrovisibility/tmp/artifacts/android/app-release.apk`
- Size: **336,933,395 bytes** (about 337 MB decimal).
- SHA-256: `3e9ce482eb1048b9f5469ee2b3b1c023e14c2884842ee062732bb8873fdcc64b`
- Build timestamp: **2026-09-14 11:48:23 +03:00**.

The universal APK is about 143.9 MB larger than the recorded 193,070,045-byte
main baseline, principally the four official OpenCV native libraries. The
upward-preview process measured about 350 MiB PSS on the emulator; this is a
post-processing observation, not a peak-memory bound or mobile benchmark.

## Limits and review

Actual phone capture quality/timing still needs the user's hands-on test. Weak
texture, moving objects, nearby parallax, and sensor error can leave imperfect
joins. The first photo anchors absolute direction; image matching cannot supply
an independent true-north reference. Pinch uses the existing navigation hook;
this QA pass directly exercised panning rather than a new pinch implementation.

Reviewed native input decoding, canonical paths, bounded work, cancellation,
cache ownership, private error handling, persistence retry, dependency provenance,
licences, and APK packaging. Upstream listed no published OpenCV advisories at
review. Sources and version-specific costs are recorded in the technology
registry. No real photographs, locations, signing material, database or compiled
SDK/archive is committed.
