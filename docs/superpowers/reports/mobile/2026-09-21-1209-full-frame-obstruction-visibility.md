# Full-frame obstruction visibility verification

**Timestamp:** 2026-09-21 12:09 +03:00 (Europe/Sofia)

**Specification:** [Full-frame obstruction visibility](../../specs/mobile/2026-09-21-0955-full-frame-obstruction-visibility.md).

## Delivered behavior

Selected optics use their complete spherical imaging rectangle when deriving
visibility intervals, ranking, the sky count and selected-target assessment.
Interior blocked pixels count even when the center and corners are clear.
Without optics, existing center assessment remains; without a completed mask,
local visibility remains unassessed.

Optics → Orientation saves the angle and AltAz, EQ or active field-rotator mode
with the equipment. Existing equipment defaults explicitly to AltAz/zero.
Migration 10 preserves user data and invalidates derived visibility caches.
The selected target's displayed frame follows the same physical geometry.
Window displacement, lens offset and the window editor are outside this change.

## Automated verification

Final commands passed in order: `pnpm format`, `pnpm typecheck`, `pnpm lint`,
`pnpm test` (102 suites, 517 tests), and `pnpm build`. The final Android
`assembleRelease` build passed through the required build-share script.

Regressions cover interior islands, edge clipping, nearby clear sky, rotation,
north wrap, zenith, horizon and clamped outer raster cells, celestial/polar bases,
shared list/trajectory intervals, no-mask behavior and cache identity. SQLite
tests reconstruct the released version-9 equipment schema and verify migration
and reopened-database persistence. UI tests cover rejected writes, drag rollback,
retry, equipment selection and graceful mask-resource failure.

The production catalogue has 13,371 physical records. Full-catalogue benchmarks
run the existing discovery/suitability filter with synthetic 150 mm optics,
3840×2160 pixels at 2 µm, EQ at 30°, and a 2048² opening/branch raster. Both the
12-hour and 25-hour cases pass the five-second desktop calculation budget.
The separate representative 256-target, 3°×2° batch passes its one-second budget.
Fixture construction is outside the timed calculation; cold index construction
is inside it. These are regression bounds on this Windows desktop, not phone
latency measurements. Catalogue calculation yields between targets after 12 ms.

The maximum mask index is analytically bounded below 9.8 MB, excluding the
existing bitset and object overhead. Each spatial query is limited to 100,000
nodes and trajectories retain the 100,000-sample limit. Limit failures do not
fabricate clear/blocked results. Peak application memory and device cancellation
latency have not been measured.

## Visual verification

**Visual QA passed:** Android API 36 emulator, 1080×2400 at 420 dpi and
720×1280 at 320 dpi (approximately 411×914 and 360×640 logical viewports).

Exercised the saved AltAz/EQ/field-rotator control, angle adjustment, upgrade and
restart persistence, no-mask warning, target-list return, selected physical frame,
preview-time changes and a completed synthetic mask with an opening and narrow
branch. The masked NGC 185 fixture displayed two night-time visible intervals;
list and selected-target totals agreed at 8h 15m. The constrained screen kept
controls reachable, explanatory text wrapped, and target results scrolled into
view. Release React Native/Android error logs were empty during these checks.

Local evidence is in `tmp/full-frame/`: `orientation-large.png`,
`selected-large.png`, `orientation-small.png`, `masked-small.png`, final test,
export and release build logs. Screenshots use synthetic QA profiles. The seeded
mask is a test fixture and does not exercise panorama capture or stitching.

## Privacy and remaining verification

No dependencies, permissions, services, remote processing or telemetry were
added. Framing writes use validated enums/numbers and parameterized SQL. Existing
migrations remain unchanged. Test imagery, database seed and APK stay ignored;
unrelated user attachments are excluded from the commit.

The release APK is staged at `tmp/artifacts/android/app-release.apk` (413,891,179
bytes). No app inputs changed after its successful build.
SHA-256: `831270955ab0dec4860313b1562150eb5f3547f6776d21bab62e551cc916a19b`.
The agent-owned read-only emulator was stopped after restoring its size, density
and ADB privilege setting; its test data does not persist to the saved AVD.

Physical Android performance remains **unverified**: no physical device was
connected. The required 50 fps p95 / no-stall-over-100-ms interaction check,
physical cold/warm timing, peak memory and cancellation latency remain in
`State.md`. Emulator review and desktop benchmarks do not satisfy those gates.
