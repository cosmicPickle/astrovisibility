# Astrovisibility V1 Development Stages

**Created:** 2026-08-19 12:17 +03:00 (Europe/Sofia)

**Status:** Approved by product owner on 2026-08-19; implementation authorized

**Controlling product specification:** `astro-visibility-spec.md`

**Target:** Android-first local prototype in `apps/mobile`

## 1. Purpose

This specification turns the product requirements into an ordered development
sequence. It deliberately proves the three highest-risk capabilities early:

1. accurate deep-sky coordinate and time calculations;
2. direction-aware partial panorama capture; and
3. a precise two-dimensional angular visibility mask.

The result of the sequence is a useful offline Android prototype. It lets an
observer define an exact observing position, capture only the surroundings that
matter, draw the visible sky, browse deep-sky objects, inspect target paths, and
rank suitable targets by usable visible time.

This document resolves the open product questions needed for a prototype. Those
decisions are defaults, not permanent visual commitments. They may be revised
after testing the working app without changing the core product model.

## 2. Product Boundary

### 2.1 In scope

- An Android mobile app built with Expo and React Native.
- Multiple local observing profiles.
- Custom telescope/camera configurations.
- Offline Messier, NGC, IC, and Caldwell target data.
- An interactive sky view from horizon through zenith.
- Direction-aware partial or complete capture of the observer's surroundings.
- A two-dimensional editable visible-sky mask.
- Target trajectories classified against that mask.
- A target list ranked by usable visible duration and, when applicable, optical
  suitability.
- A release APK at the end of the prototype sequence.

### 2.2 Out of scope

- Accounts, sync, sharing, remote storage, analytics, or a server.
- iOS release acceptance. The architecture should remain cross-platform where
  Expo permits, but Android is the only prototype release gate.
- Automatic computer-vision sky segmentation.
- Photometric image stitching, exposure matching, or seamless panorama blending.
- Commercial equipment databases.
- Telescope control or hardware integration.
- Photorealistic DSO imagery.
- Weather, cloud, Moon brightness, light-pollution, or imaging-quality scoring.
- Full-camera-frame obstruction tests. V1 tests the target centre against the
  mask, while still drawing the selected equipment field of view.

## 3. Approved Architecture

### 3.1 Repository and application

- Keep the pnpm monorepo.
- Build the product in `apps/mobile`.
- Reserve `apps/api` for a future, separately approved server; do not scaffold it
  during this sequence.
- Keep mobile-only modules inside `apps/mobile`. Create a `packages/*` package
  only when a second concrete consumer exists.
- Use strict TypeScript and explicit unit-bearing names and types.

### 3.2 Mobile stack

Adopt the following stack for the prototype:

- Expo and React Native;
- Expo Router with native stack navigation;
- gluestack-ui primitives and NativeWind-compatible styling, following the
  compact Rallypath mobile language;
- React Native Gesture Handler and Reanimated for pan, zoom, drawing, and
  responsive UI-thread interactions;
- React Native SVG for the initial sky, trajectory, field-of-view, panorama tile,
  and mask layers;
- Zod at persisted/imported data boundaries;
- Expo Camera for guided capture;
- Expo Sensors for device attitude and motion samples;
- Expo Location for profile location and heading assistance;
- Expo FileSystem for durable captured images and generated mask assets;
- Expo SQLite for structured local data and migration history.

React Native SVG is the prototype renderer. If measured catalogue density or
mask complexity cannot meet the performance gates in section 15, a later spec
may approve a Skia or native rendering path. Do not add one pre-emptively.

### 3.3 Astronomy and catalogue stack

- Use `astronomy-engine` 2.1.x (2.1.19 at this decision) behind a small
  Astrovisibility-owned adapter for time, solar-altitude searches, and
  equatorial-to-horizontal calculations. Lock the exact installed version.
- Import pinned OpenNGC release `v20260501` at build time, never at runtime.
- Include NGC/IC objects, Messier memberships, common names, angular axes,
  position angles, magnitudes, types, and aliases where the source provides
  them.
- Add a reviewed 109-object Caldwell cross-reference derived from the
  Astronomical League list. Resolve its aliases against OpenNGC and explicitly
  curate the few entries that have no NGC/IC identity.
- Emit a compact normalized catalogue artifact and provenance manifest. Do not
  ship the importer or raw source columns into runtime storage unless required
  for licence compliance or debugging.
- Preserve OpenNGC attribution and CC BY-SA 4.0 notices with the bundled derived
  catalogue. Record source URL, upstream release/tag, retrieval date, transform
  version, licence, and object counts.
