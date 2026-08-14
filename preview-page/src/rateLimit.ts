import { sendBridgeRequest } from './bridge';

// Mirrors RateLimitStatus from utils/githubRateLimit.ts on the extension
// side - this project can't import across that boundary, same pattern as
// bridge.ts mirroring utils/messages.ts. Keep in sync.
export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
}

const RATE_LIMIT_TIMEOUT_MS = 5000;

/**
 * Fetches the extension's last-known GitHub rate limit status. Resolves
 * `null` if no GitHub request has happened yet this session (e.g. every
 * fetch so far was served from the TTL cache with no network call).
 */
export async function fetchRateLimitStatus(): Promise<RateLimitStatus | null> {
  return sendBridgeRequest<RateLimitStatus | null>(
    'github:rate-limit-status',
    undefined,
    RATE_LIMIT_TIMEOUT_MS,
  );
}

/**
 * Renders a small, non-blocking "N of M requests remaining" line into
 * `container`. Renders nothing when `status` is null. Only once the limit
 * is actually exhausted does a sign-in nudge get added - never upfront, per
 * roadmap Phase 3, feature/github-cache-layer.
 */
export function renderRateLimitStatus(
  container: HTMLElement,
  status: RateLimitStatus | null,
): void {
  container.replaceChildren();
  if (!status) return;

  const line = document.createElement('p');
  line.className = 'rate-limit-status';
  line.textContent = `${status.remaining} of ${status.limit} GitHub requests remaining this hour.`;
  container.append(line);

  if (status.remaining > 0) return;

  const nudge = document.createElement('p');
  nudge.className = 'rate-limit-nudge';
  nudge.textContent =
    "You've hit GitHub's hourly limit for anonymous requests. Open the Stackyard extension " +
    'and sign in with GitHub to raise it to 5,000 requests/hour.';
  container.append(nudge);
}
