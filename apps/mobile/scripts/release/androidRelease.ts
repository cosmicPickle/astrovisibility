export type AndroidVersionMetadata = {
  packageVersion: string;
  expoVersion: string;
  expoVersionCode: number;
  nativeVersion: string;
  nativeVersionCode: number;
};

export type GitHubRepository = {
  owner: string;
  repository: string;
};

const semanticVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

export function parseReleaseArguments(arguments_: string[]): {
  prerelease: boolean;
} {
  let prerelease = false;

  for (const argument of arguments_) {
    if (argument === '--') continue;
    if (argument === '--prerelease') {
      prerelease = true;
      continue;
    }
    throw new Error(`Unknown release argument: ${argument}`);
  }

  return { prerelease };
}

export function parseGitHubRepository(remoteUrl: string): GitHubRepository {
  const trimmedRemoteUrl = remoteUrl.trim();
  const scpMatch = trimmedRemoteUrl.match(
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i,
  );
  if (scpMatch) {
    return { owner: scpMatch[1], repository: scpMatch[2] };
  }

  try {
    const parsedUrl = new URL(trimmedRemoteUrl);
    const pathParts = parsedUrl.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/');
    if (
      parsedUrl.hostname.toLowerCase() === 'github.com' &&
      pathParts.length === 2 &&
      pathParts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
    ) {
      return { owner: pathParts[0], repository: pathParts[1] };
    }
  } catch {
    // The common Git SSH shorthand is handled before URL parsing.
  }

  throw new Error('Origin must identify a GitHub repository.');
}

export function validateVersionMetadata(metadata: AndroidVersionMetadata): {
  version: string;
  versionCode: number;
  tag: string;
} {
  if (!semanticVersionPattern.test(metadata.packageVersion)) {
    throw new Error('Mobile version must use semantic versioning.');
  }

  const versionNames = new Set([
    metadata.packageVersion,
    metadata.expoVersion,
    metadata.nativeVersion,
  ]);
  const versionCodes = new Set([
    metadata.expoVersionCode,
    metadata.nativeVersionCode,
  ]);
  if (versionNames.size !== 1 || versionCodes.size !== 1) {
    throw new Error(
      'Mobile version metadata does not agree across package.json, app.config.ts, and Android build.gradle.',
    );
  }

  if (
    !Number.isSafeInteger(metadata.expoVersionCode) ||
    metadata.expoVersionCode <= 0
  ) {
    throw new Error('Android versionCode must be a positive integer.');
  }

  return {
    version: metadata.packageVersion,
    versionCode: metadata.expoVersionCode,
    tag: `v${metadata.packageVersion}`,
  };
}

export function createReleaseAssetNames(tag: string): {
  apk: string;
  checksum: string;
} {
  const apk = `astrovisibility-${tag}.apk`;
  return { apk, checksum: `${apk}.sha256` };
}

export function formatSha256Checksum(
  sha256: string,
  assetName: string,
): string {
  return `${sha256}  ${assetName}\n`;
}