- The app must work without network access after installation.

Popular, maintained astronomy libraries and authoritative astronomy data may be
used without another technology-approval question. Every adopted source still
requires licence, provenance, security, compatibility, and data-quality review.

## 4. UX Direction

### 4.1 Visual language

Use Rallypath's compact, content-led mobile UX as the baseline, adapted from
green/fitness to blue-violet/space:

| Token | Prototype value | Use |
| --- | --- | --- |
| Backdrop | `#05070D` | Sky canvas and deepest background |
| Background | `#080B12` | App background |
| Surface | `#111827` | Cards and sheets |
| Surface elevated | `#182235` | Inputs and elevated panels |
| Surface raised | `#202C42` | Selected and active surfaces |
| Outline | `#2B3A55` | Dividers and borders |
| Text | `#F4F7FF` | Primary content |
| Muted text | `#A5B1C6` | Secondary content |
| Primary | `#5B9CFF` | Main actions and visible trajectory |
| Primary pressed | `#397DE8` | Pressed state |
| Space violet | `#8A7DFF` | Selection and secondary highlight |
| Blocked | `#7B8497` | Blocked/dashed trajectory |
| Warning | `#F5B942` | Sensor/time/coverage warnings |
| Danger | `#FF6B78` | Destructive actions and errors |

- Dark theme only for the prototype.
- Use approximately 8 px card radius and 10 px control radius.
- Keep all touch targets at least 44 by 44 logical pixels.
- Use compact editorial hierarchy: small section labels, strong content values,
  and restrained borders rather than large decorative containers.
- Avoid generic space wallpaper. The sky data, panorama, and trajectory are the
  visual focus.
- Maintain accessible contrast, font scaling, non-colour status cues, and clear
  focus/pressed/disabled states.

### 4.2 Navigation

- Root native stack: Dashboard -> Profile Sky View -> Target List.
- Profile, equipment, capture, mask editing, target information, and date/time
  editing open as full-screen stack routes or bottom sheets according to task
  length.
- Do not add a bottom tab bar for v1.
- The Sky View has a compact top bar with Back, profile name, date/time, and an
  upper-right overflow menu.
- Persistent sky controls are limited to overlay controls, equipment selection,
  and `View All Targets` at the lower-right.
- A selected target opens a draggable compact bottom sheet; it does not reserve a
  permanent panel over the sky.

### 4.3 Empty, loading, error, and permission states

- Every screen must have deliberate empty, loading, failure, and retry behavior.
- Ask for camera, motion, and precise location permissions only when the user
  starts a relevant action, with an explanation before the platform prompt.
- A denied permission must offer manual alternatives where practical: manual
  coordinates and timezone, imported/captured image selection, and manual
  orientation correction.
- Sensor accuracy is advisory, never silently trusted. Show poor heading accuracy
  and allow review/correction before saving.
- Never log precise coordinates, captured surroundings, or mask geometry.

## 5. Core Data Model

SQLite owns structured records and migration state. Expo FileSystem owns image
files and optional raster cache files under the app's durable document directory.
Database rows refer to files by app-relative path, never transient camera URIs.

### 5.1 Profile

- `id`
- `name`
- `latitudeDegreesNorth` in `[-90, 90]`
- `longitudeDegreesEast` in `[-180, 180]`
- `elevationMetersAboveMeanSeaLevel`, default `0`
- `timeZoneId` as an IANA identifier, initially the device zone and editable
- `createdAtUtc`, `updatedAtUtc`
- optional active panorama revision and completed mask revision

Location capture stores the accepted value and reported horizontal accuracy. It
does not continuously track the user.

### 5.2 Equipment configuration

- `id`, `name`
- `focalLengthMillimeters`
- `apertureMillimeters`
- `sensorWidthMillimeters`
- `sensorHeightMillimeters`
- `pixelSizeMicrometers`
- optional `frameRotationDegrees`, default `0`
- `createdAtUtc`, `updatedAtUtc`

Derived values are calculated rather than persisted unless a cache has an
explicit invalidation version:

```text
horizontalFov = 2 * atan(sensorWidth / (2 * focalLength))
verticalFov   = 2 * atan(sensorHeight / (2 * focalLength))
pixelWidth    = sensorWidth * 1000 / pixelSize
pixelHeight   = sensorHeight * 1000 / pixelSize
```

### 5.3 Catalogue target

