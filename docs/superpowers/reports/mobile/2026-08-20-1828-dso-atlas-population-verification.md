# DSO Atlas Population and Suitability Verification

**Verified:** 2026-08-20 18:28 +03:00 (Europe/Sofia)

## Outcome

The production Sky View now owns one bounded, spatially indexed DSO population
that remains resident ahead of the live Skia camera. Markers no longer wait for
gesture release to enter the React tree, and label collision membership is
settled separately from marker membership. A label is revealed on the UI thread
only after its full bounds enter the canvas.

The obsolete synthetic proof renderer and its exclusive viewport/navigation
helpers were removed. The accepted planetarium camera, projection, horizon,
trajectory, panorama, mask, selection, and FOV overlay behavior were not
replaced by this change.

Known-size DSOs below two screen pixels across their minor axis are omitted from
the browsing atlas at the current zoom. Targets with unknown size remain
browsable and a selected target always remains resident. Equipment suitability
now requires at least 60 sensor pixels across the target's minor axis while
preserving the existing 90% maximum frame-fit rule. The Dwarf 3 / Blinking
Planetary Nebula regression is approximately 9.16 pixels and is rejected.

## Automated verification

- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass, 51 suites and 258 tests.
- `pnpm build`: pass, including the Expo Android production bundle.
- Native `:app:assembleRelease`: pass.
- Android emission workflow: pass, 669 actionable tasks (67 executed, 602
  up-to-date).
- Production catalogue fixture: 13,371 indexed objects; index plus resident
  selection approximately 128-131 ms on the local desktop runner, with the
  resident set bounded to 480 objects.
- Regression coverage includes long horizontal sweep and immediate reversal,
  dense-bin spatial fairness, pre-entry overscan, marker/label separation,
  full-label entry, zoom-size culling, selected-target retention, exact
  60-pixel suitability boundary, unknown-size handling, and 90% frame fit.

## Release visual verification

The release APK was installed on the existing API 36 Pixel 8 emulator. At both
1080x2400/420 dpi and 720x1600/320 dpi, repeated long east/west drags and
immediate reversals kept DSO markers and labels registered to the grid without
empty sectors, release-time population turnover, or clipped entering labels.
The constrained viewport remained readable and unclipped. Display geometry was
restored to 1080x2400/420 dpi afterward, and the user-owned emulator was left
running.

The constrained-emulator stress sample rendered 199 frames with p50 21 ms, p95
32 ms, and p99 44 ms. This is emulator diagnostic evidence, not a physical
device performance claim. A steady-state post-restoration atlas sweep produced
no fatal exception, ANR, React Native error, Skia error, or
`updateAndRelease` message. The emulator emitted React Native Skia's explicit
safe-to-ignore surface-release message only while its display size/density was
being changed for QA.

## Artifact and review

- APK: `tmp/artifacts/android/app-release.apk`
- Size: 184,935,762 bytes
- SHA-256: `20BA3ED62758BB4EC79E4A973F9942E5ECA3498909A795391ACA94CFD2A212A7`
- No dependency, permission, persistence schema, network, or sensitive logging
  change was introduced.
- No precise location, panorama, mask, database, signing material, or attachment
  was added to source control.

Physical two-finger zoom and performance on a real mid-range device remain
device-only verification; zoom membership and size thresholds are covered by
deterministic tests.
