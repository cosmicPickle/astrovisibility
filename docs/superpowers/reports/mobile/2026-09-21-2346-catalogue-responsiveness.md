# Catalogue responsiveness verification

Timestamp: 2026-09-21 23:46 +03:00 (Europe/Sofia)

Controlling specification:
`docs/superpowers/specs/2026-09-21-2327-catalogue-responsiveness.md`.

## Defects and changes

Progress was published only after 256 targets, although individual targets could
be expensive. The initial total also included equipment-ineligible targets.
The calculator now publishes the filtered count before work and completed work
at 100 ms checkpoints, independently of its database batch size.

Each target previously ran synchronously to completion. The summary now has
cooperative checkpoints between coarse segments and every 32 subdivisions.
It yields after a 12 ms elapsed budget and checks cancellation before resuming.
The synchronous API drains the same steps. Depth-first sample order, numerical
tolerances, interval assembly and geometry remain unchanged. This is cooperative
scheduling, not a hard real-time guarantee for an individual spatial query or
initial index construction.

CPU profiling identified spherical mask searches as the largest cost. A cap's
centre pixel now proves an intersection immediately when it has the requested
state and is above the horizon. Otherwise the original complete spatial query
runs. This shortcut only proves presence; it cannot overlook a blocked island
or a clear hole. Equipment imaging-frame settings are constructed once per run.

## Verification

Regression tests first failed for delayed progress and the missing cooperative
summary API. They now cover early filtered totals, progress before 256 results,
within-target cancellation, exact synchronous/cooperative interval equality,
and mask intersections at/off the centre and across the horizon.

The affected 52 suites contain 306 tests: astronomy, masks, windows, target
discovery, sky-screen consumption and persistence. Existing local/CI performance
limits were retained. The isolated final 12-hour catalogue benchmark measured:

| Window mode | Desktop milliseconds |
| ----------- | -------------------: |
| Absent      |                1,751 |
| Zero offset |                1,652 |
| Displaced   |                1,689 |
| Flush       |                3,204 |
| Exterior    |                3,537 |

Window preparation took 10 ms. One intermediate run overlapped APK packaging
and recorded 5,285 ms for flush; after stopping owned build/emulator processes,
the unchanged code passed in isolation. A mistaken nonexistent test path was
also corrected; no tests or time limits were weakened.

Visual QA passed on the Android API 36 release app at 1080x2400/density 420 and
720x1280/density 320 with 1.3 text scale. Only synthetic profile/window/mask data
was used. A cold 24-hour catalogue showed 264/1025 (26%) and a separate cold run
444/1025 (43%). Cancellation displayed its cancelled state in the capture taken
300 ms after tapping, retained partial results, and retry completed. Restart
reused persisted results: 820 ranked, 1025 calculated. Scrolling and result rows
remained usable on the constrained viewport. No physical-phone timing claim is
made from emulator evidence.

Final release APK: `tmp/artifacts/android/app-release.apk`, 413,950,591 bytes.
SHA-256: `33E05CE66F00E020EAD0A1F4009F4A0BCADB0C9C58F316824DD9079E7EB02FEC`.
The final artifact was installed and smoke-tested after a comment-only rebuild.
Owned emulator, adb server and Gradle daemon were stopped and display settings
restored.

No dependencies, permissions, persisted formats, sensitive logging, or geometry
policy changed. Existing raster/query/sample limits remain enforced. The earlier
real-observation cutoff discrepancy is still open and is not resolved by this
performance work.
