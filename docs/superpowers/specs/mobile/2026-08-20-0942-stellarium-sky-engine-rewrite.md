# Stellarium-style Sky Engine Rewrite

**Timestamp:** 2026-08-20 09:42 +03:00  
**Status:** Approved for implementation by direct owner instruction on
2026-08-20

## 1. Purpose and user outcome

Replace the current Sky View navigation and trajectory implementation with a
coherent planetarium engine derived from Stellarium's official source behavior.
The view must feel like rotating a stable celestial sphere from the observer's
position, not dragging a projected image or orbiting an off-centre camera.
Dragging, pinching, release, catalogue updates, reference lines, selected-target
paths, panorama, and mask must remain registered to the same sky directions.

This is an approved rewrite boundary. Existing renderer code may be retained
only where it satisfies this specification cleanly. Compatibility with current
local profiles, equipment, catalogue, panorama, and mask data is required.

## 2. Why the previous correction is insufficient

The previous correction copied Stellarium's default stereographic projection but
not its camera controller or path construction. That mixed incompatible models:

- Astrovisibility stores and rotates a free three-axis camera basis. A pan can
  preserve or accumulate roll. Stellarium's default mode is an Alt/Az mount and
  mouse motion re-establishes the mount-frame up vector.
- Astrovisibility anchors zoom to the initial two-finger focal sky direction.
  Stellarium touch pinch changes only field of view with
  `previousFov / scale`; it does not move the camera centre.
- Astrovisibility derives a held gesture from a gesture-start camera, while
  Stellarium unprojects the previous and current pointer positions against the
  current view and applies incremental azimuth/altitude deltas.
- Catalogue membership and label collision work crosses the UI/React boundary
  during movement, allowing a visually stable sphere to be disturbed by delayed
  candidate/layout updates.
- Astrovisibility hides the selected path while waiting for full asynchronous
  obstruction classification.
- Its path densification follows great-circle chords between coarse horizontal
  samples. A fixed deep-sky target follows a diurnal small circle about the
  celestial pole, so great-circle interpolation constructs the wrong curve.

The projection was not the only defect. This specification replaces the whole
inconsistent interaction and path pipeline.

## 3. Stellarium source findings

The reference is official Stellarium source retrieved on 2026-08-20, not a
visual guess:

1. `StelCore::getDefaultProjectionTypeKey()` defaults to
   `ProjectionStereographic`.
2. `StelProjectorStereographic` uses the standard paired stereographic forward
   and inverse transforms, scales FOV with `2*tan(fov/2)`, and caps FOV at
   235 degrees.
3. `StelMovementMgr` defaults `navigation/viewing_mode` to `horizon`, selecting
   the Alt/Az mount. Equatorial mount is an explicit alternate mode.
4. During drag, Stellarium repeatedly calls
   `dragView(previousX, previousY, x, y)`, then replaces the previous pointer
   position. It unprojects both points, converts them into the active mount
   frame, and pans by their azimuth/altitude difference.
5. After ordinary pointer motion, Stellarium resets the simplified mount-frame
   up vector to `(0, 0, 1)`. It has explicit stable handling near zenith/nadir,
   where forward and global-up otherwise become degenerate.
6. During pinch, Stellarium saves the starting FOV and applies
   `zoomTo(previousFov / scale, 0)`. The pinch centroid is not used to rotate or
   translate the view.
7. Stellarium models horizontal, observed/refracted, equatorial, mount, and view
   frames separately. Stellarium Web Engine describes horizontal coordinates as
   X north, Y east, Z up and keeps explicit frame rotation matrices.
8. Stellarium exposes horizontal/azimuthal and equatorial grids as different
   overlays. A level horizon and a celestial equator are not the same line.

### Interpretation of the apparent grid tilt

