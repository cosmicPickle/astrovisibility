# Stellarium-style Sky Engine Rewrite Verification

**Timestamp:** 2026-08-20 10:15 +03:00  
**Branch:** `codex/stellarium-sky-engine`

## Outcome

The Sky View camera, gestures, reference-frame guides, selected-target path, and
panorama projection now use one level horizontal stereographic planetarium
model. The interaction pipeline no longer treats the sky as a translated image,
does not preserve a free camera roll, and does not recalculate the camera on
gesture release.

The implementation follows the behavior documented from official Stellarium
source on 2026-08-20:

- stereographic projection, paired inverse, FOV scaling, and 235-degree limit;
- default horizontal/Alt-Az mount;
- incremental previous-pointer to current-pointer dragging in the current mount
  frame;
- FOV-only pinch using starting FOV divided by scale;
- separate horizontal and equatorial reference frames.

The focused specification records the retrieved source locations and detailed
behavior:
`docs/superpowers/specs/mobile/2026-08-20-0942-stellarium-sky-engine-rewrite.md`.

## Implementation

- Replaced free-axis rotation with authoritative centre azimuth, centre
  altitude, and FOV. Every update rebuilds a level north/east/up camera basis.
- Made pan incremental against the currently displayed camera. Release commits
  the exact displayed camera once and performs no second projection.
- Made pinch change only FOV. Moving or noisy Android pinch centroids cannot
  translate the camera centre.
- Kept the catalogue candidate/label set stable during direct manipulation;
  Skia projects all held marks from the live UI-thread camera and refreshes the
  bounded atlas only after commit.
- Added the observed celestial equator as an astronomy-calculated spherical
  guide, separate from the local horizontal grid.
- Replaced five-minute great-circle chord densification of target tracks with
  actual one-minute time evaluations. The neutral base path renders before
  asynchronous mask classification, while classified results are merged onto
  the stable time-evaluated geometry.
- Replaced panorama azimuth/altitude offset-and-clamp geometry with a bounded
  rectilinear tangent-plane mesh projected onto the horizontal unit sphere.
  This preserves seam and zenith behavior without changing persisted data.
- Kept mask operations and classification in persisted horizontal directions;
  display uses the same authoritative projector as targets, guides, paths, and
  panorama.

## Automated verification

Final gate results are recorded after the final intended source state:

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 48 suites and 221 tests passed
- `pnpm build`: catalogue byte check and Android production export passed
- native `:app:assembleRelease`: 621 tasks passed; the required emission script
  then completed a fresh 669-task release assembly

The tests cover paired projection/inverse behavior, 235-degree FOV, exact
FOV-only pinch, incremental level pan, closed drag stability, north/zenith
continuity, stereographic small-circle preservation, exact-time track samples,
immediate base-path behavior, celestial-equator transforms, and rectilinear
panorama seam/zenith geometry. Existing panorama/mask persistence, independent
opacity, classification invariance, and restart tests remain in the full suite.

## Exact-release emulator review

The release APK was installed on a Pixel 8 API 36 emulator and exercised at
1080x2400/420 dpi and 720x1600/320 dpi. The final emitted artifact was installed
again successfully after the final source cleanup and produced no fatal launch
logs.

- A held one-finger pan frame and the frame immediately after release were
  byte-identical at both viewports. The sphere, horizontal grid, celestial
  equator, and DSO atlas remained registered; there was no release snap.
- Native two-pointer input zoomed the stereographic sphere while retaining its
  centre and level mount. Automated tests cover centroid noise and exact release
  identity.
- A six-hour Andromeda trajectory appeared on selection before obstruction
  classification and rendered as a continuous projected small-circle arc with
  exact half-hour markers. A horizon-limited three-minute target also retained
  its short physical path rather than being cosmetically extended.
- The wide view showed a recognisable all-sky stereographic dome. The horizontal
  grid moved with the sky; the calculated celestial equator was visibly distinct
  and tilted according to location/time/camera rather than fixed to the screen.
- The constrained phone layout recovered cleanly after activity recreation and
  passed held/released pan identity.
- A 237-frame dense selected-path pan diagnostic reported p50 5 ms, p95 16 ms,
  p99 17 ms, and no frame over 100 ms. This is emulator diagnostic evidence,
  not the required physical mid-range-device claim.
- A clean relaunch and interaction produced no AndroidRuntime, ReactNativeJS, or
  native fatal log entries.

The emitted artifact is
`tmp/artifacts/android/app-release.apk`, 184,908,578 bytes, SHA-256
`C1A181B52DD0E352C8E703FBFE864A5336E400B4E12209A32CFAB86D385D1EAD`. An
identical copy is staged at
`C:\Web\rallypath\tmp\artifacts\android\astrovisibility.apk`.

## Panorama and mask compatibility

No migration or semantic change was made. Persisted panorama tiles and mask
operations remain horizontal azimuth/altitude data. Panorama display now uses a
sphere-correct rectilinear mesh; mask geometry continues through the shared
projector. Focused seam/zenith tests and the complete overlay, opacity,
classification, storage, and restart suite pass. The QA profile on the emulator
had no saved private panorama or mask, so no user data was fabricated or
replaced solely for a screenshot.

## Remaining limitation

No physical Android device was attached. Real touch/sensor behavior and the
specified mid-range physical-device 50 fps p95 budget therefore remain
unverified. The exact release emulator evidence above is not represented as a
physical-device pass.
