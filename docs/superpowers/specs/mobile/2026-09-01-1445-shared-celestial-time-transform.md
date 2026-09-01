# Shared Celestial Time Transform

**Timestamp:** 2026-09-01 14:45 +03:00 (Europe/Sofia)  
**Status:** Approved for implementation by direct product-owner instruction  
**Branch:** `feature/atlas-shared-time-transform`  
**Controlling specifications:** `astro-visibility-spec.md`,
`docs/superpowers/specs/mobile/2026-08-20-0942-stellarium-sky-engine-rewrite.md`

## 1. Purpose and user outcome

Make time movement a first-class real-time transform of one stable celestial
sphere. Dragging the observing-time slider shall rotate stars, catalogue
targets, constellation figures, the Milky Way, registered DSO imagery, and the
selected target's current-time marker continuously, including while a selected
visibility arc is displayed.

The app shall stop rebuilding complete horizontal-coordinate arrays and React
scene data for every preview timestamp. Camera motion and time motion shall both
be renderer-owned shared transforms over fixed celestial data.

This work must also preserve static pan and zoom performance. Moving time onto
the render thread is not sufficient if the renderer still reconstructs
thousands of expensive star paths per frame, so the staged implementation
includes measurement and batching of the affected celestial layers.

## 2. Scope

In scope:

- a fixed, typed J2000 unit-vector representation for celestial geometry;
- a window-scoped J2000-to-observed-horizontal time transform;
- a shared scene timestamp consumed by Skia worklets without a React render;
- renderer integration for stars, catalogue marks, constellation figures and
  labels, Milky Way atlas meshes, registered DSO meshes, and the selected
  target's current-time position;
- stable J2000 spatial lookup for resident selection and hit testing;
- a native/shared-value time-slider preview path with an exact final commit;
- keeping selected trajectory geometry and visibility classification stable
  while the timestamp moves inside the same observing window;
- performance instrumentation, automated numerical regression tests, Android
  visual QA, and physical-device performance measurement.

Out of scope:

- changing catalogue membership, target density, star magnitude bands, DSO
  image coverage, layer order, colours, opacity, or visual styling;
- changing trajectory sampling, obstruction classification, panorama/mask
  coordinates, persistence, permissions, or local data formats;
- adding a dependency, network access, service, analytics, or telemetry;
- weakening astronomical correctness or dropping intermediate functionality to
  meet a frame-rate target.

## 3. Coordinate and time model

### 3.1 Fixed celestial data

Every celestial vertex is stored as a unit vector in the documented J2000
equatorial frame:

- `j2000UnitVectorX`: right ascension 0 h, declination 0 degrees;
- `j2000UnitVectorY`: right ascension 6 h, declination 0 degrees;
- `j2000UnitVectorZ`: north celestial pole.

Stars, catalogue target centres, constellation vertices and labels, Milky Way
mesh vertices, and registered DSO mesh vertices use this same representation.
Texture coordinates, indices, object identity, magnitudes, colours, image
sources, and catalogue metadata remain immutable alongside those vectors.

### 3.2 Window-scoped transform

When the observing profile or noon-centred observing window changes, JavaScript
builds a small immutable transform description using the existing pinned
Astronomy Engine adapter. It contains the observer latitude, longitude,
elevation contract, UTC time anchors, sidereal rotation anchors, and the
J2000-to-equatorial-of-date rotation required for that window.

A worklet-safe pure function converts a J2000 vector at any timestamp in the
window into the app's horizontal vector frame:

- X: east;
- Y: observed altitude/up;
- Z: north.

It applies the same `normal` optical-refraction formula as the authoritative
adapter after geometric altitude is known. Refraction is not folded into the
linear rotation matrix because it is altitude-dependent.

The preview transform may use window-scoped interpolation only after fixtures
prove the error bound below. If one midpoint/sidereal-rate anchor does not meet
the bound, add bounded sidereal/precession anchors rather than weakening the
acceptance tolerance.

