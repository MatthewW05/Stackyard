import type { RepoFile } from './fileSystemTree';

const GITHUB_API = 'https://api.github.com';

export class RepoTooLargeError extends Error {
  constructor(owner: string, repo: string) {
    super(
      `${owner}/${repo} is too large to preview: GitHub truncated the file tree ` +
        "(repos over ~100,000 files or a 7MB tree aren't supported yet).",
    );
    this.name = 'RepoTooLargeError';
  }
}

export class GitHubNotFoundError extends Error {
  constructor(path: string) {
    super(
      `GitHub couldn't find ${path} — double check the owner/repo spelling, or the repo may be ` +
        'private (private repos need sign-in, which is not supported yet).',
    );
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubRateLimitError extends Error {
  constructor(resetHeader: string | null) {
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : null;
    const when =
      resetAt && !Number.isNaN(resetAt.getTime())
        ? ` It resets at ${resetAt.toLocaleTimeString()}.`
        : ' Try again in a few minutes.';
    super(`GitHub API rate limit exceeded (60 requests/hour when not signed in).${when}`);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubNetworkError extends Error {
  constructor(cause: unknown) {
    super(
      'Network error while contacting GitHub — check your internet connection and try again.' +
        ` (${cause instanceof Error ? cause.message : String(cause)})`,
    );
    this.name = 'GitHubNetworkError';
  }
}

interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

async function githubFetch(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, { headers });
  } catch (cause) {
    throw new GitHubNetworkError(cause);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubNotFoundError(path);
    }
    // GitHub signals the primary rate limit via a 403/429 with this header
    // set to 0 - a bare 403 can also mean something unrelated (e.g. access
    // blocked), so only treat it as a rate limit when the header confirms it.
    if (
      (response.status === 403 || response.status === 429) &&
      response.headers.get('x-ratelimit-remaining') === '0'
    ) {
      throw new GitHubRateLimitError(response.headers.get('x-ratelimit-reset'));
    }
    throw new Error(`GitHub API request failed (${response.status}): ${path}`);
  }
  return response;
}

async function getDefaultBranch(owner: string, repo: string, token?: string): Promise<string> {
  const response = await githubFetch(`/repos/${owner}/${repo}`, token);
  const data = (await response.json()) as { default_branch: string };
  return data.default_branch;
}

async function getTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<GitHubTreeResponse> {
  const response = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  );
  return (await response.json()) as GitHubTreeResponse;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getBlobContents(
  owner: string,
  repo: string,
  sha: string,
  token?: string,
): Promise<Uint8Array> {
  const response = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, token);
  const data = (await response.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected blob encoding "${data.encoding}" for blob ${sha}`);
  }
  return base64ToBytes(data.content);
}

// GitHub's unauthenticated API applies a secondary "abuse detection" rate
// limit to bursts of concurrent requests, independent of the 60/hr quota -
// firing one request per file via Promise.all gets 403s on real repos with
// more than a handful of files. Capping concurrency avoids tripping it.
const BLOB_FETCH_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetches every file in a public GitHub repo's default branch and returns
 * them as a flat list ready for `buildFileSystemTree`. Throws
 * `RepoTooLargeError` if GitHub truncates the tree response.
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  token?: string,
): Promise<RepoFile[]> {
  const branch = await getDefaultBranch(owner, repo, token);
  const { tree, truncated } = await getTree(owner, repo, branch, token);
  if (truncated) {
    throw new RepoTooLargeError(owner, repo);
  }

  const blobEntries = tree.filter((entry) => entry.type === 'blob');
  const contents = await mapWithConcurrency(blobEntries, BLOB_FETCH_CONCURRENCY, (entry) =>
    getBlobContents(owner, repo, entry.sha, token),
  );

  return blobEntries.map((entry, i) => ({ path: entry.path, contents: contents[i] }));
}
