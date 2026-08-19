---
name: build-share-android-app
description: Build and stage the Astrovisibility Android release APK for sharing. Use whenever the user asks to build, emit, produce, generate, share, or send the Astrovisibility mobile app or APK, even when they say only "the app."
---

# Build and Share Android App

Run the bundled script from the repository root:

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
