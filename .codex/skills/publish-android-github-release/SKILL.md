---
name: publish-android-github-release
description: Publish a new Astrovisibility Android release to GitHub. Use when the user asks to publish, cut, ship, upload, or create a new GitHub release; do not use for merely building, staging, sharing, or sending a local APK.
---

# Publish Android GitHub Release

Publish from the Astrovisibility repository root on `main`.

## Version the release

1. Inspect the latest GitHub release, the current version metadata, and the changes since that release.
2. Choose the smallest appropriate semantic-version bump when the change scope makes it clear: patch for compatible fixes or internal/documentation work, minor for compatible user-facing functionality, and major for incompatible behavior. Ask the user when the intended bump is genuinely ambiguous.
3. Keep the version identical in `apps/mobile/package.json`, `apps/mobile/app.config.ts`, and `apps/mobile/android/app/build.gradle`. Increase both Android version codes together to a positive integer greater than the previous release.
4. Preserve unrelated work. If tracked changes outside the release are present and their inclusion is unclear, ask before proceeding.
5. Run the required repository checks for the metadata change, commit it, and push `main`. The publisher requires clean tracked files and an exact commit already present on GitHub.

## Publish

Run:

```bash
pnpm release:android
```

Use `pnpm release:android -- --prerelease` only when the user requested a prerelease. The command runs the quality gates, builds a fresh release APK, publishes the APK and checksum, and prints the release URL. Do not replace this with the local build/share skill.

If publication fails after creating a draft, report the draft URL and resolve that state before retrying. Never overwrite an existing tag or publish the same version twice.

## Update the release index

After publication succeeds:

1. Read the current GitHub releases rather than guessing URLs.
2. Update the root `README.md` **Releases** list newest first, with the newly published release at the top.
3. Keep at most five entries and link each entry to its GitHub release page.
4. Run the documentation-only validation required by the repository, commit the README update, and push `main`.

If the release succeeded but the README update fails, do not republish. Complete and push the README update separately.