- stable canonical ID independent of display name;
- preferred common name plus normalized aliases;
- Messier, NGC, IC, and Caldwell memberships where present;
- J2000 right ascension in sidereal hours and declination in degrees;
- major/minor angular axes in arcminutes and position angle in degrees where
  known;
- magnitude, object type, constellation, and source metadata where known;
- a deterministic prominence tier derived at build time.

One physical object has one runtime record even when several catalogues name it.
Alias search is case-insensitive and tolerant of spaces and common catalogue
punctuation.

### 5.4 Panorama revision and tiles

A saved panorama is a direction-aware mosaic, not necessarily a single blended
bitmap. It contains:

- immutable revision ID and profile ID;
- ordered image tiles;
- durable image path and dimensions per tile;
- centre azimuth, centre altitude, and roll in degrees;
- estimated horizontal and vertical field of view;
- capture timestamp, heading accuracy, and orientation confidence;
- optional user-applied azimuth/altitude/roll correction;
- coverage polygon in normalized angular coordinates;
- capture calibration/version metadata.

The source tiles remain authoritative. Render-time overlap and soft edge blending
are allowed, but destructive stitching is not required.

### 5.5 Mask revision

The mask is vector-first and references exactly one panorama revision. It stores:

- immutable revision ID;
- ordered visible-region polygons;
- ordered blocked and visible correction strokes with angular brush radius;
- an edit history sufficient for in-session undo/redo;
- coverage bounds, format version, and timestamps.

After completion, a query inside a marked visible region is visible unless a
later blocked correction covers it. A later visible correction can reopen it.
Every other direction is blocked. A profile without a completed mask is a
separate `noMask` condition and must not report obstruction-derived results.

## 6. Coordinate, Time, and Visibility Contract

### 6.1 Frames and projection

- Catalogue input is J2000 equatorial coordinates.
- The astronomy adapter is solely responsible for the library-specific
  conversion into the form required for horizontal coordinates at an instant.
- Horizontal azimuth is degrees clockwise from true north: north `0`, east `90`,
  south `180`, west `270`.
- Horizontal altitude is degrees above the astronomical horizon: horizon `0`,
  zenith `90`.
- Panorama and mask geometry use the same horizontal frame.
- The sky canvas uses an equirectangular horizontal projection: azimuth along X,
  altitude along Y, with seamless 0/360 horizontal wrapping.
- The main sky canvas clamps vertical navigation to the relevant hemisphere from
  horizon through zenith. Below-horizon trajectory samples may be retained for
  interval calculations but are visually subdued or omitted.

### 6.2 Refraction and validation

Use Astronomy Engine's recommended `normal` atmospheric refraction consistently
for rendered target altitude, horizon crossing, trajectory classification, and
time labels. The adapter must make this choice explicit and covered by fixtures.
Do not mix refracted and geometric altitude within one result.

Before the adapter is accepted, compare representative results against
independently sourced, checked-in reference fixtures. Cover both hemispheres,
several seasons, 0/360 azimuth wrap, high altitude, horizon proximity, daylight
saving changes, and circumpolar/non-rising targets. Fixture provenance and the
tolerance rationale belong beside the tests.

### 6.3 Instants and observing night

- Store and calculate instants in UTC.
- Interpret the user's chosen civil date in the profile's IANA timezone.
- The default `Tonight` window starts at evening astronomical dusk, when the Sun
  descends through `-18` degrees, and ends at following astronomical dawn.
- If one or both astronomical twilight crossings do not exist, fall back to
  sunset-to-sunrise and display a `No astronomical darkness` note.
- If those crossings also do not exist, use local `18:00` through next-day
  `06:00` and display an explicit fallback warning.
- The date/time control also permits an arbitrary start/end interval up to 24
  hours for inspection.
- Daylight-saving gaps and repeated local times resolve into explicit UTC
  instants before calculation.

### 6.4 Sample classification

For each target sample:

1. `belowHorizon` when refracted altitude is below `0` degrees;
2. `unassessed` when altitude is non-negative and the profile has no completed
   mask;
3. `visible` when altitude is non-negative and the completed mask contains the
   direction as visible;
4. `blocked` otherwise.

Only `visible` contributes to usable visible duration. `unassessed` must never be
presented as known visibility. A completed partial mask makes all uncaptured or
unmarked directions `blocked`.

### 6.5 Sampling and transitions

- Generate a coarse trajectory at five-minute intervals for initial drawing and
  list screening.
- Wherever adjacent samples differ in classification, bisect the time range and
  recalculate until the transition is resolved to within 30 seconds.
