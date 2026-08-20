# Sky pan synchronization verification

Timestamp: 2026-08-20 17:27 +03:00 (Europe/Sofia)

## Outcome

The remaining horizontal-pan release discontinuity was reproduced and removed
without changing the accepted stereographic projection, pan geometry, zoom,
ground, FOV, trajectories, panorama, or mask coordinates.

The UI-thread camera is now authoritative for the lifetime of the Sky View. A
gesture commit checkpoints only the bounded catalogue population; it no longer
round-trips the camera through React and writes the same camera back to the
shared renderer on release. The catalogue receives live gesture checkpoints,
while an overscanned camera-anchor hysteresis prevents an otherwise identical
release checkpoint from remounting targets or recomputing label collisions.
Target and trajectory hit testing uses a stable gesture callback that reads the
latest rendered data.

## Regression coverage

- A held pan updates the bounded catalogue without changing the initial React
  camera supplied to the shared renderer.
- The exact release checkpoint does not render a second catalogue population.
- Tap handling keeps one callback identity while reading newly mounted targets.
- Pan output remains baseline-derived and independent of event frequency.
- The exact final camera is previewed and committed; pinch keeps its accepted
  fixed-centre zoom behavior.
- Catalogue anchors do not refresh for small release deltas, but do refresh
  before pan or zoom movement consumes the 25% overscan buffer.

## Automated verification

Final repository gates passed in order:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: 53 suites, 260 tests
- `pnpm build`: current catalogue validation and Android Expo production export
- Android `assembleRelease`: 669 tasks, successful
- Exact implementation commit `b43c4bfc0cfa71ee74a527f803109fda7c584d3f`:
  [GitHub Actions CI passed](https://github.com/cosmicPickle/astrovisibility/actions/runs/32380488035)

No dependency, permission, persistence, network, native configuration, or user
data format changed. Catalogue refresh work is bounded: pointer events perform a
constant-time spherical separation/zoom threshold check, while the existing
13,371-target bounded query runs only when the live camera consumes 15% of the
current FOV or changes zoom by 15%.

## Release visual and interaction QA

The exact staged release APK was installed on the API 36 Pixel 8 emulator with
the existing 13,371-target catalogue and a saved profile/setup. Repeated checks
covered forward and reverse horizontal drags, hold-before-release, immediate
reverse pans, dense DSO regions, the horizontal grid and ground, selected-target
trajectory rendering, and the normal and constrained phone viewports.

- At 1080x2400 / 420 dpi, a held 400 px horizontal pan, its immediate release,
  and the frame two seconds after release were pixel-identical.
- The reverse held and immediate-release frames were pixel-identical. The later
  frame differed only because the displayed clock crossed a minute; sky
  geometry, targets, and labels remained identical on visual inspection.
- At 720x1600 / 320 dpi, held, immediate-release, and two-seconds-after-release
  frames were pixel-identical.
- With M 40 selected and its complete 24-hour trajectory rendered, held,
  immediate-release, and two-seconds-after-release frames were pixel-identical.
- Repeated alternating horizontal swipes completed without a crash, ANR, React
  Native error, camera/FOV reset, ground/grid jump, or DSO population pop.
- The emulator was restored to 1080x2400 / 420 dpi after the constrained pass.

This automated release QA cannot reproduce the exact capacitance and event
timing of a physical finger/device; owner review on the shared APK remains the
final subjective smoothness check.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,933,302 bytes
- SHA-256: `3E5516CBC90160F1526DBE626FC9C92DFCDB278A96497CD64D453F32BD0DE03B`
