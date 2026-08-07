import {
  OPEN_PREVIEW_MESSAGE,
  type OpenPreviewMessage,
  type BridgeRequest,
  type BridgeResult,
} from '@/utils/messages';
import { fetchRepoFiles } from '@/utils/githubRepo';

type BridgeHandler = (payload: unknown) => Promise<unknown>;

interface GitHubFetchRepoPayload {
  owner: string;
  repo: string;
  token?: string;
}

function isGitHubFetchRepoPayload(payload: unknown): payload is GitHubFetchRepoPayload {
  if (!payload || typeof payload !== 'object') return false;
  const { owner, repo, token } = payload as Record<string, unknown>;
  return (
    typeof owner === 'string' &&
    typeof repo === 'string' &&
    (token === undefined || typeof token === 'string')
  );
}

// One handler per `type`. The later AI fallback call registers here too -
// the content-script relay and this dispatch loop don't change to support
// it (see roadmap Phase 2).
const bridgeHandlers: Record<string, BridgeHandler> = {
  ping: async () => 'pong',
  'github:fetch-repo': async (payload) => {
    if (!isGitHubFetchRepoPayload(payload)) {
      throw new Error('github:fetch-repo requires an { owner, repo, token? } payload');
    }
    return fetchRepoFiles(payload.owner, payload.repo, payload.token);
  },
};

async function dispatchBridgeRequest(message: BridgeRequest): Promise<BridgeResult> {
  const handler = bridgeHandlers[message.type];
  if (!handler) {
    return { ok: false, error: `No bridge handler registered for type "${message.type}"` };
  }

  try {
    return { ok: true, payload: await handler(message.payload) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    };
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
