# Panorama Capture Footprint Geometry Verification

**Timestamp:** 2026-08-20 22:40 +03:00 (Europe/Sofia)

## Outcome

Panorama capture now uses one 62° × 46.5° angular footprint for the live blue
guide and newly accepted green camera/import tiles. The unfolded guide uses
equal horizontal and vertical angular scale, reverses Android/Expo roll for
SVG's downward Y axis, and reserves enough padding to display the complete
rotated footprint beyond the horizon or zenith without changing its shape.

The valid 20°–80° capture band is evaluated against the rotated footprint's
lowest and highest edges. Out-of-range guidance names the whole camera frame,
turns the live footprint and reticle red, and disables camera capture while
leaving import available. Heading, altitude, and roll use stronger deadbands
and low-pass smoothing with 50 ms motion sampling.

## Verification

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: 52 suites and 271 tests passed
- `pnpm build`: catalogue check and Android production export passed
- Native `assembleRelease`: 669 tasks, fresh release APK emitted
- API 36 Pixel 8 emulator release QA at 1080 × 2400 / 420 dpi and constrained
  720 × 1600 / 320 dpi: full horizon-edge footprint, equal-scale grid,
  out-of-range state, scroll/layout, and permission recovery passed
- Recent `AndroidRuntime` and `ReactNativeJS` error logs were empty

Artifact: `tmp/artifacts/android/app-release.apk`, 184,940,794 bytes, SHA-256
`9CB64F452276BDD619BF0E1427EF5EA84AE7D808D9B0CCA6D95056451B27B4E3`.

## Residual physical-device check

The emulator cannot reproduce a phone being tilted and rotated in the hand.
Automated tests cover roll sign, circular/axial smoothing, edge geometry, and
live/saved FOV identity; the owner must confirm tactile stability and physical
tilt direction on the shared APK.

No dependency, permission, schema, migration, network, or logging surface was
added.