The default view is level to the local Alt/Az mount. The mathematical horizon is
therefore horizontal when the camera looks level, and local zenith defines
screen-up away from the zenith singularity. The celestial equator is a
sky-fixed great circle. Its displayed angle relative to the horizon depends on
observer latitude, local sidereal time, camera direction, and projection. It is
not merely Earth's axial obliquity. The ecliptic is another distinct great
circle whose angle to the equator does involve obliquity.

Astrovisibility must label and calculate these frames explicitly. It must not
draw an ambiguous screen-fixed degree grid.

## 4. Coordinate and camera model

### 4.1 Authoritative frames

The renderer shall use explicit, typed boundaries for:

- equatorial catalogue coordinates: right ascension/declination and their
  documented epoch;
- topocentric geometric horizontal coordinates: azimuth clockwise from north,
  altitude above the mathematical horizon;
- observed horizontal coordinates: the same axes with the selected refraction
  model applied;
- panorama/mask coordinates: persisted azimuth/altitude directions in the local
  horizontal frame;
- view coordinates: a derived camera basis, never a separately drifting source
  of truth;
- screen coordinates in physical viewport pixels.

Angles are stored in degrees at application boundaries and converted to radians
only in clearly named mathematical functions.

### 4.2 Camera state

The authoritative interactive state is:

- `centerAzimuthDegrees`, normalized to `[0, 360)`;
- `centerAltitudeDegrees`, bounded away from numerical overshoot beyond
  `[-90, 90]`;
- `fieldOfViewDegrees`, bounded by product minimum and Stellarium's
  stereographic maximum of 235 degrees;
- no persistent roll in default Alt/Az mode.

The camera basis is rebuilt from that state in a north/east/up horizontal frame:

- forward points at centre azimuth/altitude;
- right is tangent to increasing azimuth;
- up is the tangent toward increasing altitude;
- the last valid azimuth is retained at zenith/nadir so the tangent frame has a
  deterministic pole limit.

The implementation must never feed a derived floating-point basis back as the
next authoritative state. This prevents orthogonality drift and accumulated
roll.

### 4.3 Stereographic projection

The implementation shall port the paired Stellarium stereographic equations and
FOV scaling into a small pure module with source citations. The FOV diameter is
the smaller viewport dimension, matching Stellarium's projector behavior. The
camera antipode remains non-projectable and is clipped rather than coerced to a
finite point.

All visible geometry uses this one projector and its inverse. No overlay may
retain a cylindrical, affine, or alternate sky mapping.

## 5. Gesture behavior

### 5.1 One-finger drag

On every pointer update:

1. inverse-project the previous and current pointer positions through the
   current camera;
2. convert both directions to mount-frame azimuth/altitude;
3. apply their signed azimuth/altitude differences incrementally;
4. clamp only true pole overshoot, retain deterministic azimuth at a pole, and
   rebuild the level camera basis;
5. make this updated state the next update's baseline.

One update path owns both gesture preview and committed state. Release publishes
the already displayed values and performs no second camera calculation.

### 5.2 Two-finger pinch

At pinch start, store the current FOV. During pinch set:

`fieldOfView = clamp(startFieldOfView / scale)`.

Pinch does not change azimuth, altitude, or roll. Centroid movement and Android
focal-point noise are ignored for camera motion. One-finger pan is suppressed
while two or more pointers are active, including late recognizer updates and
finalization.

Release commits the already displayed FOV without reprojection or camera
reconciliation.

### 5.3 Selection arbitration

A touch may select a target only if translation stays below the touch slop and
no pinch was recognized. Target hit testing inverse-projects the release point
and queries the spherical target index. It must not depend on stale screen-space
React nodes.

## 6. Stable catalogue atlas

Catalogue marks, outlines, and labels must not drive camera state or visibly
reconcile as an image after release.

- Precompute target horizontal unit vectors for the selected observation instant
  into stable, ID-keyed data.
- Use the existing spherical/spatial index and zoom prominence tiers, with
  hysteresis at tier boundaries.
- Render point/outline geometry in bounded Skia batches rather than one React
  component per catalogue row. A broad overscan set or indexed batch must make
  normal held movement reveal the correct adjacent sky without waiting for
  release.
