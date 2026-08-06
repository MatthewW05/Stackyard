import {
  PAGE_BRIDGE_SOURCE,
  CONTENT_SCRIPT_BRIDGE_SOURCE,
  type PageToContentMessage,
  type ContentToPageMessage,
  type BridgeRequest,
  type BridgeResult,
} from '@/utils/messages';
import { HOSTED_PAGE_HOSTNAME } from '@/utils/preview-url';

// Generic relay: page ↔ this content script ↔ background script, for any
// request `type` (see utils/messages.ts and Phase 2 of the roadmap). Matches
// only the hosted page's own domain, same as extension-marker.content.ts.
export default defineContentScript({
  matches: [`*://${HOSTED_PAGE_HOSTNAME}/*`],
  main() {
    window.addEventListener('message', (event: MessageEvent) => {
      // Strict origin check on this leg of the page <-> content-script
      // boundary: event.source !== window rules out a same-page iframe
      // (e.g. the WebContainer preview iframe once booted) posting up to
      // spoof a request, and event.origin confirms it came from this page's
      // own document rather than something injected into it.
      if (event.source !== window || event.origin !== location.origin) return;

      const data = event.data as Partial<PageToContentMessage> | undefined;
      if (
        data?.source !== PAGE_BRIDGE_SOURCE ||
        typeof data.type !== 'string' ||
        typeof data.requestId !== 'string'
      ) {
        return;
      }

      const { requestId, type, payload } = data;
      const request: BridgeRequest = { type, payload };

      browser.runtime
        .sendMessage(request)
        .then((result: BridgeResult | undefined) =>
          respond(
            requestId,
            result ?? { ok: false, error: `No bridge handler responded for type "${type}"` },
          ),
        )
        .catch((error: unknown) =>
          respond(requestId, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    });

    function respond(requestId: string, result: BridgeResult): void {
      const message: ContentToPageMessage = {
        source: CONTENT_SCRIPT_BRIDGE_SOURCE,
        requestId,
        result,
      };
      // Reply on the same origin the request came from - this page's own
      // origin, never '*'.
      window.postMessage(message, location.origin);
    }
  },
});
