# Read-only window angular width

**Timestamp:** 2026-09-21 18:06 +03:00 (Europe/Sofia)

**Authority:** User requests an automatically filled, non-editable angular width
field in Define/Redefine window.

The shared editor now displays Angular width beside Approximate window width.
It derives the directed horizontal azimuth span from the current draft, including
north wrap and spans above 180 degrees, and displays two decimal places with a
degree unit. It updates after corner gestures finish and after Reset corners.
The existing field component has editing disabled, and its accessibility hint
identifies the panorama capture position as the reference.

This adds no stored value, migration, permission, dependency, or per-trajectory
work. Physical width editing and all visibility geometry are unchanged. The
previously documented front-of-window defect remains separate from this field.

## Verification

- Added screen checks first and observed their expected missing-field failures.
  All five focused screen tests now pass, covering both flows, read-only state,
  north wrap, 179.99/180.00/180.01/200.00-degree spans, and independence from the
  physical width input, plus existing save/validation/failure/cancel behavior.
- Final sequence passed: `pnpm format`, `pnpm typecheck`, `pnpm lint`,
  `pnpm --filter @astrovisibility/mobile test --runTestsByPath src/window/WindowEditorScreen.test.tsx`,
  and `pnpm build`.
- **Visual QA passed:** Android API 36 emulator, 1080-by-2400 at 420 dpi and
  720-by-1280 at 320 dpi with font scale 1.3. Inspected both editor entry flows,
  readable side-by-side fields, corner drag from 175.00 to 184.81 degrees,
  Reset to 30.00 degrees, save/restart/reopen, scrolling to lower actions,
  physical-width keyboard input, and read-only tapping without a keyboard.
- Used only synthetic panorama/mask/profile fixtures. Screenshots are under
  ignored `tmp/window-qa/angular-*.png`. Reviewed the diff and input handling:
  the added arithmetic uses the already validated draft, adds constant work
  only on screen updates, and introduces no logging or external data access.

## Delivered APK

Built through the repository build/share skill after the final app changes;
the same release APK was installed for visual QA.

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 413,944,847 bytes
- Build timestamp: 2026-09-21 18:03:28 +03:00
- SHA-256: `a82e950b2aa25ab679724b62cf17a06b3e5cf043d49ffa6c200e6494515d85ef`
