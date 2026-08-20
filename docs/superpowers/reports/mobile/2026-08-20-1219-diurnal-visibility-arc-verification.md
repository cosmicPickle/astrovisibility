# Diurnal Visibility Arc Verification

**Timestamp:** 2026-08-20 12:19 +03:00
**Branch:** `codex/fix-visibility-arcs`

## Outcome

Selected deep-sky objects now render on one continuous, time-evaluated sidereal
orbit. The full orbit is a neutral dashed context line; the exact selected
observing-window portion is drawn over it with the existing 30-minute markers
and visible/blocked/unassessed obstruction semantics.

The production scene and the default observing window now use the same instant.
During an active night that instant is the current time. Outside an active night
it is the start of the upcoming observing window. This removes the prior failure
where daytime catalogue positions were displayed with an arc calculated for the
following night on another part of the sphere.

Selection, asynchronous trajectory arrival, and deselection do not write camera
state. Selecting a target directly from the atlas therefore adds the orbit in
place without recentering the sky. The existing target-list handoff remains the
separate explicit workflow that positions a returned result for inspection.

## Geometry and obstruction behavior

- A full mean sidereal revolution is evaluated at one-minute intervals, producing
  1,438 bounded samples including the closing endpoint.
- Real IC 1396 and Iris Nebula fixtures retain the expected small-circle geometry
  around the north celestial pole through the astronomy adapter and equatorial
  camera projection.
- The first and last samples close within 0.02 degrees after one sidereal
  revolution.
- Below-horizon gaps now terminate their rendered group. Disjoint above-horizon
  intervals cannot be joined by a false chord across the sphere.
- The neutral full orbit makes no obstruction claim. The observing-window overlay
  retains the established no-mask unassessed state and completed-mask
  visible/blocked classification, markers, transition labels, and repeated
  crossings.
- Panorama and mask storage, coordinates, projection, opacity, and persistence are
  unchanged. They continue to use the shared horizontal-to-equatorial projector.

The display model follows the full path plus highlighted relevant interval seen
in Stellarium's object-visibility presentation, while preserving
Astrovisibility's local-obstruction semantics.

## Verification

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 50 suites and 233 tests passed
- `pnpm build`: catalogue byte check and Android production export passed
- native release emission: Gradle `assembleRelease` passed, 669 tasks

The exact emitted release was installed on the API 36 Pixel 8 emulator. At
1080x2400 / 420 dpi and 720x1600 / 320 dpi, direct atlas selection of Veil Nebula
and Hercules Globular Cluster produced a registered circular diurnal track with
the six-hour-forty-eight-minute night segment overlaid and labelled every 30
minutes. The selected target lay on the first window sample. The neutral orbit
continued beyond both window endpoints. The selected card and controls remained
usable without clipping at the constrained viewport.

Deselecting a target produced byte-identical screenshots at 250 ms and 2.25 s,
confirming there was no delayed camera correction. Logcat contained no fatal
exception, ANR, or React Native error match. The agent-owned emulator was restored
and stopped after QA.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Bytes: 184,915,674
- SHA-256: `94FFB2F2DD74FBCBF33861F5BDE808FB65DA65F1ABA3BF0C558D78CBD75612D1`

The artifact remains only in Astrovisibility's standard local staging path. It
was not copied to Rallypath.

## Security and performance review

No dependency, permission, persistence, remote-data, or sensitive logging change
was introduced. UTC input is validated and orbit work is capped by the fixed
sidereal duration and one-minute sampling interval. Existing classification work
remains asynchronous, cancellable, cached, and camera-independent.

## Residual limitation

No physical Android device was attached. True touch frame pacing and physical
device rendering remain device checks; deterministic gesture/camera tests and the
exact release-emulator pass cover this correction.
