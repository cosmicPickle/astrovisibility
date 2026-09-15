# Directional mask editor delivery

Timestamp: 2026-09-14 16:02 +03:00 (Europe/Sofia)

Controlling specification:
`docs/superpowers/specs/mobile/2026-09-14-1502-mask-selection-editor.md`.

## Delivered behavior

The existing combined cubemap/time-optimization branch now has manual and magic
mask brushes. Draw blocks and erase exposes captured sky in either mode. Magic
uses the already bundled OpenCV library to grow four-connected, similarly
coloured regions from the brush footprint. Uncaptured directions remain blocked.
The original panorama and binary-mask formats are unchanged; existing captures
and masks work without recapture or migration.

The editor now uses the Sky View's stereographic camera and a cubemap panorama.
Its changing mask samples the authoritative raster directly. One finger paints;
two fingers pan and zoom. Adding a second finger cancels the pending stroke,
and navigation retains ownership until every finger lifts. Android touch-up
payload handling has an explicit regression test. Upward views, north wrap and
screen brush sizes use the same camera basis for display and rasterization.

The two centered rows contain brush decrease/value/increase, followed by
draw/erase and wand/manual-hand segmented icon buttons. Tapping the size opens
the existing slider. The short navigation hint fits both checked viewports.
Save errors are announced inside the completion sheet and retain the draft.
Failed, cancelled or oversized selections do not partially modify the mask.

## Verification

- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` passed.
  The final JavaScript suite contains 92 suites and 457 tests.
- Android native checks passed using real OpenCV, including colour boundaries,
  disconnected matching regions, transparent gaps, multiple seeds, cancellation,
  invalid seeds and independent spherical-cap checks for 24 rotated/zoomed
  views plus a centered zenith brush. Horizon and north wrap are included.
- A saved synthetic 2048-square mask reopened after process restart. Its PNG
  alpha agrees with its authoritative bitset at all 4,194,304 pixels; every
  uncaptured pixel remains blocked.
- Visual QA passed on the Pixel 8 API 36 emulator with SwiftShader at
  1080x2400 / 420 dpi and 720x1280 / 320 dpi. Checked manual tap/stroke,
  magic region drawing and erasing, two-finger zoom and upward pan, retained
  mask alignment, size steps, the slider sheet, completion and restart.
- Final APK signature verification passed using v2 signing. There were no
  new Android runtime errors in the checked flows.

## Performance and limits

On the same emulator, the 2048-square, 80-by-20 screen-pixel synthetic stroke
with a 32-pixel brush took 515 ms with a full-atlas scan and 89 ms after bounding
the scan. Cached connected selection of the uniform test image took 79 ms.
These measure the native kernels, excluding initial image preparation, image
upload and UI scheduling; they are not physical-phone frame-rate claims.
One sampled editor process used approximately 367 MiB PSS with SwiftShader and
the app's resident resources; this is not a hardware memory budget.

Source images are bounded to 2048 per side and 32 MiB encoded input. Native
processing uses a single worker, local private files, one prepared panorama,
bounded stroke/region counts and a five-second checked work deadline. Sessions
release their matrices and temporary selection files on exit; no permissions,
dependency versions, network service or private logging were added.

Magic selection is based on connected colour similarity. Weak edges, reflections
and similarly coloured surfaces can require manual corrections. A brush that
touches two regions can select both. The size and manual tools remain available
for that refinement.

## Artifact and repository state

- Branch: `feature/cubemap-background-renderer`, based on combined commit
  `f3a0e0d`; the earlier time-rendering optimizations remain included.
- Main is unchanged by this task. Cubemap-to-main merge still awaits the owner.
- Staged release: `tmp/artifacts/android/app-release.apk` in the root workspace
  and the experiment worktree, built 2026-09-14 15:56 +03:00.
- Size: 336,980,847 bytes.
- SHA-256: `36feaf55404ca0a825a1aac14e1e9010105b3bd00e8bcdb72520cabc195b9e7f`.
- Synthetic QA screenshots and logs are ignored under `tmp/mask-editor-qa`
  and the experiment worktree's `tmp` directory. No real panorama, observing
  coordinates or uploaded attachment is committed.
- The temporary Android user and instrumentation package were removed, the
  original emulator APK and display settings restored, and owned build/emulator
  processes stopped. The owner's original app data was left intact.
