# Panorama Capture Framing Verification

**Timestamp:** 2026-08-21 00:48 +03:00 (Europe/Sofia)

## Outcome

The pose-driven capture screen now has a reachable altitude state for portrait
phone cameras, shows auditable camera-FOV provenance, and allocates more of the
capture surface to the planetarium. The stable rotation-vector heading, true
north correction, full camera basis, and vector smoothing were not changed.

The original rule required the complete footprint to fit within 20–80 degrees.
A 69-degree-tall portrait camera cannot fit inside that 60-degree band. The
corrected rule requires the complete lower footprint boundary to remain at or
above 20 degrees while the central aiming direction remains at or below 80
degrees. This keeps ground out, makes capture practical, and allows the upper
frame to include the zenith.

The lower status now displays the rounded portrait FOV and whether it comes from
Camera2 device metadata or the explicit estimate. The native calculation uses
the Android-provided physical sensor size and focal length:
`2 × atan(sensorDimension / (2 × focalLength))`.

## Automated verification

- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 52 suites and 271 tests passed.
- `pnpm build`: Android production export passed.
- Release `assembleRelease`: 710 tasks passed.

Regression coverage proves that a 55° × 69° camera aimed at 60 degrees is
accepted, that a footprint extending below 20 degrees is rejected, and that an
aim above 80 degrees is rejected. Component coverage proves the 44/56 split,
visible FOV provenance, and disabled invalid capture states.

## Visual QA

Visual QA passed on the exact release APK using the API 36 Pixel 8 emulator at
1080×2400/420 dpi and 720×1600/320 dpi. Both sizes showed an unclipped 44% camera
preview and 56% planetarium, visible FOV provenance, complete warning copy,
camera footprint, and usable Capture/Import/Review controls. The emulator's
Camera2 metadata produced a 40° × 52° portrait FOV, which was rendered with the
matching aspect and angular size. Android runtime and React Native error-only
logs were empty. The viewport was restored to 1080×2400/420 dpi and the
user-owned emulator was left running.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,963,330 bytes
- SHA-256: `9E04EEA3D1307DF61EC5683EBF3B1B6F2A4446CA2EF3E3823E1E8BEEB28649D3`

The app now exposes the same evidence on each real phone. Physical sensor/FOV
confirmation remains an owner check because the emulator cannot reproduce that
phone's lenses or held pose.

## Security and compatibility

No permission, persistence, dependency, native sensor behavior, network path,
or logging changed. Existing drafts and panorama/mask revisions remain
compatible. The only additional displayed data is non-sensitive camera FOV
provenance.
