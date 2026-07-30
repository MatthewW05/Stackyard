import type { GitHubRepo } from '@/utils/github';

// Hosted on Vercel; see preview-page/ and WEBCONTAINER_SPIKE_NOTES.md for why
// this can't be a page packaged into the extension itself.
export const PREVIEW_PAGE_URL = 'https://preview-page-seven.vercel.app/';

export function buildPreviewUrl({ owner, repo }: GitHubRepo): string {
  const url = new URL(PREVIEW_PAGE_URL);
  url.searchParams.set('owner', owner);
  url.searchParams.set('repo', repo);
  return url.toString();
}
