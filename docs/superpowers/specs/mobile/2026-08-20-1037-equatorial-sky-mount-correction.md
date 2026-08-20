# Equatorial Sky Mount and Selection Stability Correction

**Timestamp:** 2026-08-20 10:37 +03:00
**Status:** Approved by direct owner instruction on 2026-08-20

## 1. Purpose

Correct the remaining mismatch between Astrovisibility's Sky View and the
owner-provided Stellarium reference. The current renderer uses a level local
Alt/Az mount: altitude is screen-upright and the celestial equator tilts. The
requested behavior is an equatorial mount: the celestial north pole defines
screen-up, the celestial equator is locally horizontal, and the horizontal
horizon/altitude sphere carries the observer-dependent tilt.

Selecting or deselecting a target must not alter the camera. It only changes
selection, target information, and trajectory layers.

## 2. Evidence and root causes

### 2.1 Owner screenshots

The Stellarium reference is centred near the north celestial pole and shows
right-ascension spokes plus declination circles. A fixed DSO follows a
constant-declination small circle around that pole. The Astrovisibility
screenshot instead shows an altitude/azimuth grid kept upright and a
selection-fitted camera, so the same type of path is presented in the wrong
mount orientation.

### 2.2 Selection snap

`SkyCanvas` currently performs two scheduled camera fits after selection: first
to the selected direction and then to the complete above-horizon trajectory.
Classification can replace the trajectory object again. These React-side
camera writes explain the visible selection snap and the temporarily stale view
after deselection.

### 2.3 Official Stellarium behavior

Official Stellarium source retrieved on 2026-08-20 confirms:

- `MountEquinoxEquatorial` transforms J2000 directions into the equinox
  equatorial mount frame before pointer deltas are calculated.
- `dragView` inverse-projects consecutive pointer positions, converts both to
  the active mount frame, and calls `panView` with longitude/latitude deltas.
- `panView` rebuilds the view in the mount frame and normally resets the mount
  up vector to `(0,0,1)`, with explicit pole handling.
- Selection on an ordinary click disables tracking; moving/centering on the
  selected object is a separate double-click, middle-click, Space, or tracking
  action.

Primary sources:

- Stellarium `StelMovementMgr.cpp`, mount selection, click handling,
  mount-frame transforms, `dragView`, and `panView`:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelMovementMgr.cpp>
- Stellarium `StelCore.cpp`, explicit equatorial/Alt-Az transform composition:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelCore.cpp>
- Stellarium stereographic projector retained from the prior rewrite:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelProjectorClasses.cpp>

## 3. Camera and mount model

The stereographic projector and FOV limits remain unchanged. The interactive
camera changes from the horizontal mount frame to an equatorial mount frame.

The horizontal world axes remain:

- X: east;
- Y: local zenith;
- Z: north;
- azimuth clockwise from north;
- altitude above the mathematical horizon.

For observer latitude `phi`, the north celestial pole in horizontal world
coordinates is `(0, sin(phi), cos(phi))`. The equatorial mount frame uses this
as its positive latitude pole. Its equatorial plane is perpendicular to that
pole, and its screen-up tangent points toward increasing declination.

The camera retains a horizontal forward direction for interoperability with
catalogue, panorama, mask, FOV, and hit-test data, but also carries an explicit
orthonormal mount frame. A camera constructor must derive right/up from the
equatorial pole rather than local zenith. Near either celestial pole, it uses a
deterministic longitude tangent and never derives orientation from unstable
floating-point residue.

## 4. Gestures

One-finger drag remains incremental. Previous and current screen points are
inverse-projected through the currently displayed camera, converted into the
equatorial mount frame, and applied as mount longitude/declination deltas. The
next camera is rebuilt from the same equatorial frame. Release commits the
already displayed state exactly once.

Pinch remains Stellarium-style FOV-only zoom. It cannot change view centre or
mount orientation.

## 5. Selection and deselection

- Tapping a DSO selects it without changing centre, FOV, basis, or atlas state.
- Closing/deselecting it leaves those values byte-for-byte unchanged.
- Arrival of base trajectory, cached classification, fresh classification,
  target details, or marker state cannot write camera state.
- Selecting from the target list also preserves the current view under this
  direct owner decision. An explicit future focus action may be specified
  separately; no hidden auto-fit remains.

This intentionally supersedes the automatic positioning language in section
10.3 of the root v1 specification for the current Sky View interaction.

## 6. Trajectory geometry

A fixed equatorial target has constant declination and traces a small circle
around the celestial pole. Stereographic projection maps that spherical circle
to a screen circle (or the straight-line limiting case). Tests must generate
fixed-declination directions in the equatorial mount frame, transform them to
horizontal directions, and prove that their projected radii agree within
numerical tolerance at representative camera attitudes.

The visible arc is the portion belonging to the selected observing window, not
an invented 24-hour path. Each one-minute rendering sample remains an actual
astronomy evaluation. No great-circle interpolation is reintroduced. Normal
near-horizon refraction may create the physically correct small departure from
an ideal unrefracted circle.

Base geometry must continue to appear before mask classification. Selecting or
deselecting cannot wait on classification and cannot clear or reposition the
camera.

## 7. Guides and overlay compatibility

- The celestial equator is rendered from equatorial coordinates and is locally
  horizontal in the equatorial mount.
- The local horizontal grid, horizon, cardinals, panorama, mask, and telescope
  FOV remain horizontal-coordinate geometry. They are projected through the
  equatorial camera and therefore show the correct observer-dependent tilt.
- Panorama image placement and mask operations remain unchanged on disk.
- Project/inverse-project identity for horizontal directions must hold under
  the equatorial camera at seam, horizon, zenith, and pole-adjacent cases.
- Visibility classification stays independent of camera and overlay opacity.

## 8. Acceptance criteria

- Selection, trajectory arrival, classification arrival, and deselection cause
  zero camera commits and zero centre/FOV/basis changes.
- The celestial equator's local tangent is horizontal at multiple equatorial
  longitudes and camera FOVs.
- A camera facing the north celestial pole renders fixed-declination paths as
  concentric circles; arbitrary equatorial attitudes preserve the general
  screen-circle invariant.
- Equatorial drag preserves the grabbed sky direction within pointer tolerance,
  remains stable through longitude wrap and both celestial poles, and has
  byte-identical held/released state.
- Pinch retains centre and orientation exactly.
- Catalogue, target outline, trajectory, markers, panorama, mask, FOV, and hit
  testing share the same camera and remain registered during gestures.
- Full automated gates and native release assembly pass.
- Exact-release visual QA passes on representative and constrained Android phone
  viewports with no selection/deselection snap, no trajectory S-fold, no overlay
  swimming, no crash/ANR/React/Skia error, and measured frame pacing.

## 9. Privacy, persistence, and non-goals

There is no schema, migration, permission, dependency, network, account,
analytics, or logging change. Precise locations and user panoramas remain local
and must not appear in fixtures, screenshots, or logs.

This correction does not add a 24-hour visibility screen, constellations,
photographic sky texture, atmosphere, landscape, object tracking, an equatorial
mount toggle, or automatic target centring.