### 3.3 Accuracy boundary

- The final committed timestamp continues to use the authoritative Astronomy
  Engine path for state used by labels, counts, selection details, and other
  non-render calculations.
- Across any supported ordinary, 23-hour, 24-hour, or 25-hour noon-centred
  window, the render-thread preview must differ from the authoritative adapter
  by at most `0.0001` degree angularly and by at most `0.5` screen pixel on a
  1080-pixel minimum canvas dimension at the 0.25-degree maximum zoom.
- Tests cover the north seam, both celestial poles, zenith proximity, the
  geometric horizon and refraction boundary, high and low observer latitudes,
  multiple seasons, and both ends plus interior samples of 25-hour windows.
- Units and frames remain explicit at every API boundary. UTC milliseconds are
  never interpreted as local civil time.

## 4. Runtime ownership

### 4.1 Renderer-owned fast path

Two shared values drive frame-critical projection:

1. the existing planetarium camera;
2. the selected scene timestamp in UTC milliseconds.

Skia derives the observed horizontal direction and screen point from fixed
J2000 geometry, the window transform, the shared timestamp, and the shared
camera. A time preview does not replace full star, catalogue, constellation,
Milky Way, or DSO arrays in React.

Preview updates are latest-value-only. The app must never queue obsolete scene
timestamps behind the user's finger.

### 4.2 JavaScript control path

JavaScript retains responsibility for behavior that need not run every frame:

- date/time and condition text;
- catalogue label membership and collision layout;
- visible-suitable-target count and mask classification;
- resident/candidate publication when conservative renderer overscan is
  insufficient;
- accessibility values;
- the exact timestamp commit and observing-window change;
- target information and exact current horizontal coordinates.

These updates are sampled/coalesced during a drag and exact on release. The
informational visible-target count may remain at its last committed value during
direct manipulation, but must refresh promptly after release. No stale control
path update may overwrite a newer timestamp.

## 5. Catalogue residency and interaction

The catalogue's spatial identity is fixed in J2000, so the expensive spherical
index must not be rebuilt from 13,371 new horizontal objects for every time.
Candidate lookup transforms the camera/view direction into J2000 and queries a
stable index, or applies an equivalently bounded fixed-vector query.

Requirements:

- selected targets always remain resident;
- target density and prominence rules remain unchanged;
- ordinary time motion reveals correct adjacent targets without waiting for
  release or flashing an empty atlas;
- label decisions may be sampled, but marks and angular outlines move every
  rendered preview frame;
- tap hit testing uses the release timestamp and camera, inverse-projects to a
  celestial direction, and cannot depend on stale label nodes;
- registered DSO centres are culled conservatively before their full image
  meshes are projected; a selected DSO is never omitted.

## 6. Selected trajectory behavior

A selected trajectory represents the whole observing window in horizontal sky
coordinates. It therefore remains mounted and unchanged while the timestamp
moves within that same window.

During time dragging:

- visible/blocked segments, transition labels, and 30-minute markers remain;
- the selected target and its current-time marker move continuously;
- obstruction visibility is not recalculated for every preview timestamp;
- crossing into a different owning noon-to-noon window performs the existing
  cancellable trajectory/window recalculation exactly once for the new window;
- no-mask versus completed-partial-mask semantics remain unchanged.

## 7. Rendering and performance budgets

- The slider thumb, shared timestamp, camera, and celestial sphere target 60 Hz
  on the Galaxy S24 Ultra during representative wide and narrow views with a
  selected trajectory.
- The existing release requirement remains at least 50 fps at p95 with no stall
  over 100 ms on the documented representative mid-range physical Android
  device.
- A preview timestamp must not trigger an O(full catalogue) React render or
  allocate complete replacement horizontal-coordinate arrays.
- Star cores and haloes must retain their current visual behavior, but their
  frame path must use bounded batches/vertices or another existing-Skia
  primitive proven faster than reconstructing two or three circle paths per
  star per frame.
