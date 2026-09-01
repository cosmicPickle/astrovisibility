# Active Tasks

## Shared celestial time transform

**Started:** 2026-09-01 14:45 +03:00 (Europe/Sofia)

**Branch**

- `feature/atlas-shared-time-transform`, created from `main` at `84171fd`.
- Remain on this branch for implementation, commits, and Android test builds
  until the product owner explicitly accepts, rejects, merges, or switches it.

**Controlling specifications**

- `astro-visibility-spec.md`
- `docs/superpowers/specs/mobile/2026-09-01-1445-shared-celestial-time-transform.md`
- `docs/superpowers/plans/2026-09-01-1445-shared-celestial-time-transform.md`
- `docs/superpowers/specs/mobile/2026-08-20-0942-stellarium-sky-engine-rewrite.md`

**Objective and acceptance**

Keep all celestial geometry fixed in J2000 and rotate/project it from one
shared scene timestamp on the Skia/UI path. Enable real-time observing-time
movement with stars, targets, constellations, Milky Way, DSO imagery, and a
selected trajectory, without rebuilding complete celestial arrays through
React or changing astronomical, catalogue, obstruction, or visual behavior.
Meet the numerical and device-performance budgets in the focused spec.

**Checklist**

- [x] Create the dedicated branch from current local/main and record branch
      ownership.
- [x] Write the staged focused specification and implementation plan.
- [x] Add failing authoritative equivalence tests for the window-scoped shared
      celestial transform.
- [x] Implement the worklet-safe forward/inverse time-transform foundation.
- [x] Benchmark the shared transform over the production celestial-data counts.
- [x] Prepare immutable J2000 catalogue, star, constellation, Milky Way, and
      cached DSO mesh geometry.
- [x] Introduce shared render time and migrate celestial background layers.
- [x] Replace the star frame hot path as required by measurements.
- [x] Move catalogue marks/residency/hit testing to stable J2000 behavior.
- [x] Connect live slider preview with exact release/window semantics.
- [x] Run mandatory quality gates and inspect the final diff/security surface.
- [x] Build the branch-only release APK at
      `tmp/artifacts/android/app-release.apk`.
- [x] Complete representative and constrained Android emulator visual QA.
- [x] Fix the reported celestial-image projection-boundary background flashing.
- [x] Fix live time-slider gesture rollback and reduce preview-path React work.
- [x] Complete the specified batched catalogue-mark renderer and remeasure it.
- [x] Repeat focused automated checks and representative Android emulator visual
      QA.
- [ ] Complete physical-device performance QA.
- [ ] Present measured results for explicit product-owner readiness decision.

**Current step**

The three reported release blockers are corrected. Celestial imagery now culls
projection-antipode triangles and omits off-screen mesh allocations, so the
background did not flash in eight captured frames across a three-second time
drag. The time-slider responder and gesture start remain stable across parent
renders; its thumb and shared scene timestamp update on every move while React
text/catalogue work is sampled and settled after motion, preventing stale
previews from rolling the drag backward. Catalogue outlines are batched into
four Skia paths, stars share one projection pass, and wide-view sky LOD limits
the default view to useful star bands plus 648 Milky Way vertices while retaining
the full atlas below 75 degrees. On the software-rendered Pixel 8 API 36 emulator,
the same three-second full-day drag improved from 130 frames / 38 ms median /
61 ms p95 to 183 frames / 29 ms median / 42 ms p95. GPU median remained 3 ms.
Format, typecheck, lint, all 82 suites and 422 tests, catalogue/asset validation,
Expo Android export, and a fresh 193,121,165-byte release APK pass. The branch is
ready for the required physical-device measurement and product-owner review.

**Blockers and decisions**

- The owner approved the shared J2000/time-transform architecture and staged
  implementation on 2026-09-01.
- No density, imagery, trajectory, panorama/mask, or catalogue functionality may
  be removed for performance. Report any proposed compromise before acting.
- Physical-device proof requires a connected representative Android device;
  emulator measurements remain diagnostic only. The existing
  `RallyPath_Pixel_8_API_36` AVD was found by setting `ANDROID_AVD_HOME` to its
  established location and has completed the available visual QA. No physical
  Android device is attached, so the S24 Ultra 60 Hz target and representative
  mid-range 50 fps p95/no-stall budget remain unverified.
