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

## Background rendering

The Milky Way and saved panorama/raster mask use Skia runtime shaders with six
padded cube faces packed into a 2D texture. The celestial cube stays in J2000;
small orientation uniforms register it to the current observing instant. Local
panorama/mask cubes stay in east/up/north. Panning and zooming update the camera
basis without regenerating background vertices or cube images.

Preparation is serialized and cancelled when its source is replaced. The exact
source projection renders while preparation is pending or if allocation fails.
Mixed mask pixels sample the original raster to preserve thin boundaries. The
binary mask used by visibility calculations and all saved images are unchanged.
The current mask color/panorama modes and opacity continue to govern rendering.

Verify the actual Skia shaders, synthetic mask boundaries and celestial
registration from the repository root, using the CanvasKit already bundled with
React Native Skia:

```powershell
node apps/mobile/scripts/sky-assets/checkCubeRendering.mjs
```

An optional output-directory argument writes synthetic comparison PNGs. Jest
also checks coordinate transforms and image lifecycle. Android device testing
remains necessary: CanvasKit cannot exercise native graphics-context transfer
or establish phone performance. Cube caches add texture memory, so this branch
does not claim a speed improvement without physical-device measurements.

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

### Automatic panorama stitching

After capture, choose **Create panorama**. OpenCV aligns overlapping photos,
corrects exposure and blends seams locally, then shows one directional panorama
for review. **Use panorama** saves it and opens mask drawing. Partial views and
upward views through the zenith are supported. When photos cannot be connected
by visual matching, their measured placement is retained and the preview warns
about those joins. **Adjust manually** opens the existing fallback controls.
Back cancels processing and keeps the draft; save failure keeps the preview for
retry. Reopening an interrupted draft starts stitching again. Saved panoramas
and masks are not changed by this upgrade.

The local Expo module in `modules/astrovisibility-panorama` autolinks from
Expo's standard `modules` directory. It uses OpenCV 4.13.0's Maven AAR plus the
official Android SDK's static stitching library. The first native build needs
internet access for the SDK's 318 MB ZIP; Gradle verifies its published SHA-256
and caches it under `caches/astrovisibility` in the Gradle user home. Subsequent
builds reuse that dependency. If checksum validation fails, remove only that
cached ZIP and retry. The app itself needs no internet for stitching.

NDK 27.1.12297006 and CMake 3.22.1 are required. All existing Android ABIs remain
supported. Upstream licences are bundled and available offline under **About ·
licences → Open panorama licences**. Cache images are removed after completion
or cancellation, and abandoned jobs older than a day are cleared on the next
stitch. **Delete all local data** also clears the stitching cache.

Native input/EXIF checks run with
`gradlew :astrovisibility-panorama:connectedDebugAndroidTest` from `android`.
The CMake `panorama_tests` target tests directional registration, zenith,
single/black photos, unmatched 200-photo input, cancellation and binary output.
It is excluded from the shipped library target; run the executable on Android
with the three generated fixtures from `scripts/panorama-proof/synthetic_capture.py`.
Physical-device capture quality and timing depend on overlap, texture, nearby
parallax, sensor accuracy, and hardware. Inspect the preview before mask drawing.

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

### Publish a GitHub APK release locally

The preferred authentication path is the official GitHub CLI. Install and log in
once:

```powershell
winget install --id GitHub.cli --source winget
# Open a new terminal after installation.
gh auth login --web
```

The CLI stores its credential in the Windows credential store. Every subsequent
normal release is one command from the repository root:

```powershell
pnpm release:android
```

For a prerelease:

```powershell
pnpm release:android -- --prerelease
```

The publisher always prefers the GitHub CLI credential. It falls back to
`GH_TOKEN` only when the `gh` executable is not installed. If `gh` is installed
but logged out, run `gh auth login --web`; the publisher deliberately does not
switch to a different environment credential. On a machine without GitHub CLI,
prepare a fine-grained token limited to this repository with **Contents: Read and
write**, then expose it only to the publishing shell:

```powershell
$secureToken = Read-Host 'GitHub token' -AsSecureString
$env:GH_TOKEN = [System.Net.NetworkCredential]::new('', $secureToken).Password
pnpm release:android
Remove-Item Env:GH_TOKEN
$secureToken.Dispose()
```

Before running, update and commit the same semantic version in
`apps/mobile/package.json`, `apps/mobile/app.config.ts`, and
`apps/mobile/android/app/build.gradle`; the Expo and native Android version
codes must also match and increase for an upgrade. Push that commit first. The
publisher refuses dirty tracked files, an unpushed commit, inconsistent version
metadata, or an existing `v<version>` tag/release. It runs every repository gate,
builds a fresh APK through the staging workflow above, then publishes
`astrovisibility-v<version>.apk` and its SHA-256 checksum to a GitHub Release for
the exact current commit.

The remote release is created as a draft and becomes public only after both
assets upload. If publication stops after draft creation, the command prints the
draft URL for inspection; it never deletes or overwrites a release. The current
APK is debug-signed, so retain the same ignored local debug keystore if future
APK files must upgrade an existing installation. Production or Play signing is
a separate release-engineering change.

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