- For narrow mask features, adaptively subdivide angular path segments until no
  segment spans more than `0.05` degrees or 30 seconds near a mask boundary,
  whichever is stricter.
- Merge adjacent visible intervals separated only by numerical noise of less than
  30 seconds.
- Round displayed transition times to the nearest minute, while calculating and
  sorting with unrounded instants.
- Draw labelled 30-minute trajectory markers. Collision handling may suppress a
  text label, but not the marker; tapping the marker reveals the exact time.

The `0.05`-degree spatial target and 30-second transition target are prototype
budgets. Stage 0 measures whether they are responsive and meaningful on the
chosen renderer and device. Any relaxation requires a recorded product decision.

### 6.6 Target suitability

When no equipment configuration is selected, do not filter by suitability.

When one is selected, a target is suitable for the prototype when:

- known major/minor angular dimensions fit within 90 percent of the frame in
  either normal or 90-degree-rotated orientation; and
- its projected minor axis is at least 8 sensor pixels.

Targets without usable angular dimensions stay browsable in Sky View but are
excluded from the suitability-filtered target list with an internal `sizeUnknown`
reason. Show the list's active equipment and filter rule in a compact info sheet.

## 7. Panorama Capture Contract

### 7.1 Prototype approach

The prototype builds a logical spherical mosaic from overlapping camera tiles.
Each tile is placed by captured device attitude and reviewed by the user. This
supports a narrow window, a wide wall opening, upward capture, or full 360-degree
coverage without requiring automated image-feature stitching.

### 7.2 Guided capture flow

1. Explain the fixed observing-position requirement and request permissions.
2. Establish true-north heading confidence and show a calibration prompt when
   sensor accuracy is poor.
3. Show a live camera preview with centre reticle, level/roll indicator, cardinal
   heading, altitude, and a miniature angular coverage map.
4. Capture the first tile at any direction chosen by the user.
5. Suggest neighbouring centres with 20-30 percent overlap, but allow free
   capture and allow completion after one tile.
6. Permit upward rows through zenith. Near zenith, keep the angular mapping valid
   even if the compass becomes visually unstable.
7. Review the assembled directional mosaic. Let the user drag tiles for small
   azimuth/altitude correction and adjust roll.
8. Save the panorama revision atomically only after validation succeeds.

Only one camera preview may be active. Every accepted capture must be copied from
its temporary camera URI into the app document directory before the session can
be considered durable.

### 7.3 Capture failure behavior

- Interrupted sessions remain drafts and can be resumed or discarded.
- A missing sensor, poor heading, or denied location permission allows capture
  with manual north/orientation alignment and a visible low-confidence warning.
- A missing camera permission permits image import through the already approved
  image-picker path, followed by manual angular placement.
- Insufficient storage blocks additional captures without corrupting accepted
  tiles.
- Replacing an existing panorama requires explicit deletion of its panorama/mask
  pair and a fresh capture flow.

## 8. Mask Editor Contract

- The initial tool is `Mark visible sky`: tap points to form one or more closed
  visible polygons over the panorama.
- Provide `Blocked brush` and `Visible brush` for fine corrections such as trunks,
  frames, branches, and gaps.
- Brush radius is angular and zoom-independent; show its actual footprint.
- Support pan/zoom, undo, redo, remove region/stroke, reset, and before/after
  preview.
- Drawing wins over panning only while a drawing tool is explicitly active.
- Render the mask as translucent blue for visible and dim neutral for blocked;
  use boundary patterns/outlines so the meaning is not colour-only.
- Completion shows a confirmation: all unmarked and uncaptured directions will be
  blocked.
- Save a new immutable mask revision atomically. Editing later creates another
  revision while retaining the current panorama reference.
- Hit testing and rendering must agree at azimuth wrap and polygon boundaries.

The vector model is authoritative. A raster mask may be generated as a versioned
cache for fast rendering or lookup, but it must be reproducible and invalidated
whenever source geometry changes.

## 9. Sky View Contract

- Pan horizontally with wrap and vertically from horizon to zenith.
- Pinch to zoom around the gesture focal point.
- Render cardinal directions, altitude guides, and restrained coordinate labels.
- At wide zoom, show only top prominence tiers; progressively reveal more targets
  as angular scale increases.
- Use common name as the primary label and catalogue aliases as secondary text.
- Represent DSO angular axes and position angle with a circle/ellipse. Use a
  minimum tappable hit target without pretending the object itself is larger.