- The representative 1080x2400 post-fix emulator pass completed. A subsequent
  forced 720x1280 rerun was blocked when the AVD system server stopped answering
  `adb shell` and screenshot commands, including after a cold restart. The
  emulator process was stopped; earlier constrained layout QA remains recorded,
  but this exact post-fix build has not produced a new constrained screenshot.

## Registered sky background

**Started:** 2026-08-29 18:51 +03:00 (Europe/Sofia)

**Controlling specifications**

- `astro-visibility-spec.md`
- `docs/superpowers/specs/mobile/2026-08-29-1851-registered-sky-background.md`
- `docs/superpowers/specs/mobile/2026-08-20-0942-stellarium-sky-engine-rewrite.md`
- `docs/superpowers/decisions/mobile/2026-08-19-2221-planetarium-renderer.md`

**Objective and acceptance**

Implement the approved offline registered-sky stack: a smooth registered Milky
Way atlas, real stars, Western constellation figures, and real offline survey
imagery for at least all 110 Messier objects plus a documented curated set of
the most notable non-Messier objects, especially famous named nebulae, galaxies,
and clusters, behind the existing panorama/mask. Preserve complete vector
target and trajectory behavior above it. Required objects use the approved
open, free-for-commercial-use, established, safe, and attributed all-sky DSS2
optical source rather than silently falling back to vector-only rendering.

**Checklist**

- [x] Record the approved focused specification and exact layer order.
- [x] Validate and pin data-source revisions, licences, request parameters, and
      checksums; reject any source that fails the approval boundary.
- [x] Add failing pure tests for deterministic data transforms and celestial
      image/star/constellation geometry.
- [x] Implement and verify the offline asset generation/check pipeline.
- [x] Integrate the Milky Way atlas, stars, constellations, and selected DSO
      imagery into Skia in the approved render order.
- [x] Extend About and licences plus the technology/data registry.
- [x] Run the mandatory automated quality gates in final-state order. Format,
      typecheck, lint, all 368 tests, asset validation, and build pass.
- [x] Perform representative and constrained Android visual QA.
- [x] Build and inspect the 193,070,045-byte release APK and record emulator
      diagnostics.
- [x] Review security, privacy, attribution, and the final diff.
- [x] Correct the 12-hour d3-celestial constellation registration error, verify
      Cygnus against Deneb, and bundle a selected NGC 7000 survey cutout.
- [x] Expand real offline DSO imagery from the 14-object proof set to at least
      all 110 Messier objects and a curated set of the most notable named
      non-Messier DSOs, including famous nebulae, galaxies, and clusters.
      Document the prominence criteria and exact membership, common-name and
      catalogue identity mapping, source coverage, licences, download
      validation, and total asset/APK cost.
- [x] Repeat automated checks and Android visual QA for the registration fix.
- [ ] Validate the 50 fps p95 performance target on a representative physical
      Android device, then remove this task entry.

**Current step**

The focused specification, deterministic selection tests, generated runtime
asset map, and manifests cover 289 physical targets: all 110 Messier
designations across 109 physical records, all 109 Caldwell targets, and 71
additional notable named DSOs. Asset validation passes for 289 DSS2 optical
cutouts totalling 4,109,915 bytes. The pinned Stellarium/Mellinger Milky Way
atlas replaces the spotted Gaia flux texture, and stars use stronger
zoom-density bands with UI-thread fades plus small near-white cores and batched
filter-free haloes. All atlas tiles share one draw payload, DSO image decoding
is gated by useful on-screen size, static directions use prepared unit vectors,
and gesture-time JS cache previews are sampled against existing full-screen
overscan while the native shared camera still updates every event. Final
automated gates pass all 368 tests. The refreshed release APK is 193,070,045
bytes, and representative plus constrained Android inspection confirms the
smooth registered Milky Way, corrected Cygnus figure, neutral optical DSO
imagery, and refined star treatment. A software-rendered constrained-emulator
interaction sample recorded 80 frames, 9 ms p95, and one janky frame; the
remaining step is the physical-device frame-rate measurement.

**Blockers and decisions**

- Physical-device performance evidence depends on a suitable connected device;
  only the headless emulator was available. Its software-rendered frame timing is
  diagnostic and does not substitute for the required physical-device result.
- The previous Pan-STARRS and AllWISE composites contained visible colour-channel
  and coverage artifacts. The official full-sky optical CDS DSS2 colour HiPS is
  the approved ODbL-1.0 deterministic source for every bundled cutout.
- No sky density, DSO coverage, panorama/mask behavior, catalogue feature, or
  interaction was removed for performance. Any future compromise still requires
  human approval.
