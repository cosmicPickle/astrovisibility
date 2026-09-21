# Window-sill geometry correction

**Timestamp:** 2026-09-21 16:51 +03:00 (Europe/Sofia)

**Specification:** [Window-sill geometry correction](../../specs/mobile/2026-09-21-1620-window-sill-geometry-fix.md).

Removed the unsupported 160-degree cap and the front-only plane-distance guard.
Saved definitions now retain signed distance and support the lens behind,
flush with, or in front of the opening. The directed opening may
exceed 180 degrees; its rear boundary still blocks directions. No setup fields,
schema migration, dependencies or permissions were added. Existing records and
original panorama/mask data remain intact.

Right-corner movement no longer divides by the dragged altitude's tangent. A
bounded least-squares update fits row height and perspective together, keeping
the dragged corner under the finger through the horizon. Wide saved windows
reopen facing outward with a suitable initial zoom.

Full-frame assessment now clips against the rear obstruction when the lens is
in front; testing only four corners is insufficient for that nonconvex clear
region. Refinement uses physical edge distance and a proven lens-motion bound,
so crossing the plane cannot discard real visibility changes or trigger excessive
refinement merely because plane distance approaches zero. Calculation identity
was advanced to invalidate older cached results.

The model remains the user-requested angular window-boundary approximation.
It does not reconstruct an infinite wall, wall depth or room geometry. Original
interior mask obstacles, captured-coverage blocking and the existing explicit
clear-background assumption remain in effect.

## Verification

Final gates passed in order: `pnpm format`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `pnpm build`. **109 suites and 563 tests passed.**

Regressions were reproduced before fixes. Coverage includes 160.01, 170, 179.9,
180, 180.1, 200 and 270-degree openings; analytic 1-metre sill positions;
oblique, rotated and scaled definitions; all four corner edits; right-corner
horizon crossing; finite exact-contact geometry; full-frame clipping with clear
corners surrounding a blocked interior; persistence/reload of wide definitions;
and an independent one-second reference while the moving lens crosses the plane.

Final synthetic 12-hour full-catalogue desktop timings with a 2048-square raster:

| Case                         |     Time |
| ---------------------------- | -------: |
| No window                    | 1,984 ms |
| Narrow window, zero offset   | 2,357 ms |
| Narrow window, displaced     | 2,812 ms |
| Flush window, displaced      | 3,536 ms |
| 200-degree window, displaced | 4,023 ms |

All remain within the existing five-second desktop guardrail. Profiling found
over-refinement near the zenith from dividing lens motion by near-zero plane
distance. Replacing that quantity with bounded angular edge motion fixed the
slowdown without loosening transition tolerances or the performance gate.

**Visual QA passed:** Android API 36 release APK on a task-owned read-only Pixel 8
emulator. Viewports: 1080 × 2400, density 420; 720 × 1280, density 320, including
font scale 1.3. All fixtures use synthetic panoramas and observing locations.

- Expanded a saved 175-degree opening to 189.96 degrees by dragging, then saved
  and reopened it after force stop/restart.
- Dragged the right lower corner through the horizon in both directions.
- Reproduced an exact-180-degree horizon-edge rendering crash. An edge through
  the viewing position has no direction; editor and Sky View outline projection
  now break the path there. Regression tests and the final release APK pass.
- On the final APK, opened that exact-contact definition, dragged it to 193.17
  degrees, saved/reopened, and exercised pan and real two-finger zoom.
- Verified readable constrained large-text layout and all four connected handles;
  checked the final representative layout and corrected Sky View.
- Selected IC 1831 from the calculated catalogue; Sky View showed its trajectory,
  corrected yellow boundary and matching 19:33–04:13 visibility interval.
- Final Android/React Native error logs were clear after repeating the fixed flows.

Local evidence is under ignored `tmp/window-sill-qa/` (gate/build logs and CPU
diagnostics) and `tmp/window-qa/sill-*.png` (synthetic rendered captures).

## Delivery and remaining check

The repository build/share script built and staged the final release APK after
all app changes: `tmp/artifacts/android/app-release.apk`, **413,944,087 bytes**.

SHA-256: `f769ad0f47abda42a698d77eceff4a7337ef794365f85c1815c24b125cfd4660`.

No app inputs changed after the final build. No GitHub Release, tag or version
change was made. Input work remains bounded; clipping uses four planes and at
most eight polygon vertices, while rendering keeps fixed edge tessellation.
No private images, coordinates or device data are committed.

Physical-phone performance remains unverified because no physical Android phone
is connected. The existing physical verification entry in `State.md` covers
latency, memory, cancellation and the 50 fps p95 / 100 ms stall targets, now
including flush and exterior window cases.
