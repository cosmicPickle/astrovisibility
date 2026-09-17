# Target filter presentation verification

Timestamp: 2026-09-17 15:39 +03:00 (Europe/Sofia)

Controlling specification:
`../../specs/mobile/2026-09-17-1528-target-filter-presentation.md`.

## Delivered behavior

Both discovery surfaces use a funnel beside search to reveal initially hidden
filters. Numeric fields have joined shaded label/unit caps and editable centres;
size limits share one row and duration occupies the next. Expanded state is
accessible, and a dot plus accessible active-filter count identifies applied
limits even while collapsed. Invalid drafts retain existing validation feedback.

Ordering controls appear only in View All Targets. Both comparator modes place
mask-assessed zero-visible-duration targets last before existing size/duration
and deterministic ties. Unassessed no-mask targets retain their existing semantics.
No filter, astronomy, persistence, permission, or dependency contract changed.

## Verification

- Regression-first checks failed on the old disclosure and blocked ordering.
- Final `pnpm format`, `pnpm typecheck`, and `pnpm lint` passed in order.
- Seven affected suites passed all 53 tests: discovery controls, ranking,
  target-list screen, advanced limits, shared discovery state, Sky View screen,
  and shared Sky View duration calculations.
- `pnpm build` passed catalogue/sky asset validation and Android export.
- The build/share skill completed native `assembleRelease` successfully and
  staged `tmp/artifacts/android/app-release.apk` (413,866,203 bytes).
- APK SHA-256:
  `43E6CEA7989913F3AF59F87C843263A5EC1DD1DF7B72D9753E0288843CB52624`.

An initial test invocation named a nonexistent duration test path. Correcting
the path and rerunning the complete gate sequence produced the results above.

## Visual QA passed

Inspected the staged release APK on Android API 36 at 1080 × 2400 / 420 dpi and
720 × 1280 / 320 dpi. Verified both screens, initial collapse, expanded fields,
the funnel's active indicator, list-only ordering and selection changes,
shared values across navigation, decimal keyboard, scroll access to fields,
60 px validation feedback and recovery, and disabled size fields without optics.
Fields and caps fit both widths without clipped labels or overlapping controls.

Only an isolated synthetic profile and equipment were used. The original emulator
database was restored with matching SHA-256, and original display/keyboard
settings and non-root ADB mode were restored. QA screenshots are ignored local
files under `tmp/advanced-refinement-*.png`. Owned emulator descendants and the
ADB server were stopped after review.

## Review

No new data collection, network activity, logging, dependencies, migrations,
native permissions, or unbounded work. Existing numeric input length/range
validation and local cache behavior remain intact. The comparator adds constant
work per comparison. The final diff is limited to the approved controls, ranking,
regressions, and documentation.
