# Shared Celestial Time Transform Verification

**Timestamp:** 2026-09-01 17:48 +03:00 (Europe/Sofia)  
**Branch:** `feature/atlas-shared-time-transform`  
**Status:** Automated and release-build verification passed. Representative
Android emulator visual verification passed; the post-fix constrained rerun and
physical-device frame-budget verification remain open.

**Emulator follow-up:** 2026-09-01 18:32 +03:00 (Europe/Sofia)

**Regression follow-up:** 2026-09-01 21:17 +03:00 (Europe/Sofia)

## Implemented result

- Celestial geometry is prepared once as fixed J2000 vectors for 15,598 stars,
  88 constellations, the Milky Way atlas, 289 DSO cutouts, and filtered
  catalogue targets.
- One shared UTC-millisecond value drives Skia projection during time dragging.
- Stable J2000 catalogue and star residency queries replace full horizontal
  catalogue/sky reconstruction during preview updates.
- Catalogue marks, angular outlines, constellation figures and labels, stars,
  Milky Way, and DSO meshes use the shared celestial projector.
- Star cores and haloes use bounded Skia point batches instead of rebuilding
  two or three circle paths per star per frame.
- The time slider publishes every drag preview to the shared renderer, samples
  JavaScript culling/control state, and commits the exact release timestamp once.
  A selected trajectory remains mounted during same-window movement.
- The active slider gesture now freezes its start minute and retains one
  responder across parent renders. The thumb is renderer-driven, so sampled
  React labels cannot replace or reverse the drag.
- Celestial image projection conservatively culls full meshes and rejects
  unsafe projection-antipode triangles before Skia receives them. Culled meshes
  allocate no placeholder vertices or texture coordinates.
- Catalogue marks are four batched Skia paths rather than hundreds of animated
  oval components. Star styles share one projection pass.
- Wide views use a 648-vertex Milky Way mesh and only resident star bands that
  can contribute visible opacity. Full mesh density and progressively fainter
  stars return during zoom without a visible entry pop.

## Automated verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed without warnings.
- `pnpm test`: 82 suites and 422 tests passed.
- Production fixed-residency performance guard passed against the generated
  catalogue and registered star counts.
- Transform accuracy remains within 0.0001 degree and 0.5 screen pixel in the
  focused regression fixtures, including an extended DST window.
- `pnpm build`: catalogue checksum, registered sky assets, and Android Expo
  export passed.
- Fresh release APK: `tmp/artifacts/android/app-release.apk`, 193,121,165 bytes.
- SHA-256:
  `5E4959964664A9BCF26D4F6354C9C0B8ADC6B9688FC55E2C7AC42CD90F56BE9D`.

No dependency, permission, persistence, network behavior, catalogue membership,
DSO coverage, mask behavior, trajectory calculation, or sensitive logging was
added or changed.

## Exact-release emulator review

The existing `RallyPath_Pixel_8_API_36` AVD was discovered at its established
AVD home after the initial default-context lookup failed. The exact feature-
branch release APK installed and launched on API 36 with software rendering.
Inspection used a synthetic profile and covered both 1080x2400 at 420 dpi and
720x1280 at 320 dpi.

- Fresh install, profile creation, atlas launch, static pan, and native pinch
  zoom completed without an AndroidRuntime, ReactNativeJS, or native fatal log.
- Stars, constellation geometry, grid, Milky Way, target marks, labels, horizon,
  and cardinal direction remained mutually registered during pan and zoom.
- Close zoom crossed the DSO image threshold and displayed the registered
  Andromeda Galaxy optical cutout beneath its vector outline and label.
- Slider movement updated the celestial field while held. With IC 1831
  selected, the whole trajectory remained mounted and its current marker moved
  along the unchanged arc as the displayed time advanced.
- The observing-window date, condition, navigation controls, gradient slider,
  darkness times, and expanded lunar-condition panel remained readable and
  operable at both viewports. The constrained expanded panel scrolled to expose
  the complete slider and darkness controls.

Android `gfxinfo` is not used as an atlas-FPS acceptance claim here: the atlas
is a Skia `TextureView`, while the sampled ViewRoot frames primarily reflect
coalesced React text/control updates. The software-rendered emulator samples
were therefore retained as diagnostics only rather than being presented as the
required Skia or physical-device frame percentiles.

## Regression and performance follow-up

The exact release build was exercised with a continuous three-second drag over
the full noon-to-noon slider. Eight screenshots captured during the drag showed
monotonic time/thumb movement and no light-coloured background flash. The
release remained at the final drag value.

Controlled layer measurements on the same software-rendered emulator identified
Milky Way projection and stars as the dominant UI-worklet costs. After batching,
off-screen mesh omission, wide-view LOD, and stronger progressive star residency,
the comparable drag changed as follows:

- before the final LOD: 130 rendered frames, 38 ms median, 61 ms p95;
- after the final LOD: 183 rendered frames, 29 ms median, 42 ms p95;
- GPU median remained 3 ms and GPU p95 improved from 12 ms to 7 ms.

This is approximately 41 percent more delivered frames and 31 percent lower p95
frame time on the diagnostic emulator. It is not substituted for the S24 Ultra
acceptance measurement.

## Remaining blocker

No physical Android device is attached. The specification's Galaxy S24 Ultra
60 Hz target and representative mid-range 50 fps p95/no-stall requirement still
need an exact-release physical-device run. Emulator visual verification is
not represented as physical performance evidence. The representative 1080x2400
post-fix pass completed, but a forced 720x1280 rerun was blocked when the AVD
system server stopped responding to `adb shell` and screenshot requests even
after a cold restart. The emulator process was cleaned up.
