# Atlas Focus, Profile Setup, and Optics Controls Verification

Timestamp: 2026-08-28 10:40 +03:00 (Europe/Sofia)

## Outcome

- Selecting a target directly in the atlas or from View All Targets performs a
  one-shot camera focus. The selected direction is centred in the screen-centred
  optics frame when a setup is active, current zoom is preserved, and subsequent
  pan gestures remain free.
- Sky View now places a telescope control beside View Options. Its menu selects
  the current optics profile and opens a 0–180-degree orientation slider. The
  orientation belongs to the live atlas view, updates on release, and is not
  stored in an imaging setup.
- New observing profiles use Current/Custom controls for location and timezone.
  Current location requests foreground permission, denial falls back to Custom,
  and selecting Current retries the request. Current coordinates remain hidden;
  Custom exposes manual latitude, longitude, and elevation fields.
- Custom timezone selection uses the bundled, searchable IANA timezone list from
  `@vvo/tzdb`. Current timezone comes from the device clock.
- Imaging setups now use compact unit-suffix fields and pixel resolution. Frame
  rotation and physical sensor-dimension inputs were removed from setup UI and
  domain ownership.
- SQLite migration 8 adds pixel-resolution columns and deterministically
  backfills existing setups from sensor dimensions and pixel size.

## Automated verification

- Test-first focused regressions were observed failing before their production
  changes and passing afterward.
- Focused implementation union: 14 suites and 92 tests passed.
- Final Sky View handoff regression:
  `pnpm --filter @astrovisibility/mobile test -- SkyViewScreen.test.tsx` — 1
  suite and 20 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 65 suites and 328 tests passed.
- `pnpm build` — catalogue validation and Android Expo export passed.
- Every task-owned source, test, specification, registry, and report file passes
  Prettier.
- The repository-wide `pnpm format` gate remains blocked by 16 unrelated,
  pre-existing files. The pnpm invocation also rewrites `pnpm-lock.yaml`; the
  lockfile was restored to canonical formatting after the final pnpm command.
- `git diff --check` passed on the final intended diff.

## Android visual and interaction QA

The fresh release APK was installed and exercised on the task-owned
`RallyPath_Pixel_8_API_36` emulator at representative 1080×2400 and constrained
720×1280 viewports. Only synthetic QA profile, location, and optics data were
used.

- Location permission appeared on first profile creation. Denial selected
  Custom and revealed empty coordinate fields; selecting Current requested
  permission again. Granting permission selected Current and hid coordinates.
- Current/Custom location and timezone controls, the searchable IANA dropdown,
  and the compact imaging setup remained readable, scrollable, and unclipped at
  both viewports.
- The eye and telescope controls remained adjacent and reachable. The telescope
  menu showed the active setup, and a 92-degree orientation visibly rotated the
  optics frame.
- A direct atlas target tap and a View All Targets selection each returned a
  selected target centred in the optics frame. A subsequent gesture moved the
  atlas without snapping back, confirming one-shot rather than locked tracking.
- The task-owned emulator and temporary QA screenshots were stopped or removed
  after inspection.

## Release artifact

- Fresh release build: passed.
- Staged APK: `tmp/artifacts/android/app-release.apk`
- Size: 184,703,175 bytes.
- SHA-256: `0B5778069FCBC7768040C4F99EC00A678C09292F45C9C38DF93FE0E579110EF0`
- The release APK installed and launched successfully.

## Dependency and security review

`@vvo/tzdb` 6.198.0 is a purpose-built offline IANA timezone dataset with no
runtime dependencies. The dependency audit did not attribute a new advisory to
it. The audit continues to report the repository's pre-existing transitive
`image-size <= 2.0.2` findings through Metro/Gluestack (one moderate and two
high); this task did not change that chain.

The implementation adds no network service, account data, telemetry, sensitive
logging, or broader Android permission. Precise location remains local and is
not included in fixtures, screenshots, logs, or committed artifacts.
