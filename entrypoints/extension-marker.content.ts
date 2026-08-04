import { PREVIEW_PAGE_URL } from '@/utils/preview-url';

// Matches only the hosted preview page's own domain - this is a UX nudge for
// visitors who land there without the extension, not a security boundary.
// Real repo data can't arrive without the extension either way once the
// Phase 2 message relay lands (see roadmap).
const HOSTED_PAGE_HOSTNAME = new URL(PREVIEW_PAGE_URL).hostname;

export default defineContentScript({
  matches: [`*://${HOSTED_PAGE_HOSTNAME}/*`],
  runAt: 'document_start',
  main() {
    // document_start fires before the page's own module script runs, so the
    // attribute is already present by the time preview-page/src/main.ts
    // checks for it.
    document.documentElement.dataset.stackyardExtensionInstalled = 'true';
  },
});
