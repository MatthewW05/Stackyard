import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRepoFiles, GitHubFetchError } from './githubRepo';
import { sendBridgeRequest } from './bridge';

vi.mock('./bridge', () => ({ sendBridgeRequest: vi.fn() }));

const sendBridgeRequestMock = vi.mocked(sendBridgeRequest);

function base64Of(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

describe('fetchRepoFiles', () => {
  beforeEach(() => {
    sendBridgeRequestMock.mockReset();
  });

  it('requests github:fetch-repo over the bridge with owner/repo/token', async () => {
    sendBridgeRequestMock.mockResolvedValue([]);

    await fetchRepoFiles('octocat', 'hello-world', 'a-token');

    expect(sendBridgeRequestMock).toHaveBeenCalledWith(
      'github:fetch-repo',
      { owner: 'octocat', repo: 'hello-world', token: 'a-token' },
      expect.any(Number),
    );
  });

  it('decodes the relayed base64 content back into bytes', async () => {
    sendBridgeRequestMock.mockResolvedValue([
      { path: 'src/index.ts', content: base64Of('console.log(1)') },
      { path: 'package.json', content: base64Of('{}') },
    ]);

    const files = await fetchRepoFiles('octocat', 'hello-world');
    const byPath = Object.fromEntries(
      files.map((f) => [f.path, new TextDecoder().decode(f.contents)]),
    );

    expect(Object.keys(byPath).sort()).toEqual(['package.json', 'src/index.ts']);
    expect(byPath['src/index.ts']).toBe('console.log(1)');
    expect(byPath['package.json']).toBe('{}');
  });

  it('wraps a named GitHub relay error in GitHubFetchError, keeping its message', async () => {
    const relayError = new Error(
      "GitHub couldn't find /repos/octocat/missing — double check the owner/repo spelling",
    );
    relayError.name = 'GitHubNotFoundError';
    sendBridgeRequestMock.mockRejectedValue(relayError);

    await expect(fetchRepoFiles('octocat', 'missing')).rejects.toThrow(GitHubFetchError);
    await expect(fetchRepoFiles('octocat', 'missing')).rejects.toThrow(/couldn't find/);
  });

  it('does not wrap an unnamed bridge error (e.g. a timeout)', async () => {
    const timeoutError = new Error(
      'Bridge request "github:fetch-repo" timed out after 60000ms — is the Stackyard extension installed?',
    );
    sendBridgeRequestMock.mockRejectedValue(timeoutError);

    let caught: unknown;
    try {
      await fetchRepoFiles('octocat', 'hello-world');
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeInstanceOf(GitHubFetchError);
    expect(caught).toBe(timeoutError);
  });
});
