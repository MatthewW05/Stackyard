import { storage } from 'wxt/utils/storage';
import type { RawRepoFile } from './githubRepo';

// How long a cached repo is served with no network call at all. Once this
// elapses, the next fetch revalidates via a conditional (ETag) request
// instead of trusting the cache blindly - see utils/githubRepo.ts and
// roadmap Phase 3, feature/github-cache-layer.
export const CACHE_TTL_MS = 5 * 60 * 1000;

export interface CachedRepo {
  files: RawRepoFile[];
  etag: string | null;
  fetchedAt: number;
}

function cacheKey(owner: string, repo: string): `local:${string}` {
  return `local:githubCache:${owner}/${repo}`;
}

export async function getCachedRepo(owner: string, repo: string): Promise<CachedRepo | null> {
  return storage.getItem<CachedRepo>(cacheKey(owner, repo));
}

export async function setCachedRepo(owner: string, repo: string, entry: CachedRepo): Promise<void> {
  await storage.setItem(cacheKey(owner, repo), entry);
}

export function isFresh(entry: CachedRepo, now: number = Date.now()): boolean {
  return now - entry.fetchedAt < CACHE_TTL_MS;
}
