export const OPEN_PREVIEW_MESSAGE = 'stackyard:open-preview' as const;

export interface OpenPreviewMessage {
  type: typeof OPEN_PREVIEW_MESSAGE;
  url: string;
}

// Generic relay for anything the hosted page needs an external service for
// (GitHub today, an AI provider later) - see Phase 2 of the roadmap. `type`
// is the specific request kind (e.g. "ping", "github:fetch-repo"); the same
// plumbing carries all of them instead of each getting its own bridge.
export const PAGE_BRIDGE_SOURCE = 'stackyard-page' as const;
export const CONTENT_SCRIPT_BRIDGE_SOURCE = 'stackyard-content-script' as const;

export interface BridgeRequest {
  type: string;
  payload?: unknown;
}

export type BridgeResult<T = unknown> = { ok: true; payload: T } | { ok: false; error: string };

// Envelope for the page -> content script leg, sent via window.postMessage.
// `source` lets the content script's listener tell this apart from its own
// reply (posted to the same window) and from unrelated postMessage traffic.
export interface PageToContentMessage extends BridgeRequest {
  source: typeof PAGE_BRIDGE_SOURCE;
  requestId: string;
}

// Envelope for the content script -> page leg, sent back via
// window.postMessage.
export interface ContentToPageMessage {
  source: typeof CONTENT_SCRIPT_BRIDGE_SOURCE;
  requestId: string;
  result: BridgeResult;
}
