# Stage 9 Release Verification

**Recorded:** 2026-08-19 19:46 +03:00 (Europe/Sofia)

## Outcome

Astrovisibility's Stage 0-9 Android prototype implementation is complete for the
available automated and emulator environment. The release APK builds, installs,
launches, persists local data, works offline, and exposes the required privacy,
licence, recovery, and data-deletion behavior.

No physical Android device was attached. Physical camera/orientation behavior
and the specified mid-range-device frame budget therefore remain distribution
prerequisites, not claimed passes. The product owner previously accepted
emulator evidence for sequence progression; this report retains the exact
limitation rather than converting emulator evidence into physical-device
evidence.

## Rallypath reuse

Rallypath was consulted before hardening. Astrovisibility reused its established
Maestro flow layout and root/mobile runner split, debug-versus-release workflow,
Android setup/troubleshooting documentation structure, and the previously
ported Windows CMake/Ninja configuration. Rallypath's Android history also
confirmed the existing Worklets long-path fix. No Rallypath server, account,
telemetry, or cloud behavior was introduced.

## Hardening delivered

- Startup and foreground maintenance now reconcile missing owned panorama and
  capture-draft files without deleting otherwise valid profiles or catalogue
  data. Interrupted/orphaned owned files remain bounded to app-private paths.
- Global data deletion transactionally removes profiles, equipment, settings,
  panoramas, masks, and capture drafts, reports image-cleanup failures, and
  preserves the bundled catalogue.
- The active capture route rechecks camera and location permissions after
  foregrounding. Revocation provides import/manual/settings recovery instead of
  dead-ending the user.
- Captures reject non-positive or non-integer dimensions, edges above 12,000
  pixels, images above 40 megapixels, source files above 32 MB, and sessions
  above the existing 200-tile limit.
- About and licences now explains local/offline privacy, catalogue licences,
  prototype limitations, and confirmation-gated deletion in user-facing text.
- Fresh-checkout, Android prerequisites, schema/recovery, offline operation,
  reset, permissions, storage, corrupt-file, CMake, Maestro, and release-build
  troubleshooting are documented in `apps/mobile/README.md`.

## Automated verification

The final root sequence passed in order:

| Gate                             | Result                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| `pnpm format`                    | Pass                                                                   |
| `pnpm typecheck`                 | Pass                                                                   |
| `pnpm lint`                      | Pass                                                                   |
| `pnpm test`                      | Pass: 42 suites, 192 tests                                             |
| `pnpm build`                     | Pass: catalogue validation plus Expo Android production export         |
| `pnpm install --frozen-lockfile` | Pass: lockfile current and supply-chain policy check passed            |
| `gradlew clean`                  | Pass after removing only the stale app `.cxx` cache                    |
| `gradlew assembleRelease`        | Pass from clean native outputs: 612 tasks, 532 executed, 80 up-to-date |
| Android emission workflow        | Pass                                                                   |
| `git diff --check`               | Pass; line-ending notices only                                         |

Tests cover migration from representative earlier data, SQLite restart,
background maintenance, corrupt/missing durable files, simulated low storage,
atomic deletion and cleanup failure, permission revocation, capture bounds,
offline-only catalogue behavior, geometry, target ranking, and the complete
mask path over all 13,371 production targets.

Two deterministic Maestro flows were added for profile/setup/sky/target-list
restart and privacy deletion. `pnpm test:e2e:android` could not execute because
the `maestro` CLI is not installed on this Windows host; the exact failure is
`'maestro' is not recognized as an internal or external command`. The same
release critical paths were exercised through ADB on the emulator as described
below.

## Performance

The full production-catalogue completed-mask diagnostic initially took 9.93
seconds. Summary ranking now samples at a bounded 15-minute interval while
selected-target detail remains at 5 minutes and every mask crossing is still
adaptively refined to 30 seconds/0.05 degrees. Exact segment-edge proximity and
a global altitude rejection remove conservative geometry false positives. The
new regression gate completes in less than the five-second release budget; the
full benchmark suite, which also includes no-mask and first-result diagnostics,
completed in approximately 7.18 seconds.

Android release `gfxinfo` after a dense Sky View interaction reported 263 frames,
30.42% janky frames, p50 23 ms, p90 48 ms, p95 69 ms, and p99 133 ms on the API
36 headless emulator. This diagnostic is not representative mid-range hardware
and does not satisfy the physical-device target of at least 50 fps at p95 with
no interaction stall above 100 ms. Prior Stage 3 focused emulator work measured
p95 18 ms after moving pan/zoom transforms to the UI thread. A documented
mid-range physical-device run remains required before wider distribution.

