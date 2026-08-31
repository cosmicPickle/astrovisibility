/** @jest-environment node */

import {
  createPnpmInvocation,
  createReleaseAssetNames,
  formatSha256Checksum,
  parseGitHubRepository,
  parseReleaseArguments,
  validateVersionMetadata,
} from './androidRelease';

describe('Android release publisher', () => {
  it('runs pnpm through the Windows command interpreter', () => {
    expect(
      createPnpmInvocation('test', 'win32', 'C:\\Windows\\System32\\cmd.exe'),
    ).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      arguments: ['/d', '/s', '/c', 'pnpm.cmd', 'test'],
    });
    expect(createPnpmInvocation('test', 'linux')).toEqual({
      command: 'pnpm',
      arguments: ['test'],
    });
  });

  it('accepts the optional prerelease flag and rejects unknown arguments', () => {
    expect(parseReleaseArguments([])).toEqual({ prerelease: false });
    expect(parseReleaseArguments(['--', '--prerelease'])).toEqual({
      prerelease: true,
    });
    expect(() => parseReleaseArguments(['--latest'])).toThrow(
      'Unknown release argument: --latest',
    );
  });

  it.each([
    ['https://github.com/cosmicPickle/astrovisibility.git'],
    ['git@github.com:cosmicPickle/astrovisibility.git'],
    ['ssh://git@github.com/cosmicPickle/astrovisibility.git'],
  ])('extracts the GitHub repository from %s', (remoteUrl) => {
    expect(parseGitHubRepository(remoteUrl)).toEqual({
      owner: 'cosmicPickle',
      repository: 'astrovisibility',
    });
  });

  it('rejects a non-GitHub or malformed remote', () => {
    expect(() =>
      parseGitHubRepository('https://example.com/owner/repository.git'),
    ).toThrow('Origin must identify a GitHub repository.');
  });

  it('requires package, Expo, and native versions to agree', () => {
    expect(
      validateVersionMetadata({
        packageVersion: '0.0.2-beta.1',
        expoVersion: '0.0.2-beta.1',
        expoVersionCode: 2,
        nativeVersion: '0.0.2-beta.1',
        nativeVersionCode: 2,
      }),
    ).toEqual({
      version: '0.0.2-beta.1',
      versionCode: 2,
      tag: 'v0.0.2-beta.1',
    });

    expect(() =>
      validateVersionMetadata({
        packageVersion: '0.0.2',
        expoVersion: '0.0.2',
        expoVersionCode: 2,
        nativeVersion: '0.0.1',
        nativeVersionCode: 1,
      }),
    ).toThrow('Mobile version metadata does not agree');
  });

  it('rejects unsupported versions and Android version codes', () => {
    expect(() =>
      validateVersionMetadata({
        packageVersion: 'next',
        expoVersion: 'next',
        expoVersionCode: 0,
        nativeVersion: 'next',
        nativeVersionCode: 0,
      }),
    ).toThrow('Mobile version must use semantic versioning');
  });

  it('creates deterministic APK and checksum asset names', () => {
    expect(createReleaseAssetNames('v0.0.2')).toEqual({
      apk: 'astrovisibility-v0.0.2.apk',
      checksum: 'astrovisibility-v0.0.2.apk.sha256',
    });
    expect(formatSha256Checksum('abc123', 'astrovisibility-v0.0.2.apk')).toBe(
      'abc123  astrovisibility-v0.0.2.apk\n',
    );
  });
});
