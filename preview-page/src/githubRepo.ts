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

interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

async function githubFetch(path: string): Promise<Response> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${path}`);
  }
  return response;
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const response = await githubFetch(`/repos/${owner}/${repo}`);
  const data = (await response.json()) as { default_branch: string };
  return data.default_branch;
}

async function getTree(owner: string, repo: string, branch: string): Promise<GitHubTreeResponse> {
  const response = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
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

async function getBlobContents(owner: string, repo: string, sha: string): Promise<Uint8Array> {
  const response = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`);
  const data = (await response.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected blob encoding "${data.encoding}" for blob ${sha}`);
  }
  return base64ToBytes(data.content);
}

/**
 * Fetches every file in a public GitHub repo's default branch and returns
 * them as a flat list ready for `buildFileSystemTree`. Throws
 * `RepoTooLargeError` if GitHub truncates the tree response.
 */
export async function fetchRepoFiles(owner: string, repo: string): Promise<RepoFile[]> {
  const branch = await getDefaultBranch(owner, repo);
  const { tree, truncated } = await getTree(owner, repo, branch);
  if (truncated) {
    throw new RepoTooLargeError(owner, repo);
  }

  const blobEntries = tree.filter((entry) => entry.type === 'blob');
  return Promise.all(
    blobEntries.map(async (entry) => ({
      path: entry.path,
      contents: await getBlobContents(owner, repo, entry.sha),
    })),
  );
}
