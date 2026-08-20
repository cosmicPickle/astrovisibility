# Sky FOV and time-control polish verification

**Completed:** 2026-08-20 15:09 +03:00 (Europe/Sofia)

## Outcome

- The initial all-sky overview is centred on the upper celestial equator for the
  profile latitude. The celestial equator is horizontal while the physically
  local horizon, ground plane, and cardinal directions retain their correct
  tilt. This preserves panorama and obstruction-mask alignment.
- A selected imaging setup is rendered as a literal rectangular reticle at the
  centre of the visible sky viewport. It is independent of target selection and
  remains above the ground layer. Its pixel dimensions are derived from the
  setup's angular field of view and the current stereographic camera scale, so
  the rectangle grows when zooming in and shrinks when zooming out.
- The time slider tracks locally and continuously while held. The selected atlas
  time is committed once on release, avoiding redraw contention and the former
  reverse-drag midnight flash. Accessibility increments still commit directly.
- The slider thumb is vertically centred. Redundant instructional copy and the
  internal fixed-window summary panel were removed; date, time, `Now`, and
  `Tonight` remain.

## Automated verification

- `pnpm format` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 53 suites, 248 tests.
- `pnpm build` passed, including the production Android Expo export.
- Native Android release assembly and repository APK emission passed.
- `git diff --check` passed.

Regression coverage includes screen-centred rectangular FOV geometry, zoom and
rotation scaling, selection-independent camera state, celestial-equator overview
orientation, all four horizon cardinals, local slider drag state, commit-on-release,
reverse drag without a zero-time flash, centred thumb styling, simplified copy,
and accessibility time steps.

## Release visual and interaction QA

The exact staged release APK was installed on the API 36 Pixel 8 emulator.

- 1080×2400 at 420 dpi: verified equator-centred overview, tilted local ground
  and horizon, persistent N/E/S/W labels, wide and narrow FOV setups, screen-centred
  FOV before and after atlas panning, simplified time sheet, and reverse slider drag.
- 720×1600 at 320 dpi after a cold restart: verified responsive relayout,
  centred FOV, ground/cardinal geometry, and the complete simplified time sheet
  without clipping.
- Final log review found no fatal exception, ANR, or React Native error.
- The synthetic QA setup was restored from 50 mm to its original 400 mm focal
  length after exercising a visibly wide FOV.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,925,350 bytes
- SHA-256: `058AA4BBA59512B1D1402D147A7D56A0FBA17D2FAB366A030C01FAAADF406A23`

No dependency, permission, persistence, remote-data, or sensitive-logging surface
was added by this change.