- Use spatial bins in horizontal screen space and label collision suppression so
  the full catalogue is never mounted as React elements at once.
- Tapping a target selects it, recentres only when needed, draws the complete
  observing-window trajectory, and opens the compact detail sheet.
- The detail sheet contains common/catalogue names, type, magnitude and angular
  size when known, total visible time or unassessed state, interval summary,
  selected equipment, and a `More Info` expansion.
- Draw the selected equipment field rectangle centred on the target and rotated by
  the saved frame rotation. Make clear that v1 visibility uses the target centre.
- Panorama and mask overlays have independent toggles and 0-100 percent opacity
  sliders and may be shown together.

## 10. Target List Contract

- Calculate the selected observing window for all eligible catalogue targets.
- When equipment is selected, apply suitability before expensive visibility
  refinement.
- Exclude targets that remain below the horizon for the entire interval.
- Rank first by total usable visible duration descending, then longest single
  interval descending, prominence ascending, and preferred name ascending.
- If the profile has no mask, show astronomical above-horizon duration labelled
  `Above horizon; obstructions not assessed`, not `Visible`.
- Each row shows preferred name, catalogue aliases, total duration, every interval,
  and a compact suitability/FOV indication when equipment is selected.
- Compute progressively and expose useful results as batches arrive. The user can
  cancel or leave without losing the profile.
- Tapping a row returns to Sky View with the target selected and positioned for
  trajectory inspection.

## 11. Development Stages

Each stage must be complete and demonstrable within its stated boundary. Use the
test-first and visual/device QA workflow in `AGENTS.md`.

### Stage 0 - Foundation and risk spikes

**Objective:** establish the mobile shell and prove that the proposed calculation,
capture, projection, and mask approach is feasible before building product flows.

**Work:**

- Scaffold `apps/mobile` with Expo, Expo Router, strict TypeScript, root scripts,
  Android native generation, lint, format, tests, and CI.
- Implement the theme tokens and reusable Rallypath-style primitives.
- Build an astronomy adapter spike with checked-in reference fixtures.
- Build a synthetic equirectangular sky canvas with pan, zoom, azimuth wrap,
  target dots, and a trajectory.
- On a physical Android device, capture several camera tiles with recorded
  orientation, including one upward tile, then render them in angular space.
- Draw a polygon and narrow blocked stroke over the synthetic canvas and verify
  point classification across the 0/360 seam.
- Measure the section 15 budgets on the reference device.

**Exit criteria:**

- Coordinate fixtures pass within the documented tolerance.
- A real captured tile remains directionally stable enough to review and correct.
- A one-tile partial panorama, multi-tile mosaic, zenith tile, and seam-crossing
  vector mask can all be represented without changing the data model.
- The chosen SVG/gesture approach meets the prototype interaction budget with
  representative synthetic load.
- Any failed criterion produces a focused replacement architecture decision
  before Stage 1; do not build around an unproven assumption.

**Checkpoint:** technical proof APK for internal use.

### Stage 1 - Catalogue pipeline and local persistence

**Objective:** create trustworthy offline data foundations.

**Work:**

- Implement a deterministic build-time OpenNGC importer, Caldwell cross-reference,
  alias deduplication, validation report, compact artifact, and licence manifest.
- Add SQLite schema/migrations for profiles, equipment, panorama revisions/tiles,
  mask revisions/operations, and user settings.
- Add FileSystem ownership, temp-to-durable moves, orphan cleanup, atomic save
  coordination, and storage error handling.
- Seed/import catalogue data idempotently with a data-version record.
- Add repository setup, data refresh, licence, and migration documentation.

**Exit criteria:**

- The runtime catalogue contains validated Messier, NGC, IC, and all 109 Caldwell
  memberships without duplicate physical objects caused by aliases.
- Re-running the importer with the same pinned inputs is byte-for-byte
  deterministic.
- CRUD and restart tests prove local records and files remain coherent.
- Simulated partial writes do not expose a valid-looking broken panorama/mask.
- Attribution is visible in the app's About/Licences surface.

### Stage 2 - Dashboard, profiles, and equipment CRUD

**Objective:** deliver the complete app entry and local setup experience.

**Work:**

- Dashboard profile and equipment sections with empty states.
- Create/edit/delete profile using current location or manual coordinates,
  elevation, and timezone.
- Create/edit/delete equipment configurations with live validation and derived
  field-of-view preview.
- Select the first saved equipment configuration by default and remember later
  selection per profile.
- Add destructive confirmations and permission denial/retry states.

