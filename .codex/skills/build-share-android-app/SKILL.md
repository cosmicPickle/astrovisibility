---
name: build-share-android-app
description: Build, stage, and share the Astrovisibility Android release APK for local testing. Required before handing off any task that changes the shipped app unless the user explicitly waives the APK. Also use whenever the user asks to build, emit, produce, generate, share, or send the app or APK, even when they say only "the app." This does not publish a GitHub Release.
---

# Build and Share Android App

## Required handoff

After changes to app code, assets, dependencies, native configuration, or build
behavior, deliver a current local release APK unless the user explicitly waives
it. This standing requirement authorizes the build and sharing without another
confirmation. Documentation, test-only, and agent-instruction changes do not
independently trigger an APK build.

This workflow produces a local release-variant APK for testing. Do not create a
GitHub Release, tag, version bump, or publication without a separate request.

## Build or reuse

For a fresh build, run the bundled script from the repository root:

```powershell
node .codex/skills/build-share-android-app/scripts/build-share-android-app.mjs
```

The workflow uses:

- Gradle project: `apps/mobile/android`
- Gradle output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Final staged artifact: `tmp/artifacts/android/app-release.apk`

The script must:

1. Verify that the native Android Gradle project and wrapper exist.
2. Build a fresh release APK with Gradle `assembleRelease`.
3. Refuse to stage anything if the build fails or the new Gradle output is
   missing.
4. Clear `tmp/artifacts/android` only after the fresh build output is confirmed.
5. Move the release APK to `tmp/artifacts/android/app-release.apk`.
6. Print the final absolute path, byte size, and modification timestamp.

If a successful release APK already matches the final validated app inputs, it
may be reused unless the user explicitly requests a fresh build. Verify the
successful build record and that no app inputs changed afterward; timestamps
alone do not establish provenance. If this cannot be established, run the build
script. Copy a verified Gradle output to the final staged path, replacing only
the APK, and confirm the source and staged SHA-256 hashes match. If the verified
APK is already staged, share it directly.

Check the final staged file exists and report its absolute path and size. Include
a clickable link to `tmp/artifacts/android/app-release.apk` in the final response.
An APK used for QA or left in Gradle output is not a completed handoff.

## Expectations

- Treat an unqualified Astrovisibility app build/share request as a request for
  this staged Android release APK.
- Do not substitute a debug APK, Expo export, development build, or Gradle
  intermediate path unless the user explicitly requests it.
- Use committed build configuration. Do not edit `.env`, signing configuration,
  application identifiers, or release settings unless the user explicitly asks
  for that separate change.
- Keep generated APK files out of Git. The artifact directory is local and
  shareable, not source-controlled.
- If the app has not yet been scaffolded, report the missing
  `apps/mobile/android` path rather than inventing a build layout.
- If signing or Gradle fails, report the exact failing task/error and do not
  stage an older artifact.

After a successful build, the install command is:

```powershell
adb install -r C:\Web\astrovisibility\tmp\artifacts\android\app-release.apk
```

If Android refuses to update an incompatible existing installation, first read
the application ID from the native project. Never guess it. Then provide the
corresponding `adb uninstall <application-id>` command followed by the install
command above.
