# Sky View Major UX Correction

**Timestamp:** 2026-08-20 12:52 +03:00
**Status:** Approved by direct owner instruction on 2026-08-20

## Owner correction — 2026-08-20 13:39 +03:00

The following direct owner feedback supersedes the original implementation
details where they differ:

- The imaging frame is a screen-space planning reticle. It is always a literal
  rectangle centred on the viewport, regardless of target selection. Its pixel
  width and height represent the setup's angular field against the current
  stereographic zoom; zooming in enlarges it and zooming out shrinks it.
- The frame is a persistent UI overlay and is not occluded by the ground plane.
- The time slider moves its thumb and displayed time locally and continuously
  during a drag. The atlas receives one exact update only when the gesture ends,
  avoiding projection work in the touch loop. Gesture position is derived from
  the drag baseline and displacement so reverse drags cannot transiently reset
  to midnight.
- The slider thumb is vertically centred on its track.
- The explanatory introductory copy and fixed trajectory-period panel are
  removed. Date, slider, Now, and Tonight remain.
- The wide overview is centred on the upper celestial equator, which keeps that
  equator horizontal through the viewport and makes the local ground/horizon
  visibly tilted. Ground and N/E/S/W remain attached to the physical local
  horizon; they are not incorrectly redefined as declination zero. The maximum
  approved 235-degree overview keeps all four horizon cardinals visible on a
  portrait phone.

## Purpose

Correct the remaining major Sky View failures without destabilizing the accepted
equatorial navigation: render a real photographic sensor footprint, expose the
complete celestial sphere behind an opaque local horizon, improve cardinal
orientation, reduce trajectory marker clutter, and replace the interval form
with a direct date/time controller patterned after Stellarium Mobile.

This specification overrides the root product specification's 30-minute marker
cadence and its open date/time-selector question for this task. Direct owner
instruction sets trajectory markers to exact local hours and defines the new
selector.

## Source behavior and evidence

- The supplied Stellarium Mobile screenshots show a wide above-horizon dome,
  opaque ground outside the horizon, prominent red cardinal labels, a compact
  current date/time readout, direct time slider, and reset-to-current-time/night
  actions.
- Stellarium's core treats stereographic and fisheye as distinct projections.
  Astrovisibility retains the accepted stereographic/equatorial navigation so
  diurnal small circles remain geometrically correct; this task makes the full
  360-by-180-degree sky model available and occludes the below-horizon half with
  ground instead of pretending it does not exist.
- Stellarium's sensor-frame work follows the real projection. Astrovisibility
  shall likewise generate a rectilinear tangent-plane footprint on the sphere
  before projecting it to the screen.

Primary references:

- https://github.com/Stellarium/stellarium/blob/master/src/core/StelCore.cpp
- https://github.com/Stellarium/stellarium/releases

## Scope

### Imaging field of view

- A selected imaging setup always has a visible field-of-view footprint.
- With no selected target, the footprint is centred on the current camera
  direction and remains centred while the user pans.
- With a selected target, the footprint is centred on the target's position at
  the currently displayed instant. Selecting or deselecting does not move the
  camera.
- Sensor width, height, focal length, and configured frame rotation define a
  rectilinear photographic sensor plane. Boundary points are lifted from that
  tangent plane to unit-sphere directions and then passed through the shared sky
  projector.
- The footprint is a four-sided projected sensor boundary, not an altitude/
  azimuth offset approximation and not a circle. It remains finite and coherent
  at north wrap, horizon, zenith, high declination, and wide Sky View zoom.
- V1 obstruction assessment remains centre-point based. The frame remains a
  visual/suitability aid and makes no full-frame visibility claim.

### Complete sky and local ground

- Catalogue projection retains all catalogue targets at their real horizontal
  directions, including below-horizon directions. Candidate density and hit
  testing remain bounded.
- The mathematical sphere remains pannable through every direction. The accepted
  equatorial mount, stereographic forward/inverse pair, incremental pan, FOV-only
  pinch, and 235-degree safety limit remain unchanged.
- The initial wide view is centred on the zenith at 180 degrees so the complete
  above-horizon dome and all four horizon quadrants can be inspected together.
- An opaque black ground hemisphere is rendered over every below-horizon sky
  primitive. Below-horizon targets, trajectories, equator sections, field frames,
  panorama, and mask pixels cannot show through it.
- The horizon and cardinal labels are redrawn above the ground occlusion.
  Panorama/mask persistence and their horizontal-coordinate alignment do not
  change.

### Cardinals

