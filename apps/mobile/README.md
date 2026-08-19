# Astrovisibility Mobile

Android-first Expo application for the Astrovisibility local prototype.

## Prerequisites

- Node.js 24.16 or newer
- pnpm 11.19
- Android Studio with an SDK/JDK compatible with Expo SDK 57 for native builds
- Ninja available at `C:\ninja\ninja.exe` for Windows native builds. The
  checked-in Gradle configuration uses this short path and raises CMake's object
  path limit to avoid pnpm-backed React Native paths repeatedly regenerating
  `build.ninja`.

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For a fresh checkout on Windows, ensure `C:\Android` (or your configured Android
SDK), JDK 17, and `C:\ninja\ninja.exe` are available before native generation.
Then run `pnpm android:prebuild` once. Do not run bare `expo prebuild`: the root
command reapplies the Rallypath-derived CMake settings required by React Native
Worklets on long pnpm paths.

The first app launch creates `astrovisibility.db`, applies the forward migration
runner, imports the pinned catalogue when its version or SHA-256 changes, clears
interrupted staging files, and removes only durable panorama files that are not
referenced by SQLite. A failed import or migration shows a retryable local-data
screen and does not upload or erase user records.

## Offline catalogue

The bundled OpenNGC `v20260501` transform contains 13,371 physical target
records, all 109 Caldwell memberships, and Messier designations 1–110. OpenNGC
models M102 as an alias of M101, so those 110 designations occupy 109 physical
records. The app's **About · licences** screen shows source, version, attribution,
and output checksum.

Regenerate and verify the catalogue with:

```powershell
pnpm --filter @astrovisibility/mobile catalogue:generate
pnpm --filter @astrovisibility/mobile catalogue:check
```

See `scripts/catalogue/README.md` before changing a source snapshot. Never edit
generated catalogue files directly.

## Local schema and file lifecycle

Schema version 1 owns profiles, equipment and per-profile selections, panorama
revisions/tiles, immutable mask revisions/operations, settings, and catalogue
version metadata. Forward migration 2 adds restart-safe panorama capture drafts
and their ordered camera/import tiles. `PRAGMA user_version` advances only inside
an immediate transaction. After a distributed build or real user data exists,
always add a new forward migration rather than editing migration history.

SQLite stores only app-relative image paths. Expo FileSystem owns images beneath
the app document directory at `astrovisibility/profiles/...`; camera or picker
temporary URIs are never persisted. Each accepted camera/import tile is promoted
to an app-local draft path before its row is exposed. Completion copies the
complete draft into immutable panorama paths, activates the revision in one
SQLite transaction, and then removes draft copies. A copy or transaction failure
removes incomplete final files while retaining the reopenable draft. Restart
reconciliation cleans unreferenced leftovers without deleting referenced drafts
or completed captures.

During development, uninstall the app or clear its Android app data to reset all
local records and app-private files. There is no server-side copy or recovery in
v1.

The in-app **About and licences** screen provides the safer normal reset:
**Delete all local data** requires a second confirmation and removes profiles,
equipment, panorama/mask revisions, drafts, and owned images while leaving the
bundled catalogue installed. If Android refuses an image deletion after the
database commit, the app reports the remainder and retries orphan cleanup on the
next foreground/startup maintenance pass.

Generate or synchronize the local Android project with:

```powershell
pnpm android:prebuild
```

The prebuild script reapplies the checked-in Rallypath-derived CMake/Ninja
arguments after Expo regenerates `android`; do not call bare `expo prebuild` and
then build on Windows.

The panorama flow asks for camera, foreground location, and motion access only
after the user opens capture and accepts the in-app explanation. Camera denial
leaves photo import/manual placement available; location or sensor weakness
leaves explicit manual azimuth, altitude, and roll correction available. It does
not request background location or upload captures. A full 360-degree capture is
never required.

Accepted capture assets are limited to 40 megapixels, 12,000 pixels on either
edge, 32 MB per source file, and 200 tiles per draft. These limits bound image
decoding, storage exhaustion, and malformed-import work. A failed copy leaves the
durable draft reopenable. On restart or foreground return, missing draft images
are removed from the draft and a completed panorama with a missing source image
is detached without deleting its observing profile or the offline catalogue.

## Android testing and release

Install a debug build for iterative work:

```powershell
pnpm --filter @astrovisibility/mobile android:dev
```

With the app installed and an emulator/device online, run the deterministic
Maestro flows:

```powershell
pnpm test:e2e:android
```

The flows cover profile/equipment creation, offline catalogue ranking,
list-to-sky navigation, process restart, privacy copy, and confirmed local-data
deletion. Camera capture, heading stability, upward placement, and physical
gesture performance still require the documented manual physical-device pass;
an emulator cannot provide that evidence.

Generate the distributable local release APK only through the repository build
skill/workflow:

```powershell
node .codex/skills/build-share-android-app/scripts/build-share-android-app.mjs
```

The fresh Gradle output is validated and staged at
`tmp/artifacts/android/app-release.apk`. It is locally distributable rather than
Play-Store signed; no keystore or signing secret belongs in this repository.

## Troubleshooting

- **`build.ninja still dirty after 100 tries` or long CMake paths:** confirm
  `C:\ninja\ninja.exe` exists, run `pnpm android:prebuild`, and rebuild. Compare
  `apps/mobile/android/build.gradle` with the generated Rallypath-derived CMake
  arguments; do not remove them during prebuild.
- **Camera or location no longer appears after returning from Settings:** return
  the app to the foreground. Permissions are re-read then. Image import and
  manual placement remain available when access stays denied.
- **Capture reports storage/size failure:** free device storage or use a smaller
  image, then reopen the retained draft. Do not clear app data unless you intend
  to delete all local work.
- **A panorama image was removed or corrupted outside the app:** restart or
  background/foreground the app. Startup maintenance detaches an incomplete
  panorama and removes missing draft-tile references instead of presenting
  obstruction results from broken data.
- **No network:** the app does not require one for setup, sky browsing,
  trajectories, masks, or target ranking. The two attribution links naturally
  require connectivity, but the full source/version/licence summary is bundled.
- **Local-data preparation fails:** use **Try again**. The failure screen does not
  erase profiles or captures. Preserve app data and inspect local device storage
  before uninstalling.

## Known prototype limits

- V1 is Android-first and uses target-centre obstruction classification; it does
  not test the entire camera frame against branches or roofs.
- Phone magnetometers can be disturbed by buildings and telescope hardware.
  Every tile therefore supports manual azimuth, altitude, and roll correction.
- Camera field of view is an initial estimate and may vary by device.
- Extremely thin nearby obstructions may exceed the current 0.05-degree mask
  precision.
- The current release has emulator and automated evidence. Real camera/sensor,
  two-finger gesture, and 50-fps p95 measurements on a documented mid-range
  physical Android device remain required before wider distribution.
