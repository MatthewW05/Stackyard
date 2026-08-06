import {
  OPEN_PREVIEW_MESSAGE,
  type OpenPreviewMessage,
  type BridgeRequest,
  type BridgeResult,
} from '@/utils/messages';

type BridgeHandler = (payload: unknown) => Promise<unknown>;

// One handler per `type`. GitHub fetches and the later AI fallback call
// register here too - the content-script relay and this dispatch loop don't
// change to support them (see roadmap Phase 2).
const bridgeHandlers: Record<string, BridgeHandler> = {
  ping: async () => 'pong',
};

async function dispatchBridgeRequest(message: BridgeRequest): Promise<BridgeResult> {
  const handler = bridgeHandlers[message.type];
  if (!handler) {
    return { ok: false, error: `No bridge handler registered for type "${message.type}"` };
  }

  try {
    return { ok: true, payload: await handler(message.payload) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default defineBackground(() => {
  console.log('Stackyard background service worker started.', { id: browser.runtime.id });

  browser.runtime.onMessage.addListener((message: OpenPreviewMessage) => {
    if (message?.type === OPEN_PREVIEW_MESSAGE) {
      browser.tabs.create({ url: message.url });
    }
  });

  // Registered separately from the listener above: returning undefined here
  // for a message this dispatcher doesn't own (e.g. OPEN_PREVIEW_MESSAGE)
  // lets that other listener handle it instead, per the
  // webextension-polyfill convention of one Promise-returning listener per
  // message actually being handled.
  browser.runtime.onMessage.addListener((message: BridgeRequest) => {
    if (!message || typeof message.type !== 'string' || !(message.type in bridgeHandlers)) {
      return;
    }
    return dispatchBridgeRequest(message);
  });
});
