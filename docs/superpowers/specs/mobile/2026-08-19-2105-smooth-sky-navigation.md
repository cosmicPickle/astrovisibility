# Smooth Sky Navigation

## Goal

Make Sky View navigation feel direct and continuous: the sky remains under the user's fingers during pan and pinch, newly revealed content appears while the gesture is active, releasing a gesture never changes the apparent camera position, and selected-target trajectories render as continuous time-ordered arcs.

The existing cylindrical azimuth/altitude projection remains authoritative because panorama tiles and visibility masks are calibrated in that coordinate space.

## Current defects

- Pan and pinch transform a frozen SVG snapshot on the UI thread, while the canonical astronomical viewport changes only after release.
- Catalogue queries, guides, panorama, mask, field of view, trajectory, markers, and hit targets therefore remain stale during a gesture.
- Gesture finalization clears the temporary transform before the newly projected viewport is guaranteed to render, causing the release snap.
- Pan and pinch commit independently, so a simultaneous two-finger gesture can apply mismatched baselines.
- Trajectory rendering discards the samples' continuous `unwrappedAzimuthDegrees` and projects each wrapped azimuth independently, which can fold or reconnect an arc at north or near the zenith singularity.

## Interaction contract

### Pan

- One-finger drag updates the displayed camera continuously on the UI thread. The canonical astronomical viewport is rebased once underneath the held transform at release.
- Dragging right moves the sky right and reveals sky to the west; vertical motion remains bounded to the visible hemisphere.
- A bounded half-viewport offscreen catalogue/guide buffer reveals new sky during the gesture. Every overlay is reprojected during the atomic release rebase.
- Release and cancellation preserve the last displayed camera exactly; no final jump or animation is introduced.

### Pinch

- Pinch updates the same displayed camera continuously and remains anchored on the sky direction beneath the two-finger focal point.
- Zoom stays within the existing 12°–360° horizontal-span limits without overshoot or bounce.
- Simultaneous translation and scale use one gesture-session baseline, so the focal point does not drift.
- Lifting either or both fingers preserves the last displayed camera exactly.

### Selection and touch arbitration

- A tap can select a target or trajectory marker.
- Movement beyond the gesture handler's pan threshold is navigation, not selection.
- Selecting a target may perform the existing one-time fit-to-trajectory action. Subsequent manual navigation must not be overridden by trajectory recalculation or canvas layout effects for that same selection.
- Existing sheets, toggles, opacity controls, and Android back behavior retain their current semantics.

### Trajectory

- Samples are rendered in timestamp order using their continuous unwrapped azimuth branch.
- A path is split at the viewport boundary, horizon, assessment change, or a genuine projection discontinuity; it is never connected across a wrapped seam.
- A north-crossing arc remains locally continuous. A near-zenith azimuth flip is split rather than drawn as an artificial S-shaped connector.
- Transition points and 30-minute markers use the same branch-aware projection as the path.

## Implementation outline

1. Add pure combined camera-gesture math with a single baseline and focal-point invariants.
2. Add branch-aware trajectory projection and explicit discontinuity detection.
3. Keep frame-by-frame pan/pinch on the UI thread, render a bounded offscreen target/guide buffer, and atomically rebase the canonical viewport before clearing the held transform. React/SVG must not be used as the animation engine.
4. Prevent repeated selection auto-fit after the user begins manual navigation.
5. Add deterministic unit/component tests for live updates, final-state stability, simultaneous pan/pinch, wrap/zenith arcs, and selection-fit ownership.
6. Run repository gates, build a release APK, and visually inspect pan, pinch, selection, arcs, controls, constrained viewport, logs, and frame timing on the Android emulator.

## Acceptance criteria

- During pan and pinch, guides, targets, panorama, mask, trajectory, field-of-view geometry, labels, and hit targets agree with the displayed camera.
- A release produces no coordinate change beyond the last gesture update.
- Repeated and simultaneous gestures compose without drift or stale baselines.
- North-crossing and near-zenith trajectory fixtures contain no full-canvas connector or direction-reversing wrap artifact.
- The mounted catalogue remains bounded by the existing 180-target cap.
- The Android release build passes normal and constrained emulator interaction checks with no crash, ANR, React Native error, visible snap, or persistent frame stalls.

## Non-goals

- Replacing the calibrated cylindrical projection with a planetarium projection.
- Reworking panorama capture, mask editing, target ranking, or observing-window calculations.
- Adding inertial fling, compass tracking, or device-orientation navigation in this repair.
