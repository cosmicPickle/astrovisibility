# Horizon orientation and FOV correction verification

**Completed:** 2026-08-20 15:51 +03:00 (Europe/Sofia)

## Outcome

- Sky View now starts at the zenith in the local-horizontal mount at a
  180-degree stereographic overview. The complete local horizon is the stable
  ground boundary, oriented N top, E left, S bottom, W right. Navigation retains
  the horizontal mount and cannot accumulate equatorial roll.
- The celestial equator remains as optional-context groundwork but its stroke
  opacity is reduced to 0.16 and its width to one pixel.
- The DWARF 3 telephoto regression uses the manufacturer values of 150 mm focal
  length and an IMX678 3840×2160 sensor at 2 µm. The physical sensor is therefore
  7.68×4.32 mm and the calculated frame is 2.93°×1.65°.
- Physical sensor dimensions above 100 mm are rejected by the form with an
  explicit explanation that pixel resolution is not a millimetre dimension.
- Forward migration v4 repairs only configurations where both stored dimensions
  are at least 256, pixel size is 0.5–20 µm, and both converted physical
  dimensions are at most 100 mm. Ambiguous values are not guessed.

Reference: https://www.dwarflab.com/products/dwarf-3-smart-telescope

## Automated verification

- `pnpm format` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 53 suites, 252 tests.
- `pnpm build` passed, including the production Android Expo export.
- Native Android `assembleRelease` passed: 669 actionable tasks.
- `git diff --check` passed.

Regression coverage includes the horizontal camera mount and zenith centre,
complete horizon cardinal projection, faint celestial-equator styling, exact
DWARF frame geometry and aspect ratio, physical-unit form validation and helper
copy, idempotent migration versioning, persisted sensor conversion, and the
existing mask-migration history.

## Release upgrade and visual QA

The exact staged release APK was installed on the API 36 Pixel 8 emulator.

1. The prior release created a real persisted `DWARF 3` configuration with
   3840×2160 in the millimetre fields. It displayed the reproduced failure:
   171.07°×164.19° and 3840×2160 mm.
2. The new APK was installed over that release without clearing data. Startup
   migration converted the same record to 7.68×4.32 mm and 2.93°×1.65°.
3. At 1080×2400/420 dpi, Sky View displayed a small centred 16:9 DWARF reticle,
   a zenith-centred horizon disk, correctly ordered fixed-size cardinals, opaque
   ground outside the horizon, and a much fainter celestial equator.
4. The same flow passed after a cold relayout at 720×1600/320 dpi without
   clipping or stale geometry.
5. Final log review found no fatal exception, ANR, or React Native error.

The temporary DWARF QA record was deleted afterward and the original `SkyFOV`
selection, 1080×2400 size, and default density were restored.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,926,302 bytes
- SHA-256: `75E4D6901A71FBAC4835EBC65B036D85011FFB166A461D1A41E6D9F4A417740E`

No dependency, permission, remote-data, or sensitive-logging surface was added.
The only persisted-data change is the bounded forward migration described above.
