# Panorama Capture Correctness Verification

**Timestamp:** 2026-08-21 11:02 +03:00 (Europe/Sofia)
**Specification:**
`docs/superpowers/specs/mobile/2026-08-21-0957-panorama-capture-correctness.md`

## Outcome

The panorama capture correction is complete. Camera-centre capture is valid
from the horizon through the zenith, tile coverage uses the rolled spherical
camera footprint clipped to the astronomical hemisphere, and shutter metadata
uses a fresh, sufficiently accurate, steady pose captured at invocation time.
The capture camera is explicitly rear-facing at 1× with a 4:3 ratio. Image
import, the obsolete proof route, and their unused dependencies are removed.

Database migration version 5 deletes existing panorama, mask, and capture-draft
records while preserving profiles, equipment, catalogue data, and settings.
Startup orphan cleanup removes invalidated app-owned image files.

## Automated verification

- Prettier check passed for all matched files.
- TypeScript typecheck passed.
- ESLint passed.
- Jest passed: 52 suites and 268 tests.
- Catalogue validation passed.
- Expo Android export passed.
- Android release build passed: 710 Gradle tasks, `BUILD SUCCESSFUL`.
- `git diff --check` passed.

Regression coverage includes the 0°, 45°, 80°, 90°, and below-horizon capture
boundaries; low, rolled, seam-crossing, and zenith-enclosing spherical tile
footprints; mask classification at the zenith; pose freshness, accuracy, and
stability; latest-pose shutter snapshotting; explicit rear/1× camera settings;
and destructive panorama-data migration with image cleanup.

## Android visual verification

The installed release application was exercised on a disposable Android 36
Google APIs emulator.

- Representative viewport: 1080 × 2400. The capture introduction and live
  capture surface render without clipping or overlap.
- Constrained viewport: 720 × 1280 at density 320. The live camera, FOV label,
  horizon warning, footprint, and action buttons remain visible and usable.
- The live surface identifies the rear camera at 1× and reports a
  metadata-derived FOV estimate. No import action is present.
- With the emulator camera aimed below the horizon, Capture is disabled and the
  horizon guidance is displayed as expected.

The emulator's synthetic rear camera and rotation-vector sensor were sufficient
to verify permission handling, live preview, pose-driven blocking, and the
responsive layout. Physical-device camera calibration is outside this task's
fixed-1×, estimate-labelled contract.
