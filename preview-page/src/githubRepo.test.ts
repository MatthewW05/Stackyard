import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRepoFiles, RepoTooLargeError } from './githubRepo';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
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

  it('resolves the default branch, fetches the recursive tree, and downloads only blobs', async () => {
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
    const byPath = Object.fromEntries(
      files.map((f) => [f.path, new TextDecoder().decode(f.contents)]),
    );

    expect(Object.keys(byPath).sort()).toEqual(['package.json', 'src/index.ts']);
    expect(byPath['src/index.ts']).toBe('console.log(1)');
    expect(byPath['package.json']).toBe('{}');
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

  it('throws a clear error when a GitHub request fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://api.github.com/repos/octocat/missing') {
        return Promise.resolve(jsonResponse({ message: 'Not Found' }, 404));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(fetchRepoFiles('octocat', 'missing')).rejects.toThrow(/404/);
  });
});
