# Single panorama alignment and raster mask verification

Timestamp: 2026-08-21 16:57 +03:00

## Scope verified

- Panorama capture exposes **Align Tiles** after at least one tile exists.
- The alignment view uses gesture-driven sky navigation, selects photographed tiles,
  persists one-degree directional nudges, returns to capture, and proceeds to masking.
- Acceptance rasterizes the adjusted tiles into one 2048 × 2048
  azimuthal-equidistant upper-hemisphere PNG and removes the capture draft.
- Mask editing uses one panorama image with hard-edged Draw and Erase brushes plus a
  brush-size control. Completion stores one neutral binary PNG and a packed derived
  classification cache.
- Sky View renders the panorama and neutral light-gray mask as whole-sky directional
  images rather than repeated per-tile overlays.
- Migration 6 deliberately removes incompatible panoramas, masks, and capture drafts,
  as directly approved for this task.

## Automated verification

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed: 58 suites and 289 tests.
- Focused final layout tests — passed: 2 suites and 5 tests.
- `pnpm build` — passed Android Expo export before the final visual-only layout
  adjustment.
- Release Gradle build after the final change — passed: 710 tasks, with the APK staged
  by the repository build/share workflow.
- Changed files pass Prettier checks. The repository-wide `pnpm format` check still
  reports 21 pre-existing unrelated files; those files were left untouched.
- `git diff --check` — passed (line-ending notices only).

## Android visual and interaction verification

Installed the release APK on the running Android emulator and exercised a synthetic
single-tile flow at 1080 × 2400:

- capture screen and enabled/disabled Align Tiles states;
- gesture rotation from north through west to south;
- tile selection and a persisted right nudge from 180° to 181°;
- acceptance into the single-image mask editor;
- hard-edged red painting;
- saved neutral light-gray mask in Sky View;
- combined panorama and mask while rotating the sky view.

Repeated mask-editor inspection at a constrained 720 × 1280 viewport. The first pass
found the brush-size control overflowing; the tools were reflowed into a two-button row
plus a full-width brush control. The rebuilt release was reinstalled and visually
verified with all three controls and the completion action visible without clipping.

The synthetic QA panorama/mask and display-size override were removed afterward.

## Security and privacy review

The change adds no permissions, network transfer, analytics, or dependencies. Images
remain under app-owned local storage. Raster dimensions are fixed at 2048 × 2048,
capture files retain the existing 32 MB limit, identifiers and owned paths remain
validated, and persisted bitset lengths/projection metadata are checked when loaded.
