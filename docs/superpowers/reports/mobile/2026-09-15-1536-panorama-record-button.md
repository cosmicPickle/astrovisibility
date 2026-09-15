# Panorama record/stop control

Timestamp: 2026-09-15 15:36 +03:00 (Europe/Sofia).

Implemented the owner's requested text-free circular camera control directly on
`main`. A 72 dp white ring contains a red record circle, a rounded stop square
while capturing, or a spinner while busy. Accessible labels identify start,
stop and processing; busy operations disable the button. Existing capture,
interruption, saved-frame ordering and navigation behavior are retained.
Instructional messages now refer to the record/stop buttons instead of text labels.

The fully merged `feature/cubemap-background-renderer` branch was removed locally
and from origin. Its worktree was removed after checking its clean state and
ancestry. Windows long-path cleanup unlinked dependency junctions without deleting
their targets. Only the main worktree remains.

Validation: format, typecheck, lint, 15 capture tests and the Android export
passed. Updated existing capture tests first failed on the missing accessible
control, then passed with the new button, including stop waiting for durable
saving and the disabled processing state. A fresh release build and APK v2
signature verification passed.

Visual QA passed on the Android API 36 emulator at 1080 x 2400 / 420 dpi and
720 x 1280 / 320 dpi: idle circle, recording square, successful start/stop taps,
screen-reader labels, touch bounds and unclipped controls. The emulator camera
used a synthetic scene. This change adds no permissions, dependencies or data
format changes. Original database checksum and camera permission were preserved;
display settings were restored and owned processes stopped.

APK: `tmp/artifacts/android/app-release.apk`, 413,855,123 bytes.
SHA-256: `268f29d7639a9cad6bb77a35b55a27c4e2edf743f540fe2d28c9b09220781759`.
