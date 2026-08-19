---
name: astrovisibility-visual-qa
description: Visually inspect Astrovisibility UI and interactions on a real browser surface or mobile emulator/device. Use for rendered UI review, responsive checks, screenshots, sky-map interaction checks, panorama/mask editing review, or release visual QA.
---

# Astrovisibility Visual QA

Visual QA means inspecting the rendered app on the actual supported surface, not
only reading code, snapshot output, or test assertions.

## Prepare

1. Read `AGENTS.md`, the affected product spec, and relevant package scripts.
2. Determine the implemented target from repository evidence. Do not assume Expo,
   Android, iOS, ports, package names, routes, credentials, or build paths merely
   because those technologies are pre-approved.
3. Reuse a healthy user-owned development environment. If starting services or
   emulators, record what the agent owns and restore prior state afterward.
4. Use representative synthetic astronomy data. Never expose real home
   panoramas or precise private observing coordinates in screenshots or logs.

## Native Mobile Workflow

When a native app exists:

1. Use the repository's documented start/build workflow and the smallest rebuild
   needed for the changed layer.
2. Reuse an online emulator/device when safe. Resolve `adb` and the emulator from
   `PATH` or documented local locations; do not hard-code a package identifier.
3. Verify the bundle/runtime and any required local service are reachable from
   the emulator/device before diagnosing UI symptoms as application bugs.
4. Launch the app through its configured package/activity or development client.
5. Capture screenshots and, on Android, UI hierarchy when useful:

   ```powershell
   & $adbPath shell screencap -p /sdcard/astrovisibility.png
   & $adbPath pull /sdcard/astrovisibility.png tmp/astrovisibility.png
   & $adbPath shell uiautomator dump /sdcard/window.xml
   & $adbPath pull /sdcard/window.xml tmp/window.xml
   ```

6. Inspect at least one representative phone and one small/constrained phone
   viewport for meaningful UI work. Add iOS, landscape, tablet, or accessibility
   text-size passes when supported or at risk.
7. Rebuild native binaries when native code/configuration changed or the installed
   app is incompatible. JavaScript-only changes should normally reuse a compatible
   development build.

## Browser Workflow

When a web surface exists:

1. Ensure the documented local URL is reachable.
2. Use `browser:control-in-app-browser` when available and follow that skill.
3. Inspect the affected route at desktop and narrow/mobile viewports when layout
   risk exists.
4. If the in-app browser is unavailable, use an installed Playwright/Chrome path
   only when repository tooling supports it; report an exact blocker rather than
   claiming review from source alone.

## Astrovisibility Scenarios

Select the scenarios relevant to the change:

- dashboard with zero, one, and several profiles/configurations;
- profile with no panorama/mask;
- completed partial mask where uncaptured directions are blocked;
- narrow capture, wide capture, upward/zenith capture, and irregular gaps or
  branch-like obstructions;
- panning/zooming at target-density thresholds;
- a selected target with zero, one, and multiple visible intervals;
- trajectory transitions and 30-minute labels near screen/arc boundaries;
- panorama and mask independently off/on and at low/high opacity;
- no telescope configuration, first default configuration, and configuration
  switching with field-of-view frame changes;
- target list ordering, suitability filtering, multiple intervals, common names,
  Back navigation, and return-to-selected-target behavior;
- permission denied/revoked, loading, empty, error, interruption, and restart
  recovery states for capture/edit flows;
- keyboard, safe area, system bars, touch targets, gestures, dynamic type, and
  screen-reader labels where applicable.

Check visual correctness and interaction behavior together. For sky rendering,
also look for label collisions, flicker, stale overlay alignment, gesture
conflicts, dropped frames, and target selection at different zoom levels.

## Finish

Fix material issues, rerun relevant automated checks, and repeat inspection.
Clean up temporary screenshots containing sensitive data and restore processes,
emulator configuration, port forwarding, and development mode to their prior
state.

Report exactly one outcome:

- `Visual QA passed`, with platform/device or viewport, flows, and states checked.
- `Visual QA blocked`, with the exact missing surface, command, or runtime error.

Report automated checks separately; they do not replace visual QA.
