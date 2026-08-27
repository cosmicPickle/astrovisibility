# Target Discovery Performance Verification

Timestamp: 2026-08-27 18:07 +03:00 (Europe/Sofia)

## Outcome

Implemented the target-discovery and visibility-performance specification in
`docs/superpowers/specs/mobile/2026-08-27-1724-target-discovery-performance.md`.
The Android release build was installed and exercised on an emulator before the
share artifact was staged.

## Delivered behavior

- Opacity sliders preview locally and commit panorama or mask opacity only when
  the gesture ends. The zero region is reachable, and zero removes the overlay
  from the renderer rather than drawing a transparent surface.
- Normal discovery excludes targets without a supported deep-sky category or a
  finite positive angular major axis. These rows do not enter default atlas,
  list, count, projection, suitability, or visibility-calculation work.
- Direct name, alias, and catalogue search can still return excluded catalogue
  rows. Selecting one provides the sole atlas exception until it is deselected.
- Galaxy, Nebula, and Star Cluster filters plus debounced search are shared
  between Sky View options and View All Targets.
- Both discovery surfaces enforce the selected optics' suitability rule. The Sky
  View header now reports suitable targets that are actually visible when a
  completed mask exists, or suitable above-horizon targets as unassessed when no
  mask exists.
- Visibility summaries and selected-target trajectories are cached per profile
  in SQLite. Cache identity includes observer/location, timezone, time window,
  panorama, mask, and calculation versions; it excludes UI filters, opacity,
  and equipment. Storage is bounded to 20,000 summaries and 64 trajectories.

## Automated verification

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed: 64 suites, 322 tests.
- `pnpm build` — passed: Expo Android export.
- Focused tests covered deferred opacity commits, zero-disable renderer wiring,
  discovery/search classification, shared discovery state, equipment filtering,
  ranking exclusions, cache migration/repository behavior, cache reuse, and
  selected-target persistence.
- `pnpm format` reported existing formatting drift in 19 unrelated repository
  files. Those user-owned files were not rewritten. All files changed by this
  task were formatted and checked separately.

## Android release and visual QA

- Built the release with the repository Android-share workflow. An initial
  `:app:packageRelease` invocation failed transiently; a stacktrace rerun and the
  complete share workflow both passed without source changes.
- Staged `tmp/artifacts/android/app-release.apk` (184,601,231 bytes).
- Installed that exact APK on `RallyPath_Pixel_8_API_36`.
- Reviewed Sky View, View Options, View All Targets, shared filter state, optics
  filtering, live target counts, and popular-name search at 1080 x 2400.
- Confirmed that disabling Nebula in View Options reduced the atlas count and
  remained disabled in View All Targets. Searching `Andromeda` returned
  Andromeda Galaxy with `M 31` and `NGC 224` identifiers; the same search reduced
  the atlas to the matching suitable above-horizon result.
- Repeated the affected list and options layouts at 720 x 1280. Controls remained
  reachable and usable; long category labels compacted with ellipsis.
- Device logs contained no fatal application exception or React Native error.
- A clean QA profile had no panorama/mask, so the opacity sheet could not be
  exercised against a real overlay during device QA. Its interaction and
  renderer-disable behavior are covered by automated component and screen tests.

## Risk review

- No remote data path, permission, logging, or dependency was added.
- Cache writes are local, bounded, and opportunistic; corrupt rows are removed
  and treated as misses. Cache failures fall back to calculation rather than
  blocking visibility results.
- Profile location, time-window, panorama, and mask changes cannot reuse a stale
  cache context. Search, categories, equipment, and opacity do not invalidate
  astronomy results unnecessarily.
