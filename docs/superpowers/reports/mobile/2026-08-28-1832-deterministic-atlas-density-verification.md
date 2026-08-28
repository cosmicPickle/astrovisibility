# Deterministic Atlas Density Verification

Timestamp: 2026-08-28 18:32 +03:00 (Europe/Sofia)

## Outcome

The Sky View now has a dynamic minimum-target control from 10 to 200 targets,
defaulting to 100 and committing only when the gesture ends. The atlas keeps a
deterministic, camera-independent density floor by relaxing the normal
zoom/size threshold in stable prominence, angular-size, and canonical catalogue
order. When fewer eligible targets exist, it shows all of them.

Changing the active optics setup already used a reactive catalogue selection
path. A regression test now protects that behavior, and Android verification
confirmed that switching optics immediately refreshes the target population and
field-of-view frame.

All custom slider thumbs are vertically centred on their tracks. During Android
verification, a nested slider child was found to steal native gesture-relative
coordinates. The visual track children now ignore pointer events so the parent
slider consistently owns the gesture; a rightward density drag now reaches 200
instead of jumping to 10.

## Automated Verification

- Test-first red phase: the new density, deterministic membership, delayed
  commit, natural catalogue ordering, optics refresh, and slider geometry tests
  failed for the expected missing behavior. The native gesture ownership
  regressions also failed before the pointer-event correction.
- Focused slider regression suite: 4 suites and 12 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 66 suites and 338 tests passed.
- `pnpm build`: passed; catalogue artefacts were current and the Android Expo
  export completed.
- `pnpm format`: the task-owned files pass Prettier. The repository-wide check
  remains blocked by 16 pre-existing formatting findings in `AGENTS.md`, older
  panorama/capture source and tests, `app.config.ts`, and two older verification
  reports. No task-owned file was reported.
- `git diff --check`: passed.

## Visual QA

Visual QA passed on the Android API 36 `RallyPath_Pixel_8_API_36` emulator at
1080 x 2400 and the constrained 720 x 1280 viewport using synthetic `QA_Profile`,
`QA_Setup`, and `QA_Wide` data.

Checked:

- View Options opens with the density value at 100 on a fresh Sky View.
- The density thumb is centred on the track and remains usable at both
  viewports.
- A full rightward drag commits 200 only when released and visibly adds the
  deterministic backfill targets.
- The optics and orientation surfaces render without clipping; the orientation
  thumb is centred.
- Switching from the 400 mm setup to the 50 mm setup immediately changed the
  suitable-target count from 699 to 54, redrew the target set, and resized the
  field-of-view frame.
- The 720 x 1280 View Options sheet kept the density slider, search, and category
  controls visible and operable.

Opacity and brush-size slider ownership and centring use the same correction and
are covered by focused component regressions; the synthetic profile had no
panorama/mask, so those context-dependent sheets were not opened in this pass.

## Release Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,708,867 bytes
- SHA-256: `81B11645C2E2FFBD30DD2DF39BD5EB1083B826DA7E1F9EC039061959979D9031`
- Build result: Gradle `assembleRelease` succeeded.

## Performance, Privacy, and Security Review

- The density floor is bounded to 200, below the existing resident-render cap of
  320, and is selected without camera-direction-dependent membership.
- Off-screen residency remains separate from deterministic target existence, so
  panning does not rebuild a different floor.
- Optics changes reuse the existing memoized/reactive selection path; no polling
  or duplicate catalogue load was introduced.
- The setting is in-memory Sky View state and introduces no migration, storage,
  permission, network, or sensitive logging change.
- No dependency or native permission was added.
