import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..', '..', '..', '..');
const androidDirectory = join(repoRoot, 'apps', 'mobile', 'android');
const gradleWrapper = join(androidDirectory, 'gradlew.bat');
const artifactDirectory = join(repoRoot, 'tmp', 'artifacts', 'android');
const releaseApk = join(
  androidDirectory,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
const stagedApk = join(artifactDirectory, 'app-release.apk');

if (!existsSync(androidDirectory)) {
  throw new Error(
    `Android project directory was not found at ${androidDirectory}.`,
  );
}

if (!existsSync(gradleWrapper)) {
  throw new Error(`Gradle wrapper was not found at ${gradleWrapper}.`);
}

const build = spawnSync('.\\gradlew.bat', ['assembleRelease'], {
  cwd: androidDirectory,
  stdio: 'inherit',
  shell: true,
});

if (build.error) {
  throw build.error;
}

if (build.status !== 0) {
  throw new Error(
    `Gradle assembleRelease failed with exit code ${build.status}.`,
  );
}

if (!existsSync(releaseApk)) {
  throw new Error(`Fresh release APK was not found at ${releaseApk}.`);
}

rmSync(artifactDirectory, { force: true, recursive: true });
mkdirSync(artifactDirectory, { recursive: true });
renameSync(releaseApk, stagedApk);

const stagedStats = statSync(stagedApk);
console.log(
  JSON.stringify(
    {
      fullName: stagedApk,
      length: stagedStats.size,
      lastWriteTime: stagedStats.mtime.toISOString(),
    },
    null,
    2,
  ),
);
