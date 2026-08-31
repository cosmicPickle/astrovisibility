import { spawnSync } from 'node:child_process';

export type GitHubCliCommandResult = {
  errorCode?: string;
  errorMessage?: string;
  status: number | null;
  stdout: string;
  stderr: string;
};

type GitHubCliRunner = () => GitHubCliCommandResult;

export function createGitHubCliEnvironment(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const cliEnvironment = { ...environment };
  delete cliEnvironment.GH_TOKEN;
  delete cliEnvironment.GITHUB_TOKEN;
  return cliEnvironment;
}

function runGitHubCliTokenCommand(): GitHubCliCommandResult {
  const result = spawnSync(
    'gh',
    ['auth', 'token', '--hostname', 'github.com'],
    {
      encoding: 'utf8',
      env: createGitHubCliEnvironment(process.env),
      shell: false,
      windowsHide: true,
    },
  );

  return {
    errorCode: (result.error as NodeJS.ErrnoException | undefined)?.code,
    errorMessage: result.error?.message,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function resolvePublisherToken(
  fallbackToken: string | undefined,
  runGitHubCli: GitHubCliRunner = runGitHubCliTokenCommand,
): { token: string; source: 'github-cli' | 'environment' } {
  const cliResult = runGitHubCli();
  if (cliResult.errorCode === 'ENOENT') {
    const normalizedFallbackToken = fallbackToken?.trim();
    if (!normalizedFallbackToken) {
      throw new Error(
        'Install and authenticate GitHub CLI, or set GH_TOKEN because GitHub CLI is not available.',
      );
    }
    return { token: normalizedFallbackToken, source: 'environment' };
  }

  if (cliResult.errorCode) {
    throw new Error(
      `GitHub CLI could not be started: ${cliResult.errorMessage ?? cliResult.errorCode}`,
    );
  }
  if (cliResult.status !== 0) {
    throw new Error(
      'GitHub CLI is installed but not authenticated. Run gh auth login --web and try again.',
    );
  }

  const cliToken = cliResult.stdout.trim();
  if (!cliToken) {
    throw new Error(
      'GitHub CLI is installed but returned no credential. Run gh auth login --web and try again.',
    );
  }
  return { token: cliToken, source: 'github-cli' };
}
