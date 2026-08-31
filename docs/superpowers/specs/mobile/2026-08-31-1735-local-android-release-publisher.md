# Local Android Release Publisher

**Timestamp:** 2026-08-31 17:35 +03:00 (Europe/Sofia)

## Purpose

Let a maintainer build and publish an Astrovisibility Android APK at any time
with one root pnpm command. The binary remains outside Git and is attached to a
versioned GitHub Release.

## Scope

- Add `pnpm release:android` at the repository root.
- Derive the tag from the committed mobile version and verify that the package,
  Expo, and native Gradle version names agree.
- Refuse a release from dirty tracked source, an unpushed commit, an existing
  tag/release, or without an authenticated GitHub token.
- Run format, typecheck, lint, tests, and application build before the native
  APK build.
- Reuse the repository's established Android build/share script so the exact
  fresh APK is staged at `tmp/artifacts/android/app-release.apk`.
- Create a draft GitHub Release for the exact current commit, upload the APK and
  a SHA-256 checksum, and publish only after both uploads succeed.
- Support an optional `--prerelease` flag.
- Document authentication, version preparation, invocation, output, failure
  behavior, and the signing limitation of the current local build.

## Non-goals

- A GitHub Actions workflow or automatic publishing on push.
- Google Play publishing, Play App Signing, AAB generation, or store metadata.
- Committing an APK, token, keystore, password, or generated release file.
- Changing the existing Android signing configuration or local APK build path.
- Automatically editing, committing, or pushing application version files.

## Command Contract

Normal release:

```powershell
pnpm release:android
```

Prerelease:

```powershell
pnpm release:android -- --prerelease
```

The command reads the version from `apps/mobile/package.json` and confirms it
matches `apps/mobile/app.config.ts` and
`apps/mobile/android/app/build.gradle`. It also confirms the Expo and native
Android version codes match and are positive integers. The release tag and APK
asset name are `v<version>` and `astrovisibility-v<version>.apk`.

The current Git remote must identify a GitHub repository. `GH_TOKEN` must contain
a fine-grained personal access token with Contents read/write permission for
that repository. The token is sent only in GitHub API authorization headers and
is never printed or persisted by the script.

## Publication Safety

Before building, the command verifies:

- no tracked file is modified, staged, or deleted;
- the current commit exists in the configured GitHub repository;
- no release or tag already uses the derived version;
- the version metadata is internally consistent.

After the quality gates and fresh APK build pass, the command creates a draft
release targeting the exact current commit. It streams the APK and checksum to
GitHub without loading the APK into memory. Only after both assets exist does it
publish the release. If an upload or publication fails, it leaves the draft for
manual inspection instead of deleting or silently replacing remote data.

## Signing Boundary

This command deliberately reuses the current local release variant exactly as
required by the Android build/share workflow. It is debug-signed and suitable
for direct testing/distribution, not Google Play. Updating an installed copy
requires subsequent APKs to use the same local ignored debug keystore. Moving
to a durable production signing key is a separate, explicitly approved change;
no keystore or signing secret belongs in Git.

## Acceptance Criteria

- A root pnpm command performs validation, gates, fresh native build, checksum,
  release creation, asset upload, and final publication.
- The published release targets the exact pushed source commit.
- The repository tag, release title, APK filename, checksum filename, and
  committed app version agree.
- A failed validation/build creates no remote release; a failed upload leaves
  only a draft release and explains where to inspect it.
- No new runtime or development dependency is introduced.
- Tokens and generated binaries stay out of Git and logs.
- Existing local APK building behavior remains unchanged.

## Verification

- Add focused tests for arguments, GitHub remote parsing, version consistency,
  checksum formatting, and release asset naming before implementation.
- Exercise safe failure modes locally without a token and with test fixtures;
  do not create a real release without the maintainer choosing a version and
  authorizing publication.
- Run format, typecheck, lint, tests, build, `git diff --check`, and final diff
  review.
- Commit and push the publisher to `main`.
