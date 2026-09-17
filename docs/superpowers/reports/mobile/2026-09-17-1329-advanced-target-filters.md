# Advanced target filters and ordering verification

Timestamp: 2026-09-17 13:29 +03:00 (Europe/Sofia)

Implemented the shared Advanced section and Biggest / Longest Visible selector
under the existing search/category controls in both discovery surfaces.
Minor-axis sensor-pixel limits retain the global 60 px minimum. Duration uses
total usable dark time, preserving unassessed-obstruction wording without a mask.
Blank limits are unrestricted; invalid drafts retain the last valid applied
limits. Existing direct-search and selected-target exceptions remain intact.
Order by sets the shared list order; existing sky prominence/zoom density remains.

The two screens reuse the same local summary-cache loading/writing path. Filter
and sort edits do not invalidate astronomy results. Sky duration calculations
publish partial progress, offer retry after failure, and stop when the route
loses focus or its context changes. No new dependency, permission, persisted
format, or numerical approximation was introduced.

## Automated checks

Final sequence passed: `pnpm format`, `pnpm typecheck`, `pnpm lint`, the 10
affected test suites (64 tests), and `pnpm build`. Coverage includes validation,
inclusive size/duration boundaries, circular minor-axis fallback, no optics,
global suitability, area/duration ordering and deterministic ties, shared state,
cached duration filtering, explicit selection, inactive-route cancellation,
failure/retry, existing search/category behavior, and the production-catalogue
performance guardrails.

New tests first failed for missing filtering/controls and incorrect Biggest
ordering. The inactive-route regression first reproduced background calculation.
A benchmark run alongside native compilation exceeded its 5-second guardrail
(5.358 seconds); the isolated focused rerun passed at 4.682 seconds, and the
complete final gate sequence passed without weakening the benchmark.

`gradlew.bat assembleRelease --offline` also passed using the existing Gradle
cache. The final native release was installed for visual review.

## Visual QA passed

Android API 36 emulator: 1080 × 2400 at 420 dpi and 720 × 1280 at 320 dpi.
Verified collapsed/expanded Advanced sections, inline size/duration fields,
disabled pixel fields without optics, numeric keyboard scrolling, the 60 px
minimum, inverted-range feedback, both order selections, shared values across
navigation, filtered list results, and list-to-selected-target handoff.
The compact screen scrolls to reach controls below the keyboard and longer
validation text wraps without overlapping fields.

Only a synthetic Filter QA profile and QA optics were used. The original emulator
database was backed up on the emulator and restored with matching SHA-256 after
review. Original display settings and non-root ADB mode were restored, and owned
emulator/ADB processes were stopped. Screenshots are ignored local artifacts under
`tmp/advanced-*.png`; no personal coordinates, panoramas, or database payloads were
added to source control.

## Review

Numeric inputs are length-bounded, finite, nonnegative, and range-validated.
Filters remain local and introduce no new network or logging surface. Astronomy
work retains existing bounded batches and cancellation; no per-frame visibility
calculation was introduced. Existing catalogue identity, visibility intervals,
mask semantics, navigation, and user data are preserved.
