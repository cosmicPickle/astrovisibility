# Active Tasks

## 178-degree window geometry audit

**Started:** 2026-09-21 18:19 +03:00 (Europe/Sofia)

**Authority:** User reports a 178-degree window and requires geometry to be
audited before investigating any other cause of the roughly 90-minute error.
Controlling sources: product specification, existing full-frame and window
specifications, and the subsequently authorized pupil/front correction.

- [x] Independently reconstruct measured rectangles and check editing/round trips.
- [x] Verify signed 50 mm rigid lens motion for every mount mode, including
      whether a 178-degree reference can cross the window plane.
- [x] Compare behind-plane centre/full-frame classification with physical
      ray-plane intersections across oblique/off-centre/wrapped/wide fixtures.
- [x] Compare right-edge trajectory and catalogue transitions with independent
      dense sampling; check mask composition and cache identities.
- [x] Record demonstrated defects, proof limits, fixture coverage and results;
      do not claim the actual saved profile is reproduced from its width alone.
- [x] Run relevant quality gates: format, typecheck, lint, 57 focused tests, build.
- [ ] Replay the exact saved geometry/settings and observing interval around
      01:35, 02:44 and 02:48; establish effective lens/plane side and edge margins.

**Current:** Geometry only. No capture, sensor, timezone or other-origin
investigation until this audit is complete. Preserve unrelated attachments.

**Evidence:** `docs/superpowers/reports/mobile/2026-09-21-1829-window-178-geometry-audit.md`.
111,720 independent centre/frame comparisons found no behind-plane mismatch;
36 synthetic right-edge tracks agree within 6.437 seconds. The 178-degree span
alone cannot reproduce the user's saved geometry or exclude plane crossing with
a moving lens. No physical phone or exact saved profile is available here;
the user's roughly 90-minute discrepancy remains unexplained. Do not certify
geometry 100 percent or move to other causes on the strength of synthetic tests.

**Update, 2026-09-21 21:45 +03:00:** Both demonstrated gaps are now fixed using
the existing aperture diameter and physical front-wall intersections. The new
270-test validation and release APK are documented in
`docs/superpowers/reports/mobile/2026-09-21-2145-window-pupil-and-front-clearance.md`.
Synthetic M27 aperture cases advance shading by 5–29 minutes; the actual night
still needs replay. The earlier audit establishes point-lens behavior only.

**User retest, 2026-09-21 22:13 +03:00:** Updated APK reports 02:34, leaving
59 minutes against the reported first shading at 01:35. Do not mark the observed
problem solved. Current tracking mode and offset confirmation is requested.
Exact saved window corners, optics and mask are not available locally; the
displayed cutoff alone does not identify whether the physical window or the
remaining mask sets the transition. Establish that before choosing another fix.

- [ ] Account for the observed four-minute change at 50 mm when checking whether
      this omission explains the user's night; do not equate a counterexample
      with a confirmed diagnosis of that discrepancy.

## Window displacement correction — physical performance verification

**Started:** 2026-09-21 13:56 +03:00 (Europe/Sofia)

**Updated:** 2026-09-21 16:51 +03:00 (Europe/Sofia)

**Controlling specifications:** `astro-visibility-spec.md`,
`docs/superpowers/specs/mobile/2026-09-21-0955-window-displacement-correction.md`,
`docs/superpowers/specs/mobile/2026-09-21-1620-window-sill-geometry-fix.md`,
and the companion full-frame visibility specification.

**Objective:** Measure physical Android performance for the implemented optional
lens offset and window correction. Setup follows mask completion; the profile
menu has one Define/Redefine window action. Original panorama/mask data is preserved.

- [x] Inspect workflows and record creation order and the single later action.
- [x] Implement and test signed optional lens offset and migration 11.
- [x] Implement/test physical rectangle geometry and atomic window lifecycle.
- [x] Integrate shared trajectory/list/count classification and cache identity.
- [x] Implement creation and later editor entry points with save/cancel/reset/remove.
- [x] Verify both window crossings against an independent one-second oracle.
- [x] Tune conservative lens-travel bounds: desktop full-catalogue timings about
      2.0 s absent, 2.3 s zero offset, 2.9 s displaced (12-hour synthetic workload).
- [x] Correct sill geometry, right-corner horizon drag and exact-plane rendering.
      Wide-window benchmarks: 3.5 s flush and 4.0 s exterior on desktop.
- [x] Final format, typecheck, lint, 563 tests, and Android export pass.
- [x] Android two-viewport QA: all handles, pan/pinch, keyboard/large text,
      post-mask offer/skip, later setup, save/reopen/reset/cancel/remove/restart.
- [x] Verify 175-to-190-degree editing, exact 180-degree contact, 193-degree save,
      pan/pinch and restart on the final release APK, including constrained large text.
- [x] Build and stage the final release APK at `tmp/artifacts/android/app-release.apk`.
- [ ] Measure physical cold/warm calculations, memory and cancellation latency;
      verify 50 fps p95 and no interaction stall over 100 ms.

**Blocker:** No physical Android device is connected. Desktop timings and emulator
QA do not establish physical-device performance. Connect a representative phone,
install the staged APK and compare absent-window, zero-offset, displaced, flush
and exterior cases.

**Evidence:** `docs/superpowers/reports/mobile/2026-09-21-1530-window-displacement-correction.md`.
Sill correction: `docs/superpowers/reports/mobile/2026-09-21-1651-window-sill-geometry-fix.md`.
Geometry, capture reference and the explicit clear-background approximation are
recorded in the spec. Schema 11 is forward-only. New code is under `src/window`,
`storage/windowRepository.ts`, and the window route. Preserve unrelated task entries
and untracked `.codex-remote-attachments/`.

## Full-frame obstruction visibility — physical performance verification

**Started:** 2026-09-21 11:13 +03:00 (Europe/Sofia)

**Updated:** 2026-09-21 12:09 +03:00 (Europe/Sofia)

**Controlling specifications:** `astro-visibility-spec.md` and
`docs/superpowers/specs/mobile/2026-09-21-0955-full-frame-obstruction-visibility.md`.

**Objective:** Verify task one's full-frame calculations and interactions on a
representative physical Android phone. Implementation, migration, regression
checks and emulator visual QA are finished; window displacement is a separate task.

- [x] Whole-frame raster intersection and shared trajectory/list/renderer geometry.
- [x] Persist per-optics AltAz/EQ/active-rotator framing; migrate and recover failed writes.
- [x] Final format, typecheck, lint, 517 tests and Android export pass.
- [x] Complete desktop 12-/25-hour catalogue benchmarks and two-viewport Android QA.
- [x] Build and stage the current release APK at `tmp/artifacts/android/app-release.apk`.
- [ ] Measure physical cold/warm calculations, peak memory and cancellation latency;
      verify 50 fps p95 and no interaction stall over 100 ms.

**Blocker:** No physical Android device is connected. Desktop regression budgets
and emulator review are not evidence of physical-device performance. Connect a
representative phone, install the staged release APK, and run the specification's
performance scenarios before removing this entry.

**Evidence:** `docs/superpowers/reports/mobile/2026-09-21-1209-full-frame-obstruction-visibility.md`.
The specification records framing defaults and numerical/resource limits. Preserve
untracked `.codex-remote-attachments/` and the unrelated sky-background task.

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