**Exit criteria:**

- All CRUD survives restart and validation prevents physically invalid values.
- Location denial still permits a usable manually entered profile.
- Deleting equipment updates every affected selection without broken references.
- Dashboard visual QA passes representative small and large Android viewports.

**Checkpoint:** usable local setup APK.

### Stage 3 - Interactive Sky View and catalogue browsing

**Objective:** make every profile useful before any panorama or mask exists.

**Work:**

- Production equirectangular sky renderer and navigation gestures.
- Catalogue projection for the chosen instant, prominence tiers, spatial bins,
  labels, angular outlines, selection, and target information sheet.
- Profile menu, no-mask callout, equipment selector, date/time entry point, and
  `View All Targets` affordance shell.
- Empty/error fallbacks for unavailable or invalid catalogue data.

**Exit criteria:**

- Correct targets appear at fixture-verified horizontal coordinates.
- Panning through north wraps continuously and zenith remains reachable.
- Target density increases with zoom without mounting the whole catalogue.
- Common names lead catalogue-only identifiers when available.
- The screen remains useful and truthful with no equipment and no mask.

### Stage 4 - Target trajectory, observing time, and field of view

**Objective:** provide a useful astronomy planner before obstruction capture.

**Work:**

- `Tonight` and custom observing-window bottom sheet.
- Twilight fallback logic and timezone/DST handling.
- Selected target path, regular 30-minute markers, below-horizon treatment,
  information sheet, and field-of-view rectangle.
- No-mask duration summaries labelled as unassessed for local obstructions.

**Exit criteria:**

- Trajectory fixtures pass across midnight, DST transitions, 0/360 wrap,
  circumpolar cases, and targets that never rise.
- Markers and labels remain inspectable without permanently obscuring the sky.
- Changing profile, date, interval, or equipment invalidates the right caches.
- No UI wording claims local visibility when no completed mask exists.

**Checkpoint:** astronomy-planning prototype APK.

### Stage 5 - Guided partial panorama capture

**Objective:** let a user create and safely persist direction-aware surroundings.

**Work:**

- Permission primer and guided camera/sensor/location capture.
- Live reticle, heading/altitude/roll, accuracy warning, and coverage map.
- Single-tile completion, overlapping tile suggestions, upward rows, draft resume,
  review, manual correction, and atomic save.
- Image import/manual placement fallback.
- Panorama overlay in Sky View with toggle and opacity.

**Exit criteria:**

- A real Android device can save, reopen, and render narrow, multi-tile, and
  upward captures at their reviewed directions.
- The flow works without demanding 360-degree coverage.
- Denial, sensor weakness, interruption, app restart, and insufficient storage
  have recoverable behavior.
- Captured images reside only in durable app-local storage after completion.

### Stage 6 - Visibility mask creation and editing

**Objective:** turn a panorama into the product's binary local-sky model.

**Work:**

- Ordered capture -> mask flow.
- Visible polygons, blocked/visible brushes, pan/zoom, angular brush preview,
  undo/redo, reset, completion warning, and atomic revision save.
- Existing-mask edit flow.
- Mask overlay in Sky View with independent toggle and opacity.
- Explicit delete/recreate panorama-and-mask operation.

**Exit criteria:**

- Multiple islands, gaps, overhangs, frames, trunks, narrow branches, zenith
  regions, and seam-crossing geometry are representable and editable.
- Outside coverage is blocked after completion.
- Mask and panorama overlays align after restart and at every zoom level.
- Replacing a panorama cannot silently retain an incompatible mask.

**Checkpoint:** environment-modelling prototype APK.

### Stage 7 - Obstruction-aware visibility engine

**Objective:** deliver the central target-through-surroundings behavior.

**Work:**

- Adaptive trajectory-to-mask classification and interval derivation.
- Visible continuous segments, blocked dashed/faded segments, transition markers,
  and `Visible until/after` labels.
- Cache keys covering profile location, timezone, observing interval, target,
  panorama/mask revision, astronomy adapter version, and calculation version.
- Background/cancellable calculation boundaries that do not freeze gestures.

**Exit criteria:**

- Unit fixtures cover zero, one, and many obstruction crossings; short gaps;
  isolated branches; tangent boundaries; seam crossings; and outside-coverage
  blocking.
- Transitions are resolved to the section 6.5 tolerance and rounded correctly.
- Editing the mask updates results without stale intervals.
- Panorama opacity never affects calculations; mask geometry alone does.
- No-mask state remains unassessed rather than implicitly visible or blocked.