- Keep target IDs and visual positions stable while a gesture is active.
- Freeze existing label membership/collision decisions during direct
  manipulation. Labels move with their sky points. Recompute the deterministic
  label layout after a short settled interval, then add/remove labels without
  moving the underlying catalogue marks.
- Catalogue refresh may publish candidates but may never write an older camera
  or transform into the live view.
- Selected target and hit-test availability are independent of whether a text
  label survived collision suppression.

Budgets must be established with the full 13,371-object production catalogue,
not only synthetic sparse data.

## 7. Correct and prompt visibility trajectories

### 7.1 Geometric path

A fixed equatorial target traces a small circle about the celestial pole over a
sidereal day. The base path shall be evaluated at actual timestamps by the
authoritative equatorial-to-horizontal adapter, or by an analytically equivalent
rotation with fixture proof. It must not spherical-linearly interpolate between
coarse horizontal endpoints, because that interpolation follows great circles.

Adaptive time sampling may add exact intermediate timestamps until projected
screen error and angular error are below defined tolerances. It may not invent
intermediate directions by geodesic chord interpolation. Projection clipping
splits only at the viewport boundary or stereographic antipode; 0/360 azimuth is
not a path discontinuity.

With refraction disabled, a synthetic constant-declination track shall fit the
expected stereographic circle or straight-line limit within numerical tolerance.
With the normal refraction model enabled, the implementation shall preserve the
physically correct near-horizon departure from that ideal circle rather than
forcing a cosmetic circle. The test suite must bound and document that departure.

### 7.2 Two-phase result

Target selection starts two independent phases:

1. **Base geometry:** calculate and display the complete observing-window path,
   regular 30-minute markers, and selected-target highlight immediately. With no
   completed mask it is labelled unassessed.
2. **Visibility assessment:** classify/refine the same timestamped path against
   the immutable active mask asynchronously. While this runs, keep the neutral
   base path visible with a calculating state. Publish visible/blocked segment
   styling and transition labels progressively or atomically when ready.

The base path must never be set back to `null` merely because classification
started. Cancellation, failure, target change, or window change must not leave a
stale classified path attached to a new selection. A classification failure
keeps the base path and exposes retry rather than hiding the arc.

Existing product accuracy remains:

- five-minute coarse assessment;
- adaptive transition refinement to at most 30 seconds and 0.05 degrees;
- any number of visible/blocked transitions;
- all 30-minute markers retained;
- completed partial-mask directions outside defined visible regions are blocked;
- no mask remains explicitly unassessed.

Mask assessment remains in horizontal sky coordinates and is independent of
screen projection.

### 7.3 Responsiveness

For a representative 12-hour target window, base path feedback must begin within
100 ms on the documented reference device and within one normal render cycle
after calculation completes. Full mask classification must remain cancellable,
cooperatively yielding, cacheable by its complete current key, and must not block
camera input or label motion.

## 8. Reference lines and guides

Replace ambiguous screen-fixed degree rings with calculated spherical guides:

- mathematical horizon and horizontal/azimuthal grid in the local horizontal
  frame;
- cardinal points in the horizontal frame;
- celestial equator and optional equatorial reference grid transformed from the
  equatorial frame at the selected observation instant;
- target FOV, trajectory, panorama, and mask in their documented frames.

Every guide is adaptively tessellated from spherical coordinates and projected
with the same camera. It may be clipped, but must not remain fixed to the screen
during pan or use a separate transform. UI chrome is the only screen-fixed
layer.

## 9. Panorama and mask compatibility

No persistence migration is expected because panorama placement and mask
operations already store horizontal directions. The rewrite must introduce a
renderer-neutral conversion from persisted azimuth/altitude points to horizontal
unit vectors and route both overlays through the authoritative projector.

Required compatibility cases:

