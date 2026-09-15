# Continuous panorama capture experiment

Timestamp: 2026-09-15 10:46 +03:00 (Europe/Sofia).

## Approved outcome

The owner requests a second capture implementation selected by one code constant,
enabled in a test APK, on the existing cubemap branch. Preserve manual capture.
Continuous capture starts once, accepts horizontal/vertical/upward movement and
revisits, and normally ends only on Stop. Stop leads to shared final stitching,
panorama preview and mask drawing, without manual tile adjustments. No automatic
selection between capture implementations and no user-facing mode setting.

## Implementation contract

- Reuse the approved OpenCV Android module and platform Camera2 APIs. Add no
  dependency, permission, network access or persisted schema. The native camera
  surface belongs only to continuous capture; Expo Camera remains the manual path.
- Analyze bounded, downsampled frames on one native worker. Use ORB matching,
  RANSAC outlier rejection and a rotation fit against retained frame landmarks.
  Sensor direction initializes true north and limits relocalization candidates;
  accepted frames use image-corrected orientation. Keep roll and zenith geometry
  as camera bases, not azimuth-only deltas.
- Keep up to 96 selected images, at most six reference matches per analyzed frame,
  and no unbounded frame or persistence queue. Analyze at most five frames/second;
  this is a work limit, not a promised device frame rate. Camera preview remains
  independent. Reject weak/blurred/unmatched frames, show recovery guidance, and
  never finish merely because coverage repeats. At capacity pause additions and
  ask the user to stop, without discarding the session.
- Camera frames and sensor samples use monotonic timing. Use rear camera stream
  dimensions, sensor rotation and lens metadata consistently. Persist selected
  images and corrected placement through the existing draft transaction before
  starting final stitching. No background capture. On interruption retain saved
  frames; reopen the draft for completion or relocalized continuation.
- Reuse the existing spherical atlas as a growing preview of accepted imagery.
  Full seam blending and global alignment happen after Stop; the live preview
  is provisional and does not claim final seam quality.
- Errors preserve saved drafts. Permission denial provides system settings;
  camera/sensor failure provides retry/back. Late callbacks cannot navigate or
  mutate a discarded session. Temporary capture images are private and cleaned.

## Acceptance and verification

- Test switching, Stop waiting for persistence, repeated Stop, failure recovery,
  background interruption, preview/accept navigation and hidden manual controls.
- Native synthetic image tests exercise image-derived rotation, revisit matching,
  blank rejection, bounded selection and camera basis/FOV conventions, including
  wraparound, pitch and roll. Test the actual Android OpenCV implementation.
- Run format, typecheck, lint, relevant Jest/native tests, build and fresh release
  APK staging. Inspect representative and constrained Android viewports.
- Physical sweeping, night-camera quality and tracking performance require the
  owner's device trial; emulator imagery cannot establish those results.

No mask, final image format, main-branch state or renderer redesign is included.
