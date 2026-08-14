// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRateLimitStatus, renderRateLimitStatus } from './rateLimit';

const CONTENT_SCRIPT_BRIDGE_SOURCE = 'stackyard-content-script';

interface SentRequest {
  source: string;
  requestId: string;
  type: string;
  payload: unknown;
}

function replyWith(
  requestId: string,
  result: { ok: true; payload: unknown } | { ok: false; error: string; name?: string },
): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { source: CONTENT_SCRIPT_BRIDGE_SOURCE, requestId, result },
      origin: window.location.origin,
      source: window,
    }),
  );
}

describe('fetchRateLimitStatus', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    postMessageSpy?.mockRestore();
  });

  it('requests github:rate-limit-status and resolves with the relayed payload', async () => {
    postMessageSpy = vi.spyOn(window, 'postMessage');

    const promise = fetchRateLimitStatus();
    const sent = postMessageSpy.mock.calls.at(-1)![0] as SentRequest;
    expect(sent.type).toBe('github:rate-limit-status');

    replyWith(sent.requestId, {
      ok: true,
      payload: { limit: 60, remaining: 42, reset: 1700000000 },
    });

    await expect(promise).resolves.toEqual({ limit: 60, remaining: 42, reset: 1700000000 });
  });
});

describe('renderRateLimitStatus', () => {
  it('renders nothing when no status is known yet', () => {
    const container = document.createElement('div');
    renderRateLimitStatus(container, null);

    expect(container.children.length).toBe(0);
  });

  it('renders the remaining/limit line with no nudge while requests remain', () => {
    const container = document.createElement('div');
    renderRateLimitStatus(container, { limit: 60, remaining: 42, reset: 1700000000 });

    expect(container.textContent).toContain('42 of 60 GitHub requests remaining this hour.');
    expect(container.querySelector('.rate-limit-nudge')).toBeNull();
  });

  it('adds a sign-in nudge only once the limit is exhausted', () => {
    const container = document.createElement('div');
    renderRateLimitStatus(container, { limit: 60, remaining: 0, reset: 1700000000 });

    const nudge = container.querySelector('.rate-limit-nudge');
    expect(nudge).not.toBeNull();
    expect(nudge?.textContent).toMatch(/sign in/i);
  });

  it('replaces a previous render instead of accumulating elements', () => {
    const container = document.createElement('div');
    renderRateLimitStatus(container, { limit: 60, remaining: 10, reset: 1700000000 });
    renderRateLimitStatus(container, { limit: 60, remaining: 0, reset: 1700000600 });

    expect(container.querySelectorAll('.rate-limit-status').length).toBe(1);
    expect(container.querySelectorAll('.rate-limit-nudge').length).toBe(1);
  });
});
