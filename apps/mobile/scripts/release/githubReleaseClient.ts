import { createReadStream } from 'node:fs';
import { request } from 'node:https';

import type { GitHubRepository } from './androidRelease.ts';

type GitHubRelease = {
  id: number;
  tag_name: string;
  draft: boolean;
  html_url: string;
  upload_url: string;
};

type RequestResult<T> = {
  status: number;
  data: T | undefined;
};

const apiVersion = '2022-11-28';
const userAgent = 'astrovisibility-local-release-publisher';
const apiTimeoutMilliseconds = 30_000;
const uploadTimeoutMilliseconds = 20 * 60_000;

function describeApiError(status: number, responseText: string): string {
  const boundedResponse = responseText.slice(0, 2_000).trim();
  return boundedResponse
    ? `GitHub API request failed (${status}): ${boundedResponse}`
    : `GitHub API request failed (${status}).`;
}

export class GitHubReleaseClient {
  readonly #repositoryPath: string;
  readonly #token: string;

  constructor(repository: GitHubRepository, token: string) {
    this.#repositoryPath = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    this.#token = token;
  }

  async assertCommitExists(commitSha: string): Promise<void> {
    await this.#requestJson(`${this.#repositoryPath}/commits/${commitSha}`);
  }

  async assertReleaseTagAvailable(tag: string): Promise<void> {
    const encodedTag = encodeURIComponent(tag);
    const tagResult = await this.#requestJson(
      `${this.#repositoryPath}/git/ref/tags/${encodedTag}`,
      { allowedStatuses: [404] },
    );
    if (tagResult.status !== 404) {
      throw new Error(`Git tag ${tag} already exists; releases are immutable.`);
    }

    const releasesResult = await this.#requestJson<GitHubRelease[]>(
      `${this.#repositoryPath}/releases?per_page=100`,
    );
    const existingRelease = releasesResult.data?.find(
      (release) => release.tag_name === tag,
    );
    if (existingRelease) {
      const state = existingRelease.draft ? 'draft release' : 'release';
      throw new Error(
        `A ${state} already exists for ${tag}: ${existingRelease.html_url}`,
      );
    }
  }

  async createDraftRelease(input: {
    tag: string;
    commitSha: string;
    prerelease: boolean;
  }): Promise<GitHubRelease> {
    const result = await this.#requestJson<GitHubRelease>(
      `${this.#repositoryPath}/releases`,
      {
        method: 'POST',
        body: {
          tag_name: input.tag,
          target_commitish: input.commitSha,
          name: `Astrovisibility ${input.tag}`,
          draft: true,
          prerelease: input.prerelease,
          generate_release_notes: true,
        },
      },
    );
    if (
      !result.data ||
      !Number.isSafeInteger(result.data.id) ||
      typeof result.data.upload_url !== 'string'
    ) {
      throw new Error('GitHub returned an invalid draft release response.');
    }
    return result.data;
  }

  async uploadAsset(input: {
    uploadUrl: string;
    filePath: string;
    fileSize: number;
    assetName: string;
    contentType: string;
  }): Promise<void> {
    const uploadUrl = new URL(input.uploadUrl.replace(/\{.*$/, ''));
    if (
      uploadUrl.protocol !== 'https:' ||
      uploadUrl.hostname !== 'uploads.github.com'
    ) {
      throw new Error('GitHub returned an invalid release asset upload URL.');
    }
    uploadUrl.searchParams.set('name', input.assetName);

    await new Promise<void>((resolve, reject) => {
      const uploadRequest = request(
        uploadUrl,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.#token}`,
            'Content-Length': input.fileSize,
            'Content-Type': input.contentType,
            'User-Agent': userAgent,
            'X-GitHub-Api-Version': apiVersion,
          },
        },
        (response) => {
          let responseText = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            if (responseText.length < 2_000) responseText += chunk;
          });
          response.on('end', () => {
            const status = response.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              resolve();
            } else {
              reject(new Error(describeApiError(status, responseText)));
            }
          });
        },
      );
      uploadRequest.on('error', reject);
      uploadRequest.setTimeout(uploadTimeoutMilliseconds, () => {
        uploadRequest.destroy(
          new Error('GitHub release asset upload timed out.'),
        );
      });

      const assetStream = createReadStream(input.filePath);
      assetStream.on('error', reject);
      assetStream.pipe(uploadRequest);
    });
  }

  async publishRelease(
    releaseId: number,
    prerelease: boolean,
  ): Promise<GitHubRelease> {
    const result = await this.#requestJson<GitHubRelease>(
      `${this.#repositoryPath}/releases/${releaseId}`,
      {
        method: 'PATCH',
        body: {
          draft: false,
          prerelease,
          make_latest: prerelease ? 'false' : 'true',
        },
      },
    );
    if (!result.data?.html_url) {
      throw new Error('GitHub returned an invalid published release response.');
    }
    return result.data;
  }

  async #requestJson<T = unknown>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH';
      body?: Record<string, unknown>;
      allowedStatuses?: number[];
    } = {},
  ): Promise<RequestResult<T>> {
    const response = await fetch(`https://api.github.com${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-GitHub-Api-Version': apiVersion,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(apiTimeoutMilliseconds),
    });
    const responseText = await response.text();
    if (
      !response.ok &&
      !(options.allowedStatuses ?? []).includes(response.status)
    ) {
      throw new Error(describeApiError(response.status, responseText));
    }

    return {
      status: response.status,
      data: responseText ? (JSON.parse(responseText) as T) : undefined,
    };
  }
}