**Checkpoint:** core Astrovisibility prototype APK.

### Stage 8 - Ranked and equipment-aware target list

**Objective:** help the observer decide what to image.

**Work:**

- Suitability filter and explanation.
- Progressive all-target calculation, deterministic ranking, cancellation,
  interval formatting, empty states, and list-to-sky selection.
- Computation batching/indexing and cache persistence if measurement justifies it.

**Exit criteria:**

- Ranking fixtures prove primary usable-duration order and deterministic ties.
- Every visible interval is shown; no single-rise/set simplification is used.
- Equipment changes alter eligibility using the documented FOV rule.
- Without equipment, all otherwise eligible targets remain available.
- Without a mask, the list uses truthful above-horizon/unassessed wording.
- List selection returns to the correctly positioned target and full trajectory.

### Stage 9 - Prototype hardening and release

**Objective:** produce a reliable, privacy-conscious Android prototype ready for
real observing sessions and UX iteration.

**Work:**

- Full migration, restart, rotation, background/foreground, low-memory, permission
  revocation, corrupt-file, low-storage, and offline testing.
- Performance profiling and remediation against section 15.
- Accessibility and representative-device visual QA for every route and state.
- Maestro critical-path flows.
- About/Licences, privacy explanation, data deletion, and troubleshooting docs.
- Fresh signed or locally distributable Android release build through the
  repository Android build-emission workflow.

**Exit criteria:**

- Root format, typecheck, lint, test, and build gates pass.
- Android release build succeeds from a clean checkout with documented
  prerequisites.
- Critical paths work offline on a physical Android device.
- No real coordinates, panoramas, local databases, or signing secrets are in the
  repository or diagnostic output.
- Release APK is staged at `tmp/artifacts/android/app-release.apk`.
- Known prototype limitations are documented in user-facing language.

**Checkpoint:** v1 working prototype for field feedback.

## 12. Test Strategy

### 12.1 Pure unit tests

- Coordinate transforms and reference fixtures.
- Twilight/observing-window and timezone logic.
- FOV and suitability formulae.
- Catalogue parsing, normalization, aliases, and prominence.
- Angular projection, azimuth unwrap, polygon/stroke containment, and boundaries.
- Trajectory sampling, adaptive refinement, interval merging, and ranking.
- Cache key and invalidation behavior.

Use property tests or broad generated cases where they materially improve
confidence in wraparound, invariants, or geometric edge cases.

### 12.2 Persistence and integration tests

- SQLite migrations from representative prior schemas.
- Catalogue import/version changes.
- Profile/equipment CRUD and referential behavior.
- Atomic panorama/mask save, interrupted writes, orphan cleanup, and restart.
- Permission/service adapters with granted, denied, revoked, inaccurate, and
  unavailable states.

### 12.3 Component and E2E tests

- Dashboard and form behavior with React Native Testing Library.
- Sky controls and target detail behavior with deterministic renderer adapters.
- Maestro: create profile, create equipment, browse/select target, capture/import
  panorama, draw/edit mask, inspect transitions, rank targets, and reopen after
  restart.

### 12.4 Physical device checks

Emulators cannot validate heading, camera placement, zenith behavior, or real
permission interactions. Stages 0, 5, 6, 7, and 9 require a physical Android
device check from the intended observing posture.

## 13. Privacy, Security, and Data Lifecycle

- Precise profile coordinates and images of home surroundings are sensitive.
- Store them only in app-private local storage for v1.
- Do not request background location; do not monitor location after profile setup.
- No analytics or crash-report upload is adopted by this spec.
- Clear temporary captures after durable commit or explicit draft deletion.
- Profile deletion removes its database records, panorama/mask files, and derived
  caches transactionally or completes cleanup on next launch.
- A global `Delete all local data` action requires confirmation and reports any
  file cleanup failure.
- Export/import is out of scope; do not expose implicit platform sharing.
- Validate all imported catalogue and user-entered values. Parameterize SQLite
  operations and never derive file paths directly from user text.

## 14. Migration and Compatibility

- Start with an explicit schema version and forward migration runner.
- Before a prototype is distributed to users, development may replace the
  initial migration while preserving reproducible setup.
- After distribution, migrations are forward-only and tested with representative
  prior data.
- Panorama and mask formats carry independent version fields and calibration
  metadata.
- A newer unsupported format fails safely without deleting the underlying files.
- Catalogue refreshes map saved selected-target references by stable canonical
  identity and alias history; missing objects degrade to an explanatory state.

