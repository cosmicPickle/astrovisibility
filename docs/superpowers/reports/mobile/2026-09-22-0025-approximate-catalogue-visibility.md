# Approximate catalogue visibility verification

Timestamp: 2026-09-22 00:25 +03:00 (Europe/Sofia)

Controlling specification:
`../../specs/2026-09-22-0000-approximate-catalogue-visibility.md`.

## Result

Bulk discovery uses the target centre against the original painted mask, without
physical window, displaced lens, pupil or imaging-frame geometry. It retains
equipment suitability and dark-time filtering. Durations and interval labels
explicitly say `Approx.`; duration filtering has the same explanation.

Two-minute sampling refines detected changes to 30 seconds. Short intervals can
be missed, which is an intentional ranking approximation. Detailed selected-target
sampling and geometry remain unchanged. Separate versioned catalogue target keys
prevent detailed and approximate cache results from replacing one another.

Mask checks run only in dark, above-horizon intervals. Unchanged approximate
segments bypass subdivision allocations. No dependencies, permissions, schema
migrations, remote data handling, or user-data changes were introduced.

## Automated verification

- Test-first regressions cover original-mask classification, excluded geometry,
  detailed-cache isolation, approximate labels and bounded centre sampling.
- Final required sequence passed: `pnpm format`, `pnpm typecheck`, `pnpm lint`,
  the 53 relevant suites (312 tests), and `pnpm build`.
- Relevant test command:
  `pnpm test --testPathPattern 'src/(astronomy|mask|window|targets)/|src/sky/SkyViewScreen.test|src/storage/persistence.test'`.
- Final desktop catalogue benchmark: 371 ms over 12 hours and 487 ms over 25
  hours, approximately 1,000 optics-eligible targets. Five window configurations
  took 377–393 ms and produced identical centre estimates. The existing full
  production catalogue benchmark without optics also passed its unchanged
  five-second desktop limit. These are desktop measurements, not handset claims.
- Approximation benchmarks now enforce two seconds locally/four seconds in CI,
  tightened from five/ten seconds. Detailed geometry suites remain in the gate.
- Resource review: bounded sampling, retained cancellation/progress, existing
  input validation, local caches and no sensitive logging. No user attachments
  or observing data were added to fixtures.

## Android visual QA passed

Tested the staged release APK on the API 36 Android emulator using synthetic
panorama/mask, a 1.2 m window spanning 200 degrees and optics with 50 mm offset.
Representative viewport: 1080 × 2400, density 420. Constrained viewport:
720 × 1280, density 320, font scale 1.3.

- Cold catalogue loading advanced and completed all 1,025 eligible calculations,
  with 820 ranked results. A fresh-window screenshot captured 65% progress at
  6.64 seconds including route/data loading; completion was verified afterward.
  Startup includes the existing offline-catalogue preparation stage, so this is
  not an isolated calculation timing or a physical-phone benchmark.
- Approximate duration/interval labels, explanation, joined controls, scrolling
  and duration-filter note fit the constrained screen without overlap.
- Normal Sky View → catalogue → target selection navigation worked. Synthetic
  Andromeda showed `Approx. 8h 43m` in the catalogue and a detailed `5h 47m`
  split into two visible intervals in Sky View. Returning to the catalogue kept
  the approximation rather than substituting the detailed result.
- The synthetic profile's database retained 1,025 approximate summaries alongside
  one detailed summary and one detailed trajectory in the shared context.
- Emulator display settings were restored and task-owned emulator, Gradle and
  ADB processes stopped. No physical phone was available.

Local screenshots are under `tmp/window-qa/approximate-*.png`. The earlier
real-observation cutoff discrepancy remains outside this performance change.

## Release APK

Fresh `build-share-android-app` run succeeded in 52 seconds. Staged file:
`tmp/artifacts/android/app-release.apk`, 413,952,611 bytes.

SHA-256:
`D2D10C63A822423648377B4ADA4423ABA599CA5B74C6A72F9201A099D20BB147`.

No app inputs changed after this build. This is a local test APK, not a published
GitHub release.
