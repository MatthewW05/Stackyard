import { sendBridgeRequest } from './bridge';
import type { RepoFile } from './fileSystemTree';

// The tree walk, pagination, and blob fetching itself now happen in the
// extension's background script (utils/githubRepo.ts there) - this page
// never talks to GitHub directly, per Phase 2 of the roadmap. See
// refactor/route-github-fetch-through-relay.
const GITHUB_FETCH_TIMEOUT_MS = 60_000;

// Mirrors `RawRepoFile` from the extension's utils/githubRepo.ts. Content
// stays base64 across the relay - browser.runtime.sendMessage only reliably
// carries JSON-safe values, unlike window.postMessage - and is decoded to
// bytes here instead.
interface RawRepoFile {
  path: string;
  content: string;
}

// Error `name`s the extension's github:fetch-repo handler can report (see
// utils/githubRepo.ts there) - used to tell an already-friendly GitHub
// error apart from an unexpected one after it's crossed the relay.
const RELAYED_GITHUB_ERROR_NAMES = new Set([
  'GitHubNotFoundError',
  'GitHubRateLimitError',
  'GitHubNetworkError',
  'RepoTooLargeError',
]);

/**
 * A GitHub-fetch failure relayed from the extension's background script.
 * Its message is already friendly and specific (e.g. "repo is too large to
 * preview...") - display it as-is, unlike an unexpected error.
 */
export class GitHubFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubFetchError';
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetches every file in a public GitHub repo's default branch via the
 * extension's message-bridge relay and returns them ready for
 * `buildFileSystemTree`. Rejects with `GitHubFetchError` for a friendly,
 * already-classified GitHub failure (not found, rate limited, etc.), or the
 * bridge's own error (e.g. a timeout, most likely meaning the Stackyard
 * extension isn't installed) otherwise.
 */
export async function fetchRepoFiles(owner: string, repo: string): Promise<RepoFile[]> {
  let files: RawRepoFile[];
  try {
    files = await sendBridgeRequest<RawRepoFile[]>(
      'github:fetch-repo',
      { owner, repo },
      GITHUB_FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof Error && RELAYED_GITHUB_ERROR_NAMES.has(error.name)) {
      throw new GitHubFetchError(error.message);
    }
    throw error;
  }

  return files.map((f) => ({ path: f.path, contents: base64ToBytes(f.content) }));
}
