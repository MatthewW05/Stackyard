// Mirrors the envelope shape defined in utils/messages.ts on the extension
// side. This is a separate TypeScript project (see tsconfig.json) that can't
// import across that boundary, so the tiny contract is duplicated here -
// same pattern as extensionGate.ts mirroring
// entrypoints/extension-marker.content.ts's marker attribute. Keep in sync
// with entrypoints/message-bridge.content.ts.
const PAGE_BRIDGE_SOURCE = 'stackyard-page';
const CONTENT_SCRIPT_BRIDGE_SOURCE = 'stackyard-content-script';

const DEFAULT_TIMEOUT_MS = 5000;

export type BridgeResult<T = unknown> = { ok: true; payload: T } | { ok: false; error: string };

interface ContentToPageMessage {
  source: typeof CONTENT_SCRIPT_BRIDGE_SOURCE;
  requestId: string;
  result: BridgeResult;
}

/**
 * Sends `type`/`payload` to the background script via the message-bridge
 * content script and resolves with its response payload. Rejects if no
 * matching reply arrives within `timeoutMs` (most likely because the
 * Stackyard extension isn't installed) or if the background handler itself
 * reported failure.
 */
export function sendBridgeRequest<T = unknown>(
  type: string,
  payload?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Bridge request "${type}" timed out after ${timeoutMs}ms — is the Stackyard extension installed?`,
        ),
      );
    }, timeoutMs);

    function handleMessage(event: MessageEvent): void {
      if (event.source !== window || event.origin !== window.location.origin) return;

      const data = event.data as Partial<ContentToPageMessage> | undefined;
      if (data?.source !== CONTENT_SCRIPT_BRIDGE_SOURCE || data.requestId !== requestId) return;

      cleanup();
      const result = data.result as BridgeResult<T>;
      if (result.ok) resolve(result.payload);
      else reject(new Error(result.error));
    }

    function cleanup(): void {
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
    }

    window.addEventListener('message', handleMessage);
    window.postMessage(
      { source: PAGE_BRIDGE_SOURCE, requestId, type, payload },
      window.location.origin,
    );
  });
}
