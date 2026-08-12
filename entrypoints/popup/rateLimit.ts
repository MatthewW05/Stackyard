export interface RateLimitStatus {
  limit: number;
  remaining: number;
}

// Used right after sign-in to show the authenticated rate limit (5,000/hr)
// in the UI, as direct confirmation that the token actually works - see
// roadmap Phase 3, feature/github-oauth-device-flow Definition of Done.
export async function fetchGitHubRateLimit(token: string): Promise<RateLimitStatus> {
  const response = await fetch('https://api.github.com/rate_limit', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch rate limit status (${response.status})`);
  }
  const data = (await response.json()) as { resources: { core: RateLimitStatus } };
  return data.resources.core;
}
