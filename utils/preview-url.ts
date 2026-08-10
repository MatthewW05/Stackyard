import type { GitHubRepo } from '@/utils/github';

// Hosted on Vercel; see preview-page/ and WEBCONTAINER_NOTES.md for why
// this can't be a page packaged into the extension itself.
export const PREVIEW_PAGE_URL = 'https://preview-page-seven.vercel.app/';

// Shared by every content script that needs to match only the hosted page's
// own domain (extension-marker.content.ts, message-bridge.content.ts).
export const HOSTED_PAGE_HOSTNAME = new URL(PREVIEW_PAGE_URL).hostname;

export function buildPreviewUrl({ owner, repo }: GitHubRepo): string {
  const url = new URL(PREVIEW_PAGE_URL);
  url.searchParams.set('owner', owner);
  url.searchParams.set('repo', repo);
  return url.toString();
}
