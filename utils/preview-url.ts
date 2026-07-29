import type { GitHubRepo } from '@/utils/github';

// Placeholder host for the WebContainer preview page (feature/webcontainer-page,
// not yet deployed). Point this at a locally running dev server for now;
// swap in the real deployed URL once that branch ships.
export const PREVIEW_PAGE_URL = 'http://localhost:5173/preview';

export function buildPreviewUrl({ owner, repo }: GitHubRepo): string {
  const url = new URL(PREVIEW_PAGE_URL);
  url.searchParams.set('owner', owner);
  url.searchParams.set('repo', repo);
  return url.toString();
}