## 15. Prototype Performance Budgets

Measure on a documented mid-range physical Android reference device in a release
build with a production-sized catalogue and representative panorama/mask.

- Maintain 50 frames per second at the 95th percentile during ordinary sky pan,
  pinch, and mask strokes; no single interaction stall above 100 ms.
- Show the first usable Sky View within 1.5 seconds after profile data is loaded.
- Update a selected target's trajectory within 500 ms after changing time or mask
  revision, with progress feedback if work exceeds 250 ms.
- Render only viewport candidates; do not create one mounted UI component per
  catalogue object.
- Show the first ranked target-list batch within 1 second and complete the full
  prototype catalogue within 5 seconds, while keeping navigation responsive.
- Keep all long calculations cancellable and bounded to the requested interval.
- Avoid decoding full-resolution source tiles when a viewport-appropriate cached
  size is sufficient; enforce a documented per-capture tile/byte guard after
  Stage 0 measurements.

These are acceptance budgets, not unsupported promises. Stage 0 records the
reference hardware and measured baselines. A budget change requires measured
evidence and an updated specification.

## 16. Delivery and Review Cadence

- Complete stages in order. A later stage may be prototyped behind non-product
  tooling only when needed to de-risk an earlier exit criterion.
- At each checkpoint, install the APK on a physical Android device and exercise
  the completed workflow, not just its isolated screen.
- Capture visual QA evidence for representative empty, populated, loading, error,
  denied-permission, and narrow/large viewport states.
- Keep deferred controls out of the UI. A stage may be incomplete only outside
  its declared boundary.
- After Stages 4, 7, and 9, conduct a deliberate human UX review and update this
  specification or create a focused follow-on spec before material redesign.

## 17. Resolved Prototype Decisions

- Android first; iOS later.
- Local-only, offline-first v1.
- Dark Rallypath-derived visual language with a blue-violet accent.
- Native stack navigation without bottom tabs.
- Equirectangular full-sky projection with horizontal wrap.
- Direction-aware tile mosaic instead of automatic photometric stitching.
- Vector-first mask with optional generated raster cache.
- Astronomy Engine for calculations behind an owned, fixture-tested adapter.
- Pinned OpenNGC-derived runtime data plus reviewed Caldwell mapping.
- Astronomical dusk-to-dawn as `Tonight`, with documented polar fallbacks.
- Normal atmospheric refraction used consistently.
- Adaptive visibility transitions accurate to 30 seconds and `0.05` degrees near
  mask boundaries for the prototype.
- Centre-point mask visibility for v1; field of view is visual and suitability-
  related, not an obstruction footprint.
- Target suitability requires 90-percent frame fit and at least 8 pixels across
  the minor axis when dimensions are known.
- Manual review/correction is the sensor-accuracy fallback.

## 18. Known Risks to Reassess After Stage 0

- Magnetometer disturbance near buildings and telescope hardware may require a
  better true-north alignment flow.
- Camera field-of-view metadata may be too inconsistent across Android devices;
  calibration or manual tile sizing may be necessary.
- Zenith orientation is singular for ordinary heading UI and needs special
  guidance even though the angular model supports it.
- SVG may not meet the measured target/mask density budget; any renderer change
  must preserve the pure geometry and domain APIs.
- `0.05`-degree mask resolution may be insufficient for extremely close, thin
  branches or too expensive on low-end devices.
- OpenNGC data completeness and the Caldwell cross-reference require build-time
  validation and transparent provenance.

None of these risks blocks starting Stage 0. A failed spike blocks only the
affected architecture choice and requires a focused decision before dependent
product stages continue.

## 19. Primary References

- Astronomy Engine JavaScript API and source:
  <https://github.com/cosinekitty/astronomy/tree/master/source/js>
- Astronomy Engine package: <https://www.npmjs.com/package/astronomy-engine>
- OpenNGC repository and licence: <https://github.com/mattiaverga/OpenNGC>
- Astronomical League Caldwell program:
  <https://www.astroleague.org/caldwell-observing-program-introduction/>
- Expo Camera: <https://docs.expo.dev/versions/latest/sdk/camera/>
- Expo Sensors: <https://docs.expo.dev/versions/latest/sdk/sensors/>
- Expo Location: <https://docs.expo.dev/versions/latest/sdk/location/>
- Expo FileSystem: <https://docs.expo.dev/versions/latest/sdk/filesystem/>
- Expo SQLite: <https://docs.expo.dev/versions/latest/sdk/sqlite/>
