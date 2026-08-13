import { describe, it, expect } from 'vitest';
import { getCachedRepo, setCachedRepo, isFresh, CACHE_TTL_MS, type CachedRepo } from './githubCache';

describe('githubCache', () => {
  it('returns null for a repo that has never been cached', async () => {
    expect(await getCachedRepo('octocat', 'never-cached')).toBeNull();
  });

  it('round-trips a cached entry', async () => {
    const entry: CachedRepo = {
      files: [{ path: 'package.json', content: 'e30=' }],
      etag: 'W/"abc123"',
      fetchedAt: Date.now(),
    };

    await setCachedRepo('octocat', 'hello-world', entry);

    expect(await getCachedRepo('octocat', 'hello-world')).toEqual(entry);
  });

  it('keeps separate repos under separate cache entries', async () => {
    await setCachedRepo('octocat', 'repo-a', {
      files: [{ path: 'a.txt', content: 'YQ==' }],
      etag: 'a',
      fetchedAt: Date.now(),
    });
    await setCachedRepo('octocat', 'repo-b', {
      files: [{ path: 'b.txt', content: 'Yg==' }],
      etag: 'b',
      fetchedAt: Date.now(),
    });

    expect((await getCachedRepo('octocat', 'repo-a'))?.etag).toBe('a');
    expect((await getCachedRepo('octocat', 'repo-b'))?.etag).toBe('b');
  });

  it('is fresh right up to the TTL boundary and stale just past it', () => {
    const entry: CachedRepo = { files: [], etag: null, fetchedAt: 1_000_000 };

    expect(isFresh(entry, 1_000_000 + CACHE_TTL_MS - 1)).toBe(true);
    expect(isFresh(entry, 1_000_000 + CACHE_TTL_MS)).toBe(false);
  });
});