## Release emulator QA

The freshly emitted release APK installed successfully on `emulator-5554`, an
API 36 `sdk_gphone64_x86_64` Pixel-class emulator. The emulator was already
running and was not stopped. App-specific synthetic QA data was cleared before
the run. After QA, synthetic app data was cleared again; the original
1080x2400/420 dpi, font scale 1.0, and automatic-rotation settings were restored.
The release APK remains installed for inspection.

| Scenario                           | Evidence                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Release cold launch                | Pass; measured Android activity starts ranged from 326 to 757 ms                                                        |
| Profile create and restart         | Pass; manual coordinates persisted across force-stop/cold start                                                         |
| Background/foreground              | Pass; foreground maintenance restored the populated dashboard                                                           |
| Low-memory substitute              | Pass; background trim plus process kill reconstructed persisted state                                                   |
| Offline cold start                 | Pass with Wi-Fi and mobile data disabled; bundled catalogue remained usable                                             |
| Rotation                           | Pass; the declared portrait route remained coherent when device rotation was forced                                     |
| Permission revocation              | Pass on release relaunch; capture-route recovery is additionally covered by component tests                             |
| Corrupt file and low storage       | Pass in deterministic storage tests; no safe emulator mechanism exists to corrupt app-private release files directly    |
| Privacy/licences                   | Pass at top and bottom of the rendered route                                                                            |
| Delete all local data              | Pass; confirmation, completion message, and empty-state recovery observed                                               |
| Critical path                      | Pass: create profile, open full-sky map, rank 13,371 targets, select Andromeda, return to positioned trajectory/details |
| Representative viewport            | Pass at 1080x2400, 420 dpi, font scale 1.0                                                                              |
| Constrained/accessibility viewport | Pass at 720x1600, 320 dpi, font scale 1.3; no clipping or unusable control observed                                     |
| Release logs                       | Pass; no app fatal exception, ANR, unhandled React Native error, or invariant violation found                           |

Android UI hierarchy exposed meaningful field/control descriptions and all
reviewed destructive actions remained explicit. TalkBack was not installed on
the emulator, so screen-reader traversal remains a physical/accessibility-device
follow-up; enlarged text and automation semantics were reviewed instead.

## Security, privacy, and dependency disposition

The repository contains no tracked real coordinates, panoramas, local databases,
environment files, release signing material, or device identifiers. Android's
generated debug keystore is ignored, as are `.jks`, `.keystore`, local databases,
captures, environment files, and `tmp/`. The staged APK is confirmed ignored by
Git.

`pnpm audit --prod` reports three transitive findings:

- two high-severity infinite-loop advisories in `image-size@1.2.1`, reached
  through Metro 0.84.4 in the Expo/React Native build pipeline;
- one moderate bounds-check advisory in `uuid@7.0.3`, reached through Expo
  config plugins' Xcode project parser.

`pnpm why` confirms these paths are build/prebuild tooling and are not invoked by
the Android application at runtime. No incompatible major-version override was
adopted. Reassess when the compatible Expo/Metro toolchain publishes a fix;
avoid processing untrusted build inputs in the interim.

## Release artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Package: `com.cosmicpickle.astrovisibility`
- Version: `0.0.1` (`versionCode` 1)
- Minimum SDK: 24
- Target/compile SDK: 36
- Size: 141,232,813 bytes
- Modified UTC: 2026-08-19T16:35:30.0974492Z
- SHA-256: `2F50607EF9DDFB8BB2BDC31D75DC5F87D282D030054E4440221658756AED0C4E`

The artifact is locally distributable and uses the repository emission
workflow. It is not represented as a production-store signed binary.

## Residual release limitations

- No physical Android device was attached, so real camera capture, magnetic
  heading/orientation stability, upward/partial panorama usability, permission
  behavior on vendor hardware, and the documented mid-range performance budget
  remain unverified.
- Maestro flows are committed but were not executed because the CLI is absent.
- The final build was produced from clean native outputs with a frozen lockfile,
  but not from a literal fresh clone because the coordinating workflow has not
  yet committed the Stage 0-9 implementation. Re-run the documented clean-clone
  workflow after that commit.
- The prototype evaluates target centres rather than the full imaging frame and
  does not control telescope hardware; both are stated in the app.

These are distribution-validation limitations, not hidden app behavior. The
available Stage 0-9 implementation and emulator verification are complete. All
Gradle daemons started by the release workflow were stopped, temporary QA
screenshots/dumps/logs were removed, the final APK was preserved, and the
pre-existing emulator was left running.
