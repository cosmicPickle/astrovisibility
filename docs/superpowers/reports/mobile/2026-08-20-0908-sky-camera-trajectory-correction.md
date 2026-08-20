# Sky Camera and Trajectory Correction Verification

**Timestamp:** 2026-08-20 09:08:33 +03:00

**Branch:** `codex/fix-planetarium-camera-paths`

**Result:** Complete

## Outcome

Sky View now uses a stereographic unit-sphere camera with a 235-degree maximum
field of view, matching Stellarium's default projection and documented limit.
Panning rotates the camera on the sphere, and pinch zoom retains the direction
under the fixed initial two-finger centroid. Grid, targets, angular outlines,
trajectory, panorama, mask, field of view, and hit testing remain registered to
the same camera.

Catalogue candidates are refreshed throughout held gestures. Only onscreen and
25%-overscan targets can consume the bounded 120-target render budget, so a
dense offscreen region cannot evict the atlas under the finger. Android's
simultaneous pan recognizer is suppressed when it starts after an active pinch;
its late update/finalize events therefore cannot overwrite the pinch camera.
Every pinch update publishes the latest catalogue camera, and release commits
that already-visible state instead of producing a final DSO or label batch.

Selected trajectories are now densified to at most 0.25 degrees between
spherical vertices while preserving time order and shared visibility-transition
endpoints. A target's diurnal track is a celestial small circle. Under the
stereographic projection it appears as a circle or straight-line limit; the
observing-window segment is not forced into an artificial full circle.

## Root Causes

- The prior renderer used an azimuthal-equidistant formula beyond the projection
  mode's documented range and called the result a 360-degree fisheye.
- Pinch zoom followed Android's changing focal centroid instead of preserving
  its initial sky anchor.
- On Android, the simultaneous pan recognizer could begin after pinch start and
  emit a final update after the pinch finalized.
- The Skia camera updated on the UI thread while React-side catalogue membership
  and collision decisions lagged behind, producing held/released DSO changes.
- Prominent offscreen objects could consume the entire render cap.
- Trajectory samples were joined directly despite the historical report claiming
  spherical densification.

## Automated Verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 46 suites and 215 tests passed.
- `pnpm build`: passed, including catalogue integrity and Android Expo export.
- Native `:app:assembleRelease`: passed, 621 tasks.
- Projection tests cover stereographic forward/inverse round trips, the
  235-degree bound, robust spherical separation, fixed-point pan and pinch,
  local conformal target scale, and a synthetic celestial small circle whose
  projected points fit one screen circle within numerical tolerance.
- Gesture tests reproduce Android's pinch-before-pan recognizer ordering and
  late pan update/finalize sequence.
- Catalogue tests cover north wrap, widest-view hemisphere coverage, overscan,
  bounded rendering, and offscreen render-cap displacement.
- Trajectory tests cover spherical densification, transition endpoint identity,
  north wrap, and projected continuity.

## Exact Release Visual and Interaction QA

The exact release APK was installed on an API 36 Pixel 8 emulator and inspected
at 1080 x 2400 / 420 dpi and 720 x 1600 / 320 dpi.

- A real rooted Type-B two-pointer stream exercised native pinch recognition.
  Captures after the zoom settled while both fingers remained down and after
  release retained the same grid, DSO positions, outlines, target membership,
  and labels at both viewports. Only the status-bar clock changed.
- One-finger drag rotated the grid and all atlas geometry together and revealed
  the newly relevant buffered catalogue without a release camera reset.
- The 235-degree wide view remained a coherent spherical dome rather than a
  translated plane.
- Selecting Andromeda from the complete 13,371-target calculation restored the
  observing window and rendered its 6h 48m path as one smooth, time-ordered
  circle-like arc with half-hour markers and no seam fold or S-curve.
- Controls and selected-target details remained usable without clipping on the
  constrained viewport.
- Logcat contained no fatal exception, ANR, React Native, Skia, or worklet error.

The emulator verifies interaction correctness, not a physical-device frame-rate
claim. Final tactile assessment and mid-range-device frame pacing remain a real
hardware check.

## Artifact

- Package: `com.cosmicpickle.astrovisibility`
- Version: `0.0.1` (`versionCode` 1)
- Native path:
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: 184,909,146 bytes
- SHA-256: `A10E7D59A1BCEF8563AF59B32B50F86382D99AF3127B185F488AB3050B4D3A86`

The user did not request artifact emission or sharing for this correction, so no
copy was staged in Rallypath.

## Security and Technology Review

No dependency, permission, persistence, import, network, account, analytics, or
sensitive-data path changed. The work is pure rendering, bounded catalogue
selection, and gesture arbitration. The previous historical verification report
and renderer decision now carry explicit correction notes rather than retaining
false 360-degree and densification claims.

## Sources

- Stellarium 26.2 source uses `ProjectionStereographic` as the default.
- Stellarium 26.2 User Guide section 4.4.1.1 documents stereographic projection
  at a 235-degree maximum and fish-eye as azimuthal equidistant at a 180-degree
  maximum.
