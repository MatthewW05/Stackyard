import { storage } from 'wxt/utils/storage';

// Last-known GitHub API rate limit, captured from response headers on every
// actual GitHub request (see utils/githubRepo.ts's githubFetch). Relayed to
// the hosted page as a non-blocking indicator via the github:rate-limit-status
// bridge handler - see roadmap Phase 3, feature/github-cache-layer.
export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
}

const rateLimitStorage = storage.defineItem<RateLimitStatus | null>('local:githubRateLimit', {
  defaultValue: null,
});

/**
 * Reads the x-ratelimit-* headers off a GitHub API response and persists
 * them as the last-known status. A no-op if the headers aren't present
 * (e.g. the request never reached GitHub).
 */
export async function recordRateLimit(headers: Headers): Promise<void> {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  if (limit === null || remaining === null || reset === null) return;

  await rateLimitStorage.setValue({
    limit: Number(limit),
    remaining: Number(remaining),
    reset: Number(reset),
  });
}

export async function getRateLimitStatus(): Promise<RateLimitStatus | null> {
  return rateLimitStorage.getValue();
}