- North, east, south, and west are placed at their real horizon directions.
- Labels use a bold, high-contrast reddish colour and fixed screen-pixel size;
  zoom must not scale the glyphs.
- Labels are inset far enough from the mathematical horizon to avoid clipping but
  remain unambiguously attached to it.

### Trajectory time markers

- The selected-period trajectory uses exact local whole-hour markers rather than
  half-hour markers.
- Every retained marker receives one label; no alternate-marker suppression is
  used.
- DST gaps are skipped and repeated local hours preserve both real instants.
- Visibility transitions retain their independently refined times and labels.

### Date and time controller

- The existing header time button and modal-sheet container remain.
- The sheet no longer offers Tonight versus Custom interval modes or start/end
  text forms.
- It shows a prominent clickable local date and local time for the currently
  displayed scene instant.
- Pressing the date opens an in-sheet calendar picker with previous/next month,
  weekday headings, and explicit day buttons. No new native dependency is added.
- A 00:00-24:00 slider controls elapsed time within the selected date's fixed
  24-hour window. Its thumb moves immediately; the atlas, guides, selected target,
  and FOV update underneath on a latest-wins bounded preview cadence, with an
  exact final projection when the gesture ends.
- The visibility/ranking period is exactly 24 elapsed hours beginning at the
  selected local date's resolved midnight. On clock-change dates the displayed
  local labels may skip or repeat naturally while the period remains exactly 24
  real hours.
- `Now` reads the system clock when pressed, selects the corresponding local date,
  and displays that exact instant.
- `Tonight` reads the system clock when pressed, selects the automatically
  determined upcoming observing night, and displays its astronomical-dusk start;
  existing sunset/sunrise and 18:00 fallbacks remain truthful.
- Date selection preserves the current elapsed-time position where valid. A local
  midnight gap advances to the first valid minute; a repeated midnight chooses
  the earlier occurrence deterministically.
- Closing the sheet retains the currently previewed date/time. There is no Apply
  step and no separate custom duration.
- Selecting a target, changing overlays/equipment, or opening details must not
  reset the chosen scene instant.

## Data, time, and performance boundaries

- Scene instant and calculation window are separate explicit values. Both are UTC
  instants; formatting and calendar selection use the profile's IANA timezone.
- No persistence schema or stored user-data format changes.
- No network, account, remote service, permission, native module, or new package.
- Time preview work is latest-wins and bounded; stale catalogue projections may
  not overwrite a newer slider position.
- Full catalogue projection, ground rendering, and FOV rendering must remain
  responsive with the production 13,371-target catalogue. Rendering remains
  bounded by the existing viewport selection cap.

## Test-first verification

- Reproduce the old FOV failure: a selected setup is absent without a target and
  direct altitude/azimuth corner addition collapses/warps near the zenith.
- Prove tangent-plane sensor boundaries have four ordered sides, contain their
  requested centre, preserve width/height/rotation, cross north safely, and remain
  finite at the zenith.
- Prove catalogue projection retains finite below-horizon targets while hit tests
  and visible rendering cannot expose them through ground.
- Prove zenith-centred 180-degree view places all N/E/S/W horizon directions in
  the sky disk and camera selection invariants remain unchanged.
- Prove cardinal styling is fixed-size and independent of FOV.
- Prove exact hourly markers across ordinary, spring-forward, fall-back, and
  cross-midnight periods.
- Prove selected-date windows are exactly 24 elapsed hours and Now/Tonight use the
  clock value supplied at the instant of action.
- Component-test calendar navigation/day selection, slider preview/finalization,
  Now, Tonight, removal of custom interval UI, and accessible adjustable actions.
- Run root format, typecheck, lint, affected/full tests, build, exact Android
  release assembly, and visual QA at 1080x2400/420 and 720x1600/320.
- Visual QA covers no-target FOV, selected-target FOV at wide/close zoom, complete
  horizon/ground/cardinals, slider-driven atlas motion, date picker, Now/Tonight,
  hourly arc labels, no-mask truth, and panorama/mask compatibility where local
  synthetic data is available.

## Non-goals

- Replacing the accepted navigation/mount with a new gesture engine.
- A 360-degree single-frame fisheye projection; the complete celestial sphere is
  navigable, while the wide default fits the physically relevant above-horizon
  hemisphere and ground occludes the remainder.
- Full sensor-footprint obstruction classification.
- Time animation/playback speed controls.
- Persisting the last previewed time across app launches.
- Changing panorama/mask capture, storage, or editing semantics.
