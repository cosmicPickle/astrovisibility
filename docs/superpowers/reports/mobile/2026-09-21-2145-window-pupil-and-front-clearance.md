# Physical pupil and front-window correction

**Timestamp:** 2026-09-21 21:45 +03:00 (Europe/Sofia)

**Controlling specification:**
`docs/superpowers/specs/mobile/2026-09-21-2109-window-pupil-and-front-clearance.md`.

## Delivered behavior

Existing optics aperture diameter now supplies a circular entrance pupil at the
moving lens position. Visibility requires the entire pupil to clear the opening
for the entire imaging frame. This fixes the demonstrated 178-degree case where
the lens centre cleared while a 35 mm aperture was already partly shaded.
Sensor size continues to determine imaging field of view; no new input is needed.

In front of the window, forward rays pointing away from the wall clear that wall.
Rays pointing back toward it must intersect inside its rectangular opening. The
old complement-of-cone rule admitted actual wall hits and is removed from centre,
frame and refinement paths. Frames with clear corners but an interior wall hit,
and pupils crossing the window plane, are covered explicitly.

The pupil footprint uses analytic extrema, with no dense pupil sampling in runtime
code. Refinement bounds include pupil radius and lens motion. Saved windows,
panoramas and masks remain intact; no schema migration, dependency, permission or
new logging is introduced. Calculation cache version is
`obstruction-visibility-v5-physical-pupil`; aperture is part of its settings key.
The yellow outline continues to represent the physical opening from lens centre.

## Verification

- Test-first regressions reproduced aperture shading and front-wall false clears.
  Invalid old angular-complement test expectations were replaced with independent
  wall-plane intersections rather than reused as a physical reference.
- Independent pupil-ray comparisons cover all three tracking modes, behind,
  contact, front and plane-straddling cases, including tangent and frame-interior
  wall hits. Nine four-hour trajectories are compared with one-second physical
  references; summary and trajectory transitions meet the 30-second tolerance.
- Equipment tests verify saved diameter propagation, cache invalidation and
  unchanged no-window/no-optics behavior. Existing editing, mask, astronomy and
  catalogue coverage remains included.
- Final ordered gates passed: `pnpm format`, `pnpm typecheck`, `pnpm lint`, the
  relevant union of 53 suites / 270 tests, and `pnpm build`.
- Relevant test command:
  `pnpm --filter @astrovisibility/mobile test --testPathPattern 'src/(window|astronomy|equipment|targets|mask)/|src/sky/.*Frame|src/storage/visibilityCalculationCache'`.
- Final desktop catalogue benchmark: absent 1,974 ms, zero offset 2,137 ms,
  displaced 2,109 ms, flush 4,000 ms, exterior 4,350 ms; preparation 11 ms.
  The existing five-second local guardrail was preserved. These are desktop
  regression measurements, not physical Android performance evidence.

**Visual QA passed:** installed release APK on Android API 36, representative
1080 x 2400 / 420 dpi and constrained 720 x 1280 / 320 dpi with font scale 1.3.
The synthetic saved profile migrated from schema 9 to existing schema 11.
Redefine window preserved a 120 cm, 200-degree opening through save and reopen.
Constrained controls remained reachable by scrolling. AltAz, EQ and field-rotator
selection recalculated visibility. Target list and selected-target card agreed
on multiple intervals: synthetic M31 gave 5h44m in AltAz and 6h1m in the checked
EQ/rotator settings. App-PID-filtered AndroidRuntime/ReactNativeJS error check was
empty. Screenshots are local synthetic fixtures under `tmp/window-qa/`.

The trajectory also labels daytime obstruction transitions; the list/card
intersects visibility with astronomical darkness. Their different daytime
labels are expected and do not imply different window classification.

## Artifact and limits

Current release APK: `tmp/artifacts/android/app-release.apk`, 413,946,763 bytes.
SHA-256: `A75CF78CA28B23718D62E9669650FDCF43C44D372F6E3E44ACDAE2938B77D757`.
Gradle assembleRelease succeeded against final app inputs. A transient initial
packaging failure cleared on retry; an installation file lock then prevented
the staging rename. After installation completed, verified Gradle output was
copied to the required artifact path and source/staged hashes matched. No app
inputs changed afterward.

Security/privacy review: bounded scalar geometry and calculation-local weak
caches; existing validated equipment supplies diameter; no network or data
export path added. Real user attachments remain untouched and uncommitted.

This is a circular-pupil, flat-wall-opening model, not finite wall thickness or
measurement of an instrument's internal entrance-pupil location. The original
synthetic 178-degree M27 cases advance shading by 5:06, 8:43 and 29:10 depending
on lateral position. They do not establish the user's actual roughly 90-minute
error is resolved. Retrying the saved profile with this build supplies the next
evidence; exact-night replay and physical-device performance remain open.
