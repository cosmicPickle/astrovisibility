# Panorama Capture Guidance Map

**Timestamp:** 2026-08-20 19:10 +03:00 (Europe/Sofia)
**Status:** Approved by direct owner instruction

## Purpose

Make partial-panorama capture spatially obvious without prescribing a capture
sequence. The user should see where the phone points and which angular regions
have already been captured on one clear unfolded sky map.

## Scope

- Keep the current local camera/import, durable draft, review, correction, and
  atomic save workflows.
- Replace the coverage dot and suggested-overlap marker with an angular live
  capture footprint.
- Remove suggested-overlap state, copy, controls, and exclusive domain code.
- Remove live-capture azimuth/altitude nudge controls and dedicated azimuth
  plus/minus controls from review. Review drag plus altitude/roll correction
  remains available because imported and low-confidence tiles still require
  alignment.
- Improve the existing unfolded 0-360 degree azimuth by 0-90 degree altitude
  map rather than introducing another projection or renderer.

## Guidance map behavior

The map is an equirectangular capture guide over the sky above the local
horizon:

- horizontal axis: azimuth clockwise from true north, 0-360 degrees;
- vertical axis: altitude, horizon at the bottom and zenith at the top;
- red `N`, `E`, `S`, and `W` labels sit at their correct horizon azimuths;
- subdued 30-degree altitude and 45-degree azimuth guides make the unfolded
  projection readable;
- every persisted draft tile is a green translucent footprint using its
  reviewed centre, horizontal/vertical field of view, and roll;
- the current phone direction is a translucent blue footprint using the same
  62-degree capture-width model as a newly captured tile, not a point;
- seam-crossing footprints are split visually at north so coverage is not
  clipped or misplaced;
- footprints are clipped at the horizon/zenith boundaries without modifying
  persisted placement geometry.

The live footprint is display guidance, not a new persisted field. Sensor
orientation remains the authoritative input to a captured tile. Conservative
circular/linear smoothing may be applied to the displayed sensor stream to
remove small jitter without changing coordinate conventions.

## Non-goals

- No mandatory 360-degree capture.
- No automatic capture, stitching, route planning, or overlap enforcement.
- No changes to panorama/mask persistence, permission scope, image limits, or
  downstream sky alignment.
- No claim of per-device camera-intrinsic calibration; the existing approximate
  62-degree capture field remains the v1 model.

## Acceptance criteria

1. The capture screen contains no suggested-overlap box, suggestion marker,
   next-suggestion control, live azimuth/altitude nudge buttons, or dedicated
   review azimuth plus/minus buttons.
2. The map shows red cardinals, green captured footprints, and one faded blue
   live footprint with nonzero angular width and height.
3. A north-crossing tile appears on both edges of the unfolded map.
4. The live footprint moves with smoothed heading and altitude samples and
   stays bounded to the capture sky.
5. Capturing/importing a tile immediately adds a green footprint while the live
   footprint remains independently visible.
6. Review drag/fine correction, restart-safe drafts, permission denial/import,
   and atomic completion remain functional.
7. Automated geometry/component regressions, root gates, release Android build,
   and normal plus constrained emulator visual QA pass.

## Privacy, security, and compatibility

No new dependency, permission, network path, log field, database column, or
remote service is introduced. Precise location and images remain local and must
not enter screenshots, fixtures, logs, or source control.
