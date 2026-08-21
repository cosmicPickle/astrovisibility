# Sky and target-discovery polish verification

Timestamp: 2026-08-21 22:47 +03:00 (Europe/Sofia)

## Scope

Verified the implementation specified by
`docs/superpowers/specs/mobile/2026-08-21-2158-sky-target-discovery-polish.md`:

- astronomical-darkness trajectory coloring and dark-visible-time ranking;
- consolidated Sky View overlay/equipment controls and compact target details;
- simplified opacity sheets;
- catalogue search and contiguous multi-select target categories;
- mosaic-friendly 60 px minimum-minor-axis equipment filtering.

## Automated verification

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 62 suites and 307 tests.
- `pnpm build`: passed; catalogue artifacts were current and the Android Expo
  export completed.
- Focused trajectory regression: passed; the observing-window end is exclusive
  for hourly markers, preventing a duplicate label where a 24-hour trajectory
  closes on itself.
- `pnpm format`: the repository-wide check remains blocked by the same 19
  pre-existing formatting findings in untouched files. Task-owned files pass a
  targeted Prettier check.

## Android release and visual QA

The repository Android sharing workflow built and staged a fresh release APK at
`tmp/artifacts/android/app-release.apk`.

- Size: 184,573,987 bytes.
- SHA-256: `58D8E6D9EF6E9BAF9CC265E0CB06A952669F8D4C3D7138784A4A13DEAABFFF7F`.
- Representative viewport: Pixel 8 emulator, 1080 × 2400 at density 420.
- Constrained viewport: 720 × 1280 at density 320 (360 dp wide).

On the installed release APK, verified:

- the bottom-left eye and bottom-right search controls render and remain
  reachable;
- the eye menu opens and presents the available view controls;
- the target list shows a catalogue-number search field, contiguous pressed
  category segments, and the concise equipment threshold;
- searching `NGC6960` returns the Veil Nebula (`C 34 · NGC 6960`);
- selecting that result returns to the sky with the compact target card and
  adjacent information icon;
- the selected trajectory uses distinct light-blue daytime and dark-blue
  astronomical-darkness sections;
- the 24-hour trajectory has one midnight label at its closing direction;
- all affected controls and text remain usable at the constrained viewport.

The emulator display overrides were restored to 1080 × 2400 and density 420,
and the task-owned emulator process was stopped after QA.
