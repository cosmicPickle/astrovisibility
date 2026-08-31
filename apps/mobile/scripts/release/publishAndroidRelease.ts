import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  androidReleaseGateNames,
  createPnpmInvocation,
  createReleaseAssetNames,
  formatSha256Checksum,
  parseGitHubRepository,
  parseReleaseArguments,
  validateVersionMetadata,
  type AndroidVersionMetadata,
} from './androidRelease.ts';
import { resolvePublisherToken } from './githubAuthentication.ts';
import { GitHubReleaseClient } from './githubReleaseClient.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..', '..');
const mobileDirectory = join(repositoryRoot, 'apps', 'mobile');
const stagedApkPath = join(
  repositoryRoot,
  'tmp',
  'artifacts',
  'android',
  'app-release.apk',
);
const buildShareScript = join(
  repositoryRoot,
  '.codex',
  'skills',
  'build-share-android-app',
  'scripts',
  'build-share-android-app.mjs',
);
const maximumReleaseAssetBytes = 2 * 1024 * 1024 * 1024;

function runCapture(command: string, arguments_: string[]): string {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(
      `${command} ${arguments_.join(' ')} failed${detail ? `: ${detail}` : '.'}`,
    );
  }
  return result.stdout.trim();
}

function runVisible(command: string, arguments_: string[]): void {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${arguments_.join(' ')} failed with exit code ${result.status}.`,
    );
  }
}

function readMatchedValue(
  source: string,
  pattern: RegExp,
  description: string,
): string {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not read ${description}.`);
  return match[1];
}

function readVersionMetadata(): AndroidVersionMetadata {
  const packageJson = JSON.parse(
    readFileSync(join(mobileDirectory, 'package.json'), 'utf8'),
  ) as { version?: unknown };
  if (typeof packageJson.version !== 'string') {
    throw new Error('Could not read the mobile package version.');
  }

  const appConfig = readFileSync(
    join(mobileDirectory, 'app.config.ts'),
    'utf8',
  );
  const nativeBuild = readFileSync(
    join(mobileDirectory, 'android', 'app', 'build.gradle'),
    'utf8',
  );

  return {
    packageVersion: packageJson.version,
    expoVersion: readMatchedValue(
      appConfig,
      /^\s*version:\s*'([^']+)'/m,
      'Expo version',
    ),
    expoVersionCode: Number(
      readMatchedValue(
        appConfig,
        /^\s*versionCode:\s*(\d+)/m,
        'Expo Android versionCode',
      ),
    ),
    nativeVersion: readMatchedValue(
      nativeBuild,
      /^\s*versionName\s+"([^"]+)"/m,
      'native Android versionName',
    ),
    nativeVersionCode: Number(
      readMatchedValue(
        nativeBuild,
        /^\s*versionCode\s+(\d+)/m,
        'native Android versionCode',
      ),
    ),
  };
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function publishAndroidRelease(): Promise<void> {
  const { prerelease } = parseReleaseArguments(process.argv.slice(2));
  const releaseVersion = validateVersionMetadata(readVersionMetadata());
  const authentication = resolvePublisherToken(process.env.GH_TOKEN);

  const trackedChanges = runCapture('git', [
    'status',
    '--porcelain',
    '--untracked-files=no',
  ]);
  if (trackedChanges) {
    throw new Error(
      'Tracked files are not clean. Commit and push the exact release source first.',
    );
  }

  const repository = parseGitHubRepository(
    runCapture('git', ['remote', 'get-url', 'origin']),
  );
  const commitSha = runCapture('git', ['rev-parse', 'HEAD']);
  const client = new GitHubReleaseClient(repository, authentication.token);
  await client.assertCommitExists(commitSha);
  await client.assertReleaseTagAvailable(releaseVersion.tag);

  for (const gate of androidReleaseGateNames) {
    const invocation = createPnpmInvocation(gate);
    runVisible(invocation.command, invocation.arguments);
  }
  runVisible(process.execPath, [buildShareScript]);

  const apkStats = statSync(stagedApkPath);
  if (
    !apkStats.isFile() ||
    apkStats.size <= 0 ||
    apkStats.size > maximumReleaseAssetBytes
  ) {
    throw new Error(`The staged release APK is invalid: ${stagedApkPath}`);
  }

  const assetNames = createReleaseAssetNames(releaseVersion.tag);
  const apkSha256 = await calculateSha256(stagedApkPath);
  const checksumPath = join(dirname(stagedApkPath), assetNames.checksum);
  writeFileSync(
    checksumPath,
    formatSha256Checksum(apkSha256, assetNames.apk),
    'utf8',
  );
  const checksumStats = statSync(checksumPath);

  let draftUrl: string | undefined;
  try {
    const draft = await client.createDraftRelease({
      tag: releaseVersion.tag,
      commitSha,
      prerelease,
    });
    draftUrl = draft.html_url;
    await client.uploadAsset({
      uploadUrl: draft.upload_url,
      filePath: stagedApkPath,
      fileSize: apkStats.size,
      assetName: assetNames.apk,
      contentType: 'application/vnd.android.package-archive',
    });
    await client.uploadAsset({
      uploadUrl: draft.upload_url,
      filePath: checksumPath,
      fileSize: checksumStats.size,
      assetName: assetNames.checksum,
      contentType: 'text/plain; charset=utf-8',
    });
    const publishedRelease = await client.publishRelease(draft.id, prerelease);
    console.log(`Published ${publishedRelease.html_url}`);
    console.log(`${assetNames.apk} SHA-256 ${apkSha256}`);
  } catch (error) {
    if (draftUrl) {
      console.error(
        `Publication stopped after draft creation. Inspect the draft at ${draftUrl}.`,
      );
    }
    throw error;
  }
}

publishAndroidRelease().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
