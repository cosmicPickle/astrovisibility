# Automatic panorama stitching in Android

**Timestamp:** 2026-09-14 10:51 +03:00 (Europe/Sofia)
**Status:** Implementation authorized by direct user instruction to add the
library-based stitching to the app, rather than delivering a desktop prototype.

## Outcome

After taking photographs, `Create panorama` opens an automatic on-device
stitching flow. The user reviews one pannable/zoomable directional panorama,
then chooses `Use panorama` to save it and draw the mask. Individual photo
nudging remains an optional manual fallback, not the normal completion step.
Produce a fresh Android release APK for physical-device testing.

Controlling contracts: `astro-visibility-spec.md` and
`docs/superpowers/specs/2026-08-21-1613-single-panorama-alignment-and-raster-mask.md`.
This approved change supersedes that task's automatic-stitching non-goal.

## Native implementation

Use official Maven Central `org.opencv:opencv:4.13.0`, through a focused local
Expo module and C++ JNI adapter linked to its Prefab `OpenCV::opencv_java4`
library, plus the same release's official Android SDK static stitching archive.
The AAR includes stitching headers but omits its exported implementation; this
was verified by the Android linker. Gradle downloads the SDK only during build,
verifies its published SHA-256
`edfda20fdf65d0bd45391d168ec5261dd30b600b00279c4d910d7f1c3e020f0f`,
and extracts only stitching archives and licence notices. Reuse the project's
NDK/CMake and Kotlin/Expo module infrastructure.
OpenCV performs feature finding/matching, camera estimation/adjustment, exposure
compensation, seam finding, and multiband blending. The adapter owns app-specific
directional projection, source-file validation, resource bounds, cancellation,
and progress. No custom matching algorithm or desktop runtime enters the app.

Feature extraction decodes images sequentially and limits registration images to
640 pixels per edge and ORB features to 1600 per photo. Retain the existing 200
photo draft limit. Candidate matching is limited to six nearby sensor-directed
neighbors per photo (symmetric links), rather than an unrestricted all-pairs
image comparison. Source dimensions remain bounded by the capture contract;
encoded files retain the existing 32 MB limit. Android validates and samples
each source with BitmapFactory, applies EXIF orientation, and writes a bounded
1024-edge JPEG (quality 95) into the job cache before passing it to OpenCV.
Composition decodes one image at a time,
at most 1024 pixels per edge. Keep only cropped low-resolution atlas patches for
seam estimation (256-square global atlas) and use one full 2048-square blender.
Do not hold 200 full-resolution source photographs or full atlas tiles in RAM.

Use OpenCV's standard match-confidence threshold 1.0 and a camera-rotation
model. Match-connected groups are solved separately, each retaining its first
photo's sensor anchor. Unmatched photos retain their measured placement and
remain in the composite; they are never silently discarded. Show a clear
preview warning when multi-photo groups could not all be matched. This preserves
valid disconnected partial captures and plain-sky captures while letting the
user add overlapping photos or choose manual alignment.

World axes are east/up/north. Camera axes are image-right/image-down/forward.
Preserve sensor roll and the absolute azimuth/altitude anchor; disable automatic
leveling. Intrinsics use the actual resized image dimensions. Single images use
the measured horizontal and vertical field of view without feature matching.
The resulting PNG uses the existing azimuthal-equidistant upper-hemisphere
projection, including zenith and north wraparound. Coverage is a separate binary
union of real source coverage; seam blending never invents coverage. Preserve
real black image pixels. The existing 2048 atlas resolution is unchanged.

## Lifecycle and persistence

- Run all image processing on a native worker, with stage/photo progress.
- Only one native stitch job runs at a time. Back/cancel/unmount cancels it;
  cancellation is checked between library operations and photos. A currently
  executing OpenCV operation may finish before cancellation is acknowledged.
- Draft source files and metadata remain intact until the user accepts the
  preview and the existing coherent panorama activation succeeds.
- Stitching produces only temporary cache files: PNG plus coverage bytes.
  Reject native paths outside app-owned files/cache storage. Do not log paths,
  poses, photographs, EXIF, profile coordinates, or unrestricted native errors.
- Clean temporary output on error, cancellation, discarded preview, and after
  saving. Clean abandoned stale cache jobs without touching saved profile data.
  The existing delete-all-data action also cancels work and clears this cache.
- On save failure, preserve the preview and draft for retry. Reopening after app
  interruption restarts stitching from the existing persisted capture draft.
- Existing saved panoramas/masks and the database schema are unchanged. New
  stitching is only applied to unfinished drafts. Replacement still requires
  deleting/recreating the existing panorama/mask pair.
- No account, remote processing, upload, runtime download, or new permission.

## Dependency costs and acceptance

The official AAR contains all four currently supported ABIs; its OpenCV shared
libraries total about 143 MB uncompressed (arm64 alone about 24 MB). Keep existing
ABI support and measure the actual final APK increase. The package uses
Apache-2.0 licensing; retain upstream attribution and applicable third-party
notices. Use the already-resolved project Kotlin runtime rather than adopting
the AAR's older Kotlin baseline. Review native dependencies and 16 KB alignment
on the assembled APK. No unofficial React Native wrapper is introduced.

Add regression tests before wiring the new screen: automatic startup, stage
progress, acceptance of the exact preview, failure/retry, unmatched warnings,
back/cancel cleanup, and safe retry after persistence failure. Add native
deterministic tests for single photos, known overlapping/upward camera captures,
blank/unmatched photos, bounds, and binary coverage. Run native tests on the
Android emulator, plus representative and constrained app visual QA. Preserve
the old manual-flow regression tests. Run format, typecheck, lint, the relevant
test suites, build, and the repository release APK script.

The synthetic one-degree rotation-error test tolerance is an implementation
regression threshold, not a guarantee about real nearby branches. Report actual
device/native timings and limitations honestly; do not call the previous
desktop measurements Android performance. Real photographs from the user's
observing position will still need their hands-on acceptance using the APK.
