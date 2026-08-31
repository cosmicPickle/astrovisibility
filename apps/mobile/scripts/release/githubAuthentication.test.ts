/** @jest-environment node */

import {
  createGitHubCliEnvironment,
  resolvePublisherToken,
} from './githubAuthentication';

describe('GitHub release authentication', () => {
  it('uses the GitHub CLI credential ahead of GH_TOKEN', () => {
    expect(
      resolvePublisherToken('environment-token', () => ({
        status: 0,
        stdout: 'cli-token\n',
        stderr: '',
      })),
    ).toEqual({ token: 'cli-token', source: 'github-cli' });
  });

  it('removes token overrides from the GitHub CLI subprocess', () => {
    expect(
      createGitHubCliEnvironment({
        GH_TOKEN: 'environment-token',
        GITHUB_TOKEN: 'actions-token',
        NODE_ENV: 'test',
        PATH: 'example-path',
      }),
    ).toEqual({ NODE_ENV: 'test', PATH: 'example-path' });
  });

  it('uses GH_TOKEN only when the GitHub CLI executable is unavailable', () => {
    expect(
      resolvePublisherToken('environment-token', () => ({
        errorCode: 'ENOENT',
        status: null,
        stdout: '',
        stderr: '',
      })),
    ).toEqual({ token: 'environment-token', source: 'environment' });
  });

  it('does not fall back when GitHub CLI is installed but unauthenticated', () => {
    expect(() =>
      resolvePublisherToken('environment-token', () => ({
        status: 1,
        stdout: '',
        stderr: 'not logged in',
      })),
    ).toThrow('GitHub CLI is installed but not authenticated');
  });

  it('explains both authentication options when neither is available', () => {
    expect(() =>
      resolvePublisherToken(undefined, () => ({
        errorCode: 'ENOENT',
        status: null,
        stdout: '',
        stderr: '',
      })),
    ).toThrow('Install and authenticate GitHub CLI, or set GH_TOKEN');
  });
});
