# Android Launcher Icon Verification

Timestamp: 2026-08-29 01:24 +03:00 (Europe/Sofia)

## Outcome

The approved Astrovisibility concept is installed as a layered Android launcher
icon:

- a separate navy background color;
- a transparent generated foreground with a 12 dp adaptive-icon inset;
- round and regular adaptive definitions for Android 8+;
- a purpose-built monochrome vector for Android 13 themed icons;
- branded regular and round fallbacks for Android 7;
- obsolete density-specific Expo launcher placeholders removed.

The foreground bitmap was generated with the built-in ImageGen tool. Prompt
summary: a minimal, high-contrast Android launcher mark with a blue sky dome,
dark local-horizon silhouettes, and a white curved observing trajectory ending
at a four-point star; no text and transparent outer space. The accepted output
is stored at
`apps/mobile/android/app/src/main/res/drawable-nodpi/astrovisibility_launcher_foreground.png`.

## Automated verification

- Test-first regression: `scripts/androidLauncherIcon.test.ts` failed while the
  legacy Expo WebPs were still present, then passed after the layered resources
  and fallbacks were complete.
- TypeScript typecheck: passed.
- ESLint: passed.
- Jest: 67 suites and 341 tests passed.
- Catalogue check: current at
  `6362ff2a15a002a591e559f5d400a73e759860ab86898119879e91316731153a`.
- Android Expo export: passed.
- Gradle `assembleRelease`: passed, including Android resource processing and
  release lint.
- `git diff --check`: passed.

The repository-wide Prettier check still reports the same 16 unrelated,
pre-existing files. The new TypeScript test is formatted.

## Device visual verification

The release APK was installed on the Pixel 8 API 36 emulator. The icon was
inspected on the launcher at 1080 x 2400 and at a constrained 720 x 1280
viewport. It remains recognizable, centered, unclipped, and readable under the
launcher's round adaptive mask. The final rebuilt APK was installed again after
the obsolete fallback resources were removed and the result remained correct.

## Release artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 185,261,713 bytes
- Built: 2026-08-29 01:24:16 +03:00
- SHA-256: `213D8379142C03DA0711C649632A5686DF887282D938CACA614ADD2072C72851`

## Risk review

This change adds no dependency, permission, persistence, network, or sensitive
data surface. Android launcher resources are bounded local files. The existing
manifest continues to reference `@mipmap/ic_launcher` and
`@mipmap/ic_launcher_round`.
