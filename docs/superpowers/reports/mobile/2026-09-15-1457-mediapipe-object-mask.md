# MediaPipe object-mask trial

Timestamp: 2026-09-15 14:57 +03:00 (Europe/Sofia).

Spec: `docs/superpowers/specs/mobile/2026-09-15-1415-mediapipe-object-mask.md`.
Branch: `feature/cubemap-background-renderer`, based on `4658693`.

## Delivered behavior

Magic paint/erase now uses MediaPipe Tasks Vision 1.0.0 with Google's bundled
MagicTouch v2 int8 model. It selects an object from the completed stroke; OpenCV
fills internal holes and simplifies its silhouette. Manual painting, binary-mask
storage and continuous panorama capture retain their existing behavior.

The native worker reconstructs a rectilinear view from the directional atlas,
crops transparent outside padding, retains the model input and caches one view's
embedding and atlas lookup. There is one bounded expansion for objects clipped
by the initial view. A failed or cancelled request invalidates native state;
existing edits remain available. Input dimensions, stroke count and work remain
bounded. Inference is synchronous on the worker: the 30-second deadline is
checked between native operations and cannot interrupt a vendor inference call.

Photographic testing caught a real integration problem: a large black frame
around a partial panorama could cause selection of the whole photograph.
Cropping that frame corrected the Android treehouse example. The owner's supplied
tree screenshot, tested only locally, produced a filled tree canopy with clear
sky outside. Its existing red overlay is baked into that screenshot, so this
is useful qualitative evidence rather than a clean-image accuracy benchmark.

## Verification

- Format, typecheck, lint, all 469 tests across 94 suites, and Android Expo export
  passed against the final executable changes.
- Native instrumentation passed: existing OpenCV/capture cases, silhouette holes
  and concavities, transparency cropping, north wrap/horizon/zenith projection,
  bundled model inference, cached repeat selection, cancellation, and a narrow
  synthetic building whose window remains filled while sky stays clear.
- Visual QA passed on Android API 36, Pixel 8 AVD with software graphics,
  1080 x 2400 at density 420 and 720 x 1280 at density 320. Checked whole-object
  painting, manual correction, Magic erase, completion confirmation, save/restart,
  existing-mask reopening and the offline image-processing licence sheet.
- Fresh release compiled, installed and ran an additional model selection without
  native crashes. APK Signature Scheme v2 verifies; model hash and all four JNI
  ABIs and bundled notices were inspected inside the final APK.
- Synthetic CPU emulator measurements were approximately 1.5 seconds for the
  first selection and 0.9–1.1 seconds for a cached selection. These are not S24
  Ultra latency or accuracy measurements.

## Dependencies and limitations

Runtime/model stay on device; no runtime model download or image upload was
introduced. The model is 30,525,312 bytes, verified at build time and in the APK.
Guava 33.7.1-android and protobuf-javalite 4.36.1 override vulnerable transitive
defaults. OSV checks found no advisories for those versions or the new MediaPipe
and Flogger components. No vendor binaries were patched.

The selected JNI API bypasses Java TaskRunner's statistics client. MediaPipe's
data-transport dependency edge is excluded; the existing camera/ML Kit dependency
graph still contains its older transport libraries. The merged manifest showed
no new requested permissions from MediaPipe.

This remains an object-selection aid. Closely overlapping objects, sparse bare
branches and dark low-contrast photographs can be ambiguous. An erase stroke
can infer a slightly different boundary from an earlier paint stroke. Manual
corrections remain available. Objects exceeding the bounded perspective view
need additional strokes; the implementation does not segment an entire 360-degree
panorama at once.

## Artifact and cleanup

Staged release: `tmp/artifacts/android/app-release.apk` in both the worktree and
the primary project directory. Size: 413,205,703 bytes (about 76.2 MB larger than
the previous 337,049,583-byte universal APK).

SHA-256: `e13eee990a0e140ae6c0469fdee98e351523b68737d6fc241537066acab53b23`.

Original emulator database was restored and its SHA-256 verified against the
backup. Temporary profiles, mask caches and private diagnostic images/backups
were removed. Display size/density were restored; owned emulator, adb and build
daemons were stopped. No user photographs or coordinates were committed. Changes
are committed locally; the branch remains unmerged and unpublished.

Public diagnostic image sources:

- https://commons.wikimedia.org/wiki/File:Tree-house-g8cd70e868_1280.jpg (CC0).
- https://commons.wikimedia.org/wiki/File:Runnymede,_Jamestown_oak_tree.jpg (CC0).