- Milky Way and DSO textures retain current mesh density unless measurements
  prove a behavior-preserving representation. No texture or DSO may be removed
  for performance.
- Panorama, mask, horizontal grid, horizon, and trajectory are already in the
  local horizontal frame and must not be routed through the celestial-time
  transform.
- Benchmarks report layer counts, frame percentiles, jank, stalls, device,
  build variant, selected target/arc state, FOV, and enabled overlays.

## 8. Implementation stages

### Stage 1: regression harness and transform foundation

- Record current full-catalogue and frame baselines.
- Add failing fixtures for a worklet-safe J2000 time transform across all
  accuracy cases.
- Implement typed J2000 vectors, window transform construction, normal
  refraction, forward projection, and inverse direction transformation.
- Prove final and preview equivalence before integrating a visual layer.

### Stage 2: immutable celestial assets

- Convert or prepare stars, catalogue centres, constellation geometry, Milky
  Way vertices, and DSO meshes as fixed J2000 vectors.
- Cache DSO mesh topology and texture coordinates once.
- Preserve deterministic generated assets and their provenance.

### Stage 3: shared renderer time and background layers

- Introduce the shared scene timestamp without changing slider commit behavior.
- Move Milky Way, constellation, star, and DSO image rendering to the shared
  celestial projector in independently testable steps.
- Measure after each layer; replace the star circle-path hot path if required
  before claiming live-time performance.

### Stage 4: catalogue marks, residency, labels, and hit testing

- Replace timestamp-rebuilt horizontal catalogue indexing with fixed J2000
  indexing/query behavior.
- Move marks and outlines onto the shared projector.
- Keep sampled/coalesced labels, counts, accessibility, and exact committed
  state correct.
- Verify selection and target focus at moving timestamps.

### Stage 5: live observing-time interaction

- Connect slider movement to the shared timestamp on the UI/render path.
- Coalesce JavaScript preview text/control updates and always publish the exact
  release value.
- Preserve the active selected trajectory within a window and correctly change
  ownership at noon, midnight, DST gaps, and DST folds.
- Confirm no obsolete update can snap the sky after release.

### Stage 6: hardening and branch-only test builds

- Run format, typecheck, lint, focused tests, full tests, and build in required
  order.
- Build all Android test APKs from `feature/atlas-shared-time-transform`; do not
  switch to or build this feature from `main`.
- Perform representative and constrained visual QA plus physical-device frame
  measurement with static pan, zoom, live time, selected arc, DSO imagery,
  panorama, and mask.
- Compare exact committed coordinates and screenshots against the pre-refactor
  release before requesting product-owner readiness review.

## 9. Test-first acceptance criteria

- New transform tests fail before implementation and pass afterward without
  weakening existing authoritative fixtures.
- Fixed-vector render projection matches the current horizontal-vector render
  projection within the stated angular and screen tolerances.
- Time preview changes visible celestial positions without changing React
  celestial-array identities.
- Horizontal layers do not move when only the celestial timestamp changes.
- Stars, constellation lines, Milky Way, target marks/outlines, labels, DSO
  images, and selected current position remain mutually registered at wide and
  maximum zoom.
- Selected arc geometry and classification identities remain stable across
  same-window previews and change correctly with a new observing window.
- Drag release cannot snap the sky to an older preview or leave the displayed
  label/time inconsistent with the exact committed instant.
- Catalogue discovery density, selected-target residency, DSO reveal, and tap
  selection remain functionally identical.
- No new dependency, permission, persistence migration, network behavior, or
  sensitive logging is introduced.

## 10. Safety and rollback

Each visual layer moves in a focused commit after its transform tests pass. The
branch remains isolated until the product owner accepts or rejects it. Main is
not modified by this work. If a layer fails numerical, visual, or performance
acceptance, retain the last passing stage on this branch and report the exact
blocker rather than merging a mixed old/new coordinate path.
