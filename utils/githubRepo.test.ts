import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchRepoFiles,
  RepoTooLargeError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubNetworkError,
} from './githubRepo';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function base64Of(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

describe('fetchRepoFiles', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the default branch, fetches the recursive tree, and downloads only blobs as base64', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/hello-world') {
        return Promise.resolve(jsonResponse({ default_branch: 'main' }));
      }
      if (url === 'https://api.github.com/repos/octocat/hello-world/git/trees/main?recursive=1') {
        return Promise.resolve(
          jsonResponse({
            truncated: false,
            tree: [
              { path: 'src', type: 'tree', sha: 'dir-sha' },
              { path: 'src/index.ts', type: 'blob', sha: 'blob-1' },
              { path: 'package.json', type: 'blob', sha: 'blob-2' },
            ],
          }),
        );
      }
      if (url === 'https://api.github.com/repos/octocat/hello-world/git/blobs/blob-1') {
        return Promise.resolve(
          jsonResponse({ content: base64Of('console.log(1)'), encoding: 'base64' }),
        );
      }
      if (url === 'https://api.github.com/repos/octocat/hello-world/git/blobs/blob-2') {
        return Promise.resolve(jsonResponse({ content: base64Of('{}'), encoding: 'base64' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const files = await fetchRepoFiles('octocat', 'hello-world');
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

    expect(Object.keys(byPath).sort()).toEqual(['package.json', 'src/index.ts']);
    expect(byPath['src/index.ts']).toBe(base64Of('console.log(1)'));
    expect(byPath['package.json']).toBe(base64Of('{}'));
  });

  it('throws RepoTooLargeError when GitHub reports a truncated tree', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/huge-repo') {
        return Promise.resolve(jsonResponse({ default_branch: 'main' }));
      }
      if (url === 'https://api.github.com/repos/octocat/huge-repo/git/trees/main?recursive=1') {
        return Promise.resolve(jsonResponse({ truncated: true, tree: [] }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(fetchRepoFiles('octocat', 'huge-repo')).rejects.toThrow(RepoTooLargeError);
  });

  it('caps concurrent blob requests instead of firing them all at once', async () => {
    const FILE_COUNT = 20;
    const MAX_ALLOWED_CONCURRENCY = 6;
    let inFlight = 0;
    let maxInFlight = 0;

    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/many-files') {
        return Promise.resolve(jsonResponse({ default_branch: 'main' }));
      }
      if (url === 'https://api.github.com/repos/octocat/many-files/git/trees/main?recursive=1') {
        return Promise.resolve(
          jsonResponse({
            truncated: false,
            tree: Array.from({ length: FILE_COUNT }, (_, i) => ({
              path: `file-${i}.txt`,
              type: 'blob',
              sha: `blob-${i}`,
            })),
          }),
        );
      }
      const blobMatch = /\/git\/blobs\/blob-(\d+)$/.exec(url);
      if (blobMatch) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve(
              jsonResponse({ content: base64Of(`content-${blobMatch[1]}`), encoding: 'base64' }),
            );
          }, 5);
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const files = await fetchRepoFiles('octocat', 'many-files');

    expect(files).toHaveLength(FILE_COUNT);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(MAX_ALLOWED_CONCURRENCY);
  });

  it('throws GitHubNotFoundError with a friendly message on a 404', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/missing') {
        return Promise.resolve(jsonResponse({ message: 'Not Found' }, 404));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(fetchRepoFiles('octocat', 'missing')).rejects.toThrow(GitHubNotFoundError);
    await expect(fetchRepoFiles('octocat', 'missing')).rejects.toThrow(/private/);
  });

  it('throws GitHubRateLimitError when the primary rate limit is exhausted', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 120;
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/rate-limited') {
        return Promise.resolve(
          jsonResponse({ message: 'API rate limit exceeded' }, 403, {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetAt),
          }),
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(fetchRepoFiles('octocat', 'rate-limited')).rejects.toThrow(GitHubRateLimitError);
    await expect(fetchRepoFiles('octocat', 'rate-limited')).rejects.toThrow(/rate limit/);
  });

  it('does not treat a bare 403 (no rate-limit header) as a rate limit', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/blocked') {
        return Promise.resolve(jsonResponse({ message: 'Blocked' }, 403));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let caught: unknown;
    try {
      await fetchRepoFiles('octocat', 'blocked');
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeInstanceOf(GitHubRateLimitError);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/403/);
  });

  it('throws GitHubNetworkError when fetch itself fails (e.g. offline)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(fetchRepoFiles('octocat', 'hello-world')).rejects.toThrow(GitHubNetworkError);
    await expect(fetchRepoFiles('octocat', 'hello-world')).rejects.toThrow(/Network error/);
  });
});
