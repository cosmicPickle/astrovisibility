# Optional window displacement correction

**Timestamp:** 2026-09-21 15:30 +03:00 (Europe/Sofia)

**Specification:** [Window displacement correction](../../specs/mobile/2026-09-21-0955-window-displacement-correction.md).

Implemented optional signed lens offset in optics and a constrained four-corner
window editor. Initial mask completion offers window setup or Skip. Later, the
profile menu exposes one Define/Redefine window action. Save, reset, cancel,
removal and restart preserve the original panorama and mask.

Window width supplies physical scale; perspective determines the upright opening's
height and distance. AltAz and EQ lens motion use their respective axes; active
field correction retains AltAz physical motion. Trajectories, target summaries
and instant counts share the corrected classifier. A yellow outline shows the
opening from the selected target's lens position.

The approximation assumes the phone capture reference is above the turning axis
at imaging-lens height. Interior mask obstacles and uncaptured blocking remain.
Background newly revealed beyond the reference opening is assumed clear within
captured coverage, explicitly stated in the editor. No hidden surroundings are
reconstructed. Wall thickness, additional near objects and handheld capture
errors remain limitations. Original mask bits are never overwritten.

## Verification

- Final gates passed in order: `pnpm format`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`; 106 suites and 532 tests passed.
- Geometry covers front-facing and oblique openings, scale, north wrap, linked
  corners, opposite offsets, mount modes, invalid inputs and grazing rays.
- An independent one-second ray/plane oracle verifies both window crossings
  within the 30-second transition tolerance. Summary and trajectory agree.
- Persistence tests cover migration from schema 10, zero defaults, signed
  offsets, atomic failure recovery, redefine/remove/cascade and source-mask
  preservation. Schema 11 is forward-only.
- Synthetic full-catalogue 12-hour desktop timings: absent window 1,985 ms,
  zero offset 2,294 ms, displaced 2,928 ms. Derived-mask preparation was 11 ms
  for the all-clear benchmark fixture; this is not a worst-case preparation
  measurement. Work is bounded and preparation yields between chunks.

**Visual QA passed:** Android API 36 release APK on a task-owned Pixel 8 emulator,
1080 × 2400 at density 420 and 720 × 1280 at density 320. The constrained viewport
was also exercised at font scale 1.3. Synthetic panoramas and locations only.

Verified all four handles, linked perspective adjustment, pan, real two-finger
pinch, blank-width validation, keyboard scrolling, saved width/corners, reset and
cancel preservation, removal, left/right lens offset, optional setup after actual
mask completion, Skip, later setup and saved-definition restoration after force
stop/restart. Help scrolls to all content on the constrained large-text viewport.
Selecting NGC 2336 from the calculated catalogue returned to its trajectory with
the corrected yellow opening and matching visibility intervals.
The raw route header and keyboard layout issues found during QA were corrected
before the final gate sequence and APK build. No React Native or Android runtime
errors appeared during the final flows.

Local evidence is under ignored `tmp/window-qa/`: `final-tests.log`,
`release-build.log`, `window-four-corners.png`, `window-pinched.png`,
`window-small-large-text-keyboard-scroll.png`, `window-creation-offer.png`,
`window-later-menu.png` and `window-restart.png`.

**Remaining acceptance check:** No physical Android phone is connected. Measure
cold/warm calculation latency, memory, cancellation and interaction timing on
representative hardware before claiming the 50 fps p95 / 100 ms stall targets.
This remains in `State.md`; emulator and desktop results do not replace it.

## Privacy, security and delivery

No dependencies, permissions, remote services or native interfaces were added.
Geometry inputs are finite and bounded, window JSON is versioned and limited to
4,096 characters, SQL is parameterized, and saves check active panorama/mask
ownership inside a transaction. Raster preparation is bounded to 2048² pixels;
window edge rendering uses fixed tessellation. No user images, observing locations
or window dimensions are logged or committed.

Built with the repository build/share skill after the final app changes. Staged
release APK: `tmp/artifacts/android/app-release.apk`, **413,940,211 bytes**.

SHA-256: `218d9ab707d640001a68dc431a248848034370d490898cf5bb7fbb0887258c54`.

No app inputs changed after this build. This is a local test artifact, with no
GitHub Release, tag or version change.
