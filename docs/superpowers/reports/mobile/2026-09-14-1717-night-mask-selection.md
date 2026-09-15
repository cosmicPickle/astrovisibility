# Night panorama magic-selection refinement

Timestamp: 2026-09-14 17:17 +03:00 (Europe/Sofia)

Specification: `docs/superpowers/specs/mobile/2026-09-14-1629-night-mask-selection.md`.

## Delivered

Magic selection now uses the centre path of the brush to identify intended
surfaces. A large disc no longer starts separate fills in every colour it touches.
The existing compact UI, manual painting, camera, coverage and saved mask format
remain compatible with existing panoramas.

The native worker prepares an original-resolution OpenCV mean-shift colour image,
detects supported boundaries, and estimates a stable local reference colour for
each seed. The tighter dark-colour range and noise reduction improve continuity
without broadly filling across faint tree/sky boundaries. Prepared data is cached
until the editing session ends. The displayed photograph is unchanged.

This uses the already bundled OpenCV 4.13.0 library. It adds no dependency,
download, network processing, permission or migration.

## Verification

`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` passed
against the final runtime changes. All 92 JavaScript suites / 457 tests pass.

Real OpenCV Android instrumentation passed:

- Deterministic night fixtures with RGB noise amplitudes 3, 5 and 7, gentle
  shading, a dark trunk/canopy, and separate sky. Interior sky coverage was
  100%, 100% and 99.50%; tree coverage was 100%, 100% and 99.99%. No wrong-side
  interior pixels were selected; the paired nearby taps had identical results.
- A 2048-square noisy finite-trunk fixture had 15 missing pixels out of
  3,269,242 tested sky-interior pixels. Three additional seeds across the scene
  selected no pixels in the checked trunk interior.
- Large brush centre intent, sparse pointer events, two-pixel contrasting
  branches, transparent gaps, cancellation, oversized requests, north wrap,
  horizon clipping, zenith and the existing 24 rotated/zoomed cap checks.
- Existing independent strokes still work after cached seed-colour restoration.

Visual QA passed on the final Android release, Pixel 8 API 36 / SwiftShader,
at 720x1280 / 320 dpi and 1080x2400 / 420 dpi. The synthetic night panorama has
independent noise, a dark trunk/canopy, a thin diagonal branch and a brighter wall.
Checked sky selection, erasing, 72-pixel-brush tree selection, saving and reopening
after process restart. The final sky selection excludes the trunk and thin branch;
the final tree selection leaves the sky untouched. No Android runtime errors
appeared in these flows.

The owner's screenshot informed the failure cases but was not uploaded, committed,
or treated as an original-resolution panorama test. Earlier intermediate filters
passed smaller fixtures but leaked or left visible pinholes in Android; those
builds were superseded by the inspected mean-shift version.

## Cost and limitations

The final 2048-square noisy-image native benchmark took 508 ms to prepare the
image once and 21 ms for a cached selection. These exclude decode, JS/file transfer,
GPU upload and UI scheduling, and are emulator measurements, not phone guarantees.
The first magic stroke is consequently more expensive than subsequent strokes.

The Lab byte cache adds at most 12 MiB; connected-component labels temporarily
use 16 MiB at 2048 square. Image dimensions, file sizes, sample attempts, seeds,
region count and checked worker deadline remain bounded. Native matrices and
session files follow the existing release/cancellation lifecycle. No sensitive
image data or observing coordinates are logged.

The tool still uses image evidence rather than semantic tree/sky recognition.
Invisible boundaries, very weak tiny features, reflections and strong lighting
changes can need manual corrections. It does not infer boundaries absent from
the photograph, nor guarantee that every real night panorama will match the
synthetic results.

## Delivery

- Branch: `feature/cubemap-background-renderer`; existing cubemap and time
  optimizations remain included. Main is unchanged.
- Fresh release: `tmp/artifacts/android/app-release.apk` in both the experiment
  worktree and root workspace, built 2026-09-14 17:14 +03:00.
- Size: 336,980,847 bytes. APK v2 signature verified.
- SHA-256: `f1c233ed1ded54ae3fae46120409a34149857e3413118bb316accc78bd39887d`.
- Screenshots, synthetic fixture generation and logs remain ignored under
  root `tmp/night-mask-qa` and experiment-worktree `tmp/night-*.log`.
- The temporary Android user/test package were removed, original emulator APK
  restored, and original display dimensions/density restored. Owner app data
  was preserved. The owned emulator and Gradle/Kotlin daemons were stopped.
- Commits remain local. Publication of the preceding `f170195` commit was
  blocked by automatic approval review and the owner has not approved that push;
  this task does not retry it or merge the branch.
