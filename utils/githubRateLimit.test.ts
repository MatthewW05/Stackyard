import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { recordRateLimit, getRateLimitStatus } from './githubRateLimit';

function headersWith(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('githubRateLimit', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns null before any rate limit has been recorded', async () => {
    expect(await getRateLimitStatus()).toBeNull();
  });

  it('persists the x-ratelimit-* headers as the last-known status', async () => {
    await recordRateLimit(
      headersWith({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '42',
        'x-ratelimit-reset': '1700000000',
      }),
    );

    expect(await getRateLimitStatus()).toEqual({ limit: 60, remaining: 42, reset: 1700000000 });
  });

  it('overwrites the previous status with the latest recording', async () => {
    await recordRateLimit(
      headersWith({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '42',
        'x-ratelimit-reset': '1700000000',
      }),
    );
    await recordRateLimit(
      headersWith({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1700000600',
      }),
    );

    expect(await getRateLimitStatus()).toEqual({ limit: 60, remaining: 0, reset: 1700000600 });
  });

  it('does nothing when the rate-limit headers are absent', async () => {
    await recordRateLimit(headersWith({}));

    expect(await getRateLimitStatus()).toBeNull();
  });
});
