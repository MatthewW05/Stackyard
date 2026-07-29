const RESERVED_OWNERS = new Set([
  'settings',
  'notifications',
  'marketplace',
  'issues',
  'pulls',
  'orgs',
  'sponsors',
  'topics',
  'collections',
  'trending',
  'explore',
  'dashboard',
  'new',
  'organizations',
  'apps',
  'about',
  'pricing',
  'security',
  'login',
  'join',
  'logout',
  'search',
  'gist',
  'codespaces',
  'features',
  'watching',
  'stars',
  'account',
  'contact',
  'site',
  'support',
]);

export interface GitHubRepo {
  owner: string;
  repo: string;
}

/**
 * Extracts { owner, repo } from a GitHub URL, or returns null if the URL
 * isn't a repo page (e.g. a profile, org, or GitHub-reserved route like
 * /settings that also has 2+ path segments).
 */
export function parseGitHubRepo(url: string | URL): GitHubRepo | null {
  let parsed: URL;
  try {
    parsed = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return null;
  }

  if (parsed.hostname !== 'github.com') return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const [owner, repo] = segments;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return null;

  return { owner, repo };
}