- narrow partial panorama;
- multi-tile and corrected placement;
- a tile or polygon crossing north/0 degrees;
- upward capture and geometry crossing or enclosing zenith;
- visible islands, gaps, overhangs, frames, branches, and ordered
  blocked/visible brush corrections;
- simultaneous panorama and mask with independent visibility and opacity;
- wide 235-degree view and narrow telescope-scale view;
- restart loading of the exact active immutable revisions;
- hit testing and mask editing through the projector inverse;
- panorama replacement still requires the existing explicit pair deletion and
  recreation workflow.

Classification results must be identical for a fixed profile/window/target when
only camera, panorama opacity, or mask opacity changes.

## 10. Performance and threading

- Camera and pinch updates remain on the UI/render thread and allocate no
  per-target React state.
- Projection data uses immutable or double-buffered batches. Publishing a new
  batch is atomic from the renderer's perspective.
- Expensive catalogue, label, and mask work is bounded, cancellable where
  applicable, and cannot write camera state.
- Adaptive tessellation uses explicit angular and screen-space error budgets and
  maximum segment counts to prevent malformed or antipodal geometry from causing
  resource exhaustion.
- Selected-target calculation takes priority over full target-list ranking.
- The exact release APK must meet at least 50 fps at p95 with no stall over
  100 ms during representative pan/pinch/selected-path interaction on the
  documented mid-range physical Android reference device. Emulator timings are
  diagnostic and must not be labelled as physical-device proof.

## 11. Failure, privacy, and compatibility behavior

- No account, network, analytics, cloud, or permission change is introduced.
- Precise profile locations and panorama/mask contents remain local and absent
  from logs and fixtures.
- Projection, calculation, or classification errors use safe event names and
  non-sensitive context; they never log coordinates or filesystem paths.
- Existing profile, equipment, panorama, mask, catalogue, and migration formats
  remain readable. Any later discovered need to alter persistence requires a
  forward migration specification before implementation.
- Corrupt or missing overlay files keep the existing recovery behavior and must
  not crash the sky renderer.

## 12. Implementation stages

### Stage A: reference port and regression harness

- Port and cite Stellarium's projection/FOV and movement semantics in pure tests.
- Reproduce the current zoom-centre drift, roll accumulation, held/released DSO
  snap, wrong chord curve, and delayed/missing base path as failing tests.
- Add independent astronomy fixtures and recorded deterministic gesture traces.

### Stage B: level Alt/Az camera and gestures

- Replace authoritative free-basis state with azimuth/altitude/FOV.
- Implement incremental drag, centred pinch, pole handling, release identity,
  inverse hit testing, and one/two-pointer arbitration.
- Route all existing geometric layers through the derived camera.

### Stage C: stable atlas and reference frames

- Batch catalogue marks/outlines and separate them from settled label layout.
- Add hysteresis and deterministic post-gesture labels.
- Calculate horizontal and equatorial guides in their real frames.

### Stage D: trajectory pipeline

- Implement exact-time small-circle sampling and adaptive projected error.
- Display neutral base geometry immediately.
- Attach asynchronous mask assessment without clearing or reconstructing the
  geometric path.

### Stage E: panorama/mask integration

- Consolidate renderer-neutral horizontal geometry.
- Verify display, inverse editing, independent opacity, persistence alignment,
  and classification invariance across all compatibility cases.

### Stage F: release hardening

- Run all automated gates and full-catalogue benchmarks.
- Build the exact release APK and perform representative, constrained, and
  physical-device visual/performance review where hardware is available.
- Compare a documented gesture/zoom/grid/path sequence side by side with
  Stellarium's default Alt/Az stereographic mode.

## 13. Test-first acceptance criteria

### Projection and camera

- Official Stellarium-compatible projection fixtures pass forward/inverse and
  FOV-scale round trips through 235 degrees.
- A centred pinch changes only FOV for noisy and moving centroids.
- A closed drag trace returns within numerical tolerance without roll drift.
- Incremental drag produces the same camera before and after pointer release.
- Repeated seam and near-zenith drags remain finite, continuous, level, and
  deterministic.
