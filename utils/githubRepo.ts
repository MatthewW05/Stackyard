import { getCachedRepo, setCachedRepo, isFresh } from './githubCache';
import { recordRateLimit } from './githubRateLimit';

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

/**
 * A repo file with its contents left base64-encoded, as GitHub's blob API
 * returns them. Kept base64 (not decoded to bytes) because this crosses the
 * content-script relay via `browser.runtime.sendMessage`, which only
 * reliably carries JSON-safe values - the hosted page decodes it back to a
 * `Uint8Array` on arrival. See preview-page/src/githubRepo.ts.
 */
export interface RawRepoFile {
  path: string;
  content: string;
}

async function githubFetch(
  path: string,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    ...extraHeaders,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, { headers });
  } catch (cause) {
    throw new GitHubNetworkError(cause);
  }

  // Captured unconditionally, including on error responses - a 403 with
  // remaining=0 is exactly the "exhausted" case the rate-limit indicator
  // needs to detect. See utils/githubRateLimit.ts.
  await recordRateLimit(response.headers);

  // A conditional request (If-None-Match) hitting a match - the cached tree
  // is still current. Not an error; the caller (getTree) checks for this
  // status itself rather than treating a non-ok response as a failure.
  if (response.status === 304) return response;

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

interface GitHubTreeResult extends GitHubTreeResponse {
  etag: string | null;
  // True when `etag` was sent as If-None-Match and GitHub confirmed the
  // tree hasn't changed (304) - `tree` is empty and should be ignored in
  // favor of the caller's already-cached files. See fetchRepoFiles below.
  notModified: boolean;
}

async function getTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  etag?: string,
): Promise<GitHubTreeResult> {
  const response = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
    etag ? { 'If-None-Match': etag } : undefined,
  );
  const newEtag = response.headers.get('etag');

  if (response.status === 304) {
    return { tree: [], truncated: false, etag: newEtag ?? etag ?? null, notModified: true };
  }

  const data = (await response.json()) as GitHubTreeResponse;
  return { ...data, etag: newEtag, notModified: false };
}

async function getBlobContents(
  owner: string,
  repo: string,
  sha: string,
  token?: string,
): Promise<string> {
  const response = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, token);
  const data = (await response.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected blob encoding "${data.encoding}" for blob ${sha}`);
  }
  return data.content;
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
 * them as a flat list of `RawRepoFile`s. Throws `RepoTooLargeError` if
 * GitHub truncates the tree response. This is the extension-side half of
 * Phase 2's relay (roadmap `refactor/route-github-fetch-through-relay`) -
 * registered as the `github:fetch-repo` bridge handler in
 * entrypoints/background.ts, called by the hosted page over the message
 * bridge instead of the page calling GitHub directly.
 *
 * Caching (roadmap Phase 3, `feature/github-cache-layer`): a repo fetched
 * within the last `CACHE_TTL_MS` is served straight from
 * `chrome.storage.local` with no network call. Past that window, the tree
 * is re-checked with a conditional (`If-None-Match`) request - a 304 means
 * nothing changed (blob content is addressed by immutable SHA, so an
 * unchanged tree guarantees unchanged files) and just renews the cache's
 * TTL; a 200 means the repo actually changed, and every blob is re-fetched
 * to replace the cached copy.
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  token?: string,
): Promise<RawRepoFile[]> {
  const cached = await getCachedRepo(owner, repo);
  if (cached && isFresh(cached)) {
    return cached.files;
  }

  const branch = await getDefaultBranch(owner, repo, token);
  const { tree, truncated, etag, notModified } = await getTree(
    owner,
    repo,
    branch,
    token,
    cached?.etag ?? undefined,
  );

  if (notModified && cached) {
    await setCachedRepo(owner, repo, { ...cached, fetchedAt: Date.now() });
    return cached.files;
  }

  if (truncated) {
    throw new RepoTooLargeError(owner, repo);
  }

  const blobEntries = tree.filter((entry) => entry.type === 'blob');
  const contents = await mapWithConcurrency(blobEntries, BLOB_FETCH_CONCURRENCY, (entry) =>
    getBlobContents(owner, repo, entry.sha, token),
  );

  const files = blobEntries.map((entry, i) => ({ path: entry.path, content: contents[i] }));
  await setCachedRepo(owner, repo, { files, etag, fetchedAt: Date.now() });
  return files;
}