- Horizon, equator, cardinal, target, and inverse-hit fixtures agree on one sky
  direction.

### Catalogue stability

- Holding a drag or pinch cannot let delayed React/catalogue work change camera
  azimuth, altitude, or FOV.
- Atlas marks under an unchanged sky direction retain the same screen point
  before and after release.
- Zoom-tier hysteresis prevents boundary flicker.
- Label layout changes never move target marks or selection hit geometry.
- Full-catalogue mounted/rendered work stays within measured budgets.

### Trajectory correctness and latency

- Independent equatorial-to-horizontal fixtures cover north wrap, horizon,
  zenith proximity, circumpolar, never-rise, and cross-midnight windows.
- A fixed-declination, refraction-off diurnal path fits the corresponding
  stereographic circle/line within tolerance at multiple camera attitudes.
- Adaptive samples are actual evaluated timestamps and never great-circle
  interpolants.
- Path time order, all 30-minute markers, and all visibility transitions survive
  viewport and antipode clipping.
- The neutral base path appears before a deliberately delayed classifier and
  remains visible on classifier error/cancellation.
- Existing transition accuracy and multi-crossing tests remain green.

### Panorama and mask

- Golden direction fixtures verify seam, zenith, partial, wide, and narrow
  display alignment.
- Project then inverse-project editing round trips within the mask precision
  budget.
- Panorama and mask opacity/toggles do not alter camera or classification.
- Restart reloads matching immutable panorama/mask revisions with identical sky
  alignment.

### Visual and device review

- Inspect the exact release on a representative Android phone and a constrained
  phone viewport.
- Exercise slow and fast pan, closed-loop pan, symmetric pinch, noisy-centroid
  pinch, min/max zoom, north seam, zenith, dense atlas, target selection,
  calculation delay/error, panorama+mask, opacity, inverse mask editing, Android
  back, restart, and orientation change.
- Review video or frame captures for held/released snapping, roll drift, label
  flicker, grid disagreement, path S-folds, delayed selection feedback, overlay
  swimming, clipping, crashes, ANRs, and React/Skia/worklet errors.

## 14. Non-goals

- Embedding or linking Stellarium Desktop or Stellarium Web Engine.
- Copying Stellarium's catalogue, UI chrome, atmosphere, landscape, star art,
  telescope control, tracking mount, or equatorial navigation mode.
- Replacing the approved astronomy adapter without evidence that its coordinate
  output is wrong.
- Changing local data formats, permissions, profile workflow, mask semantics,
  target ranking rules, or v1 product scope.
- Forcing refracted near-horizon positions onto a cosmetically perfect circle.

## 15. Sources and licensing boundary

The implementation may reproduce standard mathematical behavior and independently
written algorithms, tests, and source citations. It shall not copy substantial
GPL/AGPL implementation text into the MIT/application source.

Primary references:

- Stellarium `StelCore.cpp`, default projection and frame/projector composition:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelCore.cpp>
- Stellarium `StelProjectorClasses.hpp/.cpp`, stereographic equations, FOV
  scaling, and 235-degree maximum:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelProjectorClasses.hpp>
  and
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelProjectorClasses.cpp>
- Stellarium `StelMovementMgr.cpp`, default horizon mount, incremental drag,
  mount up-vector handling, and centred pinch:
  <https://github.com/Stellarium/stellarium/blob/master/src/core/StelMovementMgr.cpp>
- Stellarium Web Engine `observer.h`, explicit horizontal/observed/equatorial/
  mount/view frames and north/east/up convention:
  <https://github.com/Stellarium/stellarium-web-engine/blob/master/src/observer.h>
- Stellarium Web Engine example, separate azimuthal and equatorial grid controls:
  <https://github.com/Stellarium/stellarium-web-engine/blob/master/apps/simple-html/stellarium-web-engine.html>

If upstream behavior changes during implementation, tests remain pinned to the
retrieved behavior documented here until the owner approves a new reference.
