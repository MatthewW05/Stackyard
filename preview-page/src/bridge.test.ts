// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendBridgeRequest } from './bridge';

const PAGE_BRIDGE_SOURCE = 'stackyard-page';
const CONTENT_SCRIPT_BRIDGE_SOURCE = 'stackyard-content-script';

interface SentRequest {
  source: string;
  requestId: string;
  type: string;
  payload: unknown;
}

function replyWith(
  requestId: string,
  result: { ok: true; payload: unknown } | { ok: false; error: string },
  origin = window.location.origin,
): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { source: CONTENT_SCRIPT_BRIDGE_SOURCE, requestId, result },
      origin,
      source: window,
    }),
  );
}

describe('sendBridgeRequest', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window, 'postMessage');
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
  });

  function lastRequest(): SentRequest {
    const call = postMessageSpy.mock.calls.at(-1);
    return call![0] as SentRequest;
  }

  it('posts a request envelope with source/type/payload and a fresh requestId', async () => {
    const promise = sendBridgeRequest('ping', { foo: 'bar' });

    const sent = lastRequest();
    expect(sent.source).toBe(PAGE_BRIDGE_SOURCE);
    expect(sent.type).toBe('ping');
    expect(sent.payload).toEqual({ foo: 'bar' });
    expect(sent.requestId).toEqual(expect.any(String));

    replyWith(sent.requestId, { ok: true, payload: 'pong' });
    await promise;
  });

  it('resolves with the payload when a matching success reply arrives', async () => {
    const promise = sendBridgeRequest('ping');
    const { requestId } = lastRequest();

    replyWith(requestId, { ok: true, payload: 'pong' });

    await expect(promise).resolves.toBe('pong');
  });

  it('rejects with the error when a matching failure reply arrives', async () => {
    const promise = sendBridgeRequest('ping');
    const { requestId } = lastRequest();

    replyWith(requestId, { ok: false, error: 'boom' });

    await expect(promise).rejects.toThrow('boom');
  });

  it('ignores a reply for a different requestId', async () => {
    vi.useFakeTimers();
    try {
      const promise = sendBridgeRequest('ping', undefined, 200);
      const assertion = expect(promise).rejects.toThrow(/timed out/);

      replyWith('some-other-request-id', { ok: true, payload: 'pong' });
      await vi.advanceTimersByTimeAsync(200);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a reply from a different origin', async () => {
    vi.useFakeTimers();
    try {
      const promise = sendBridgeRequest('ping', undefined, 200);
      const { requestId } = lastRequest();
      const assertion = expect(promise).rejects.toThrow(/timed out/);

      replyWith(requestId, { ok: true, payload: 'pong' }, 'https://evil.example');
      await vi.advanceTimersByTimeAsync(200);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects if no reply arrives before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const promise = sendBridgeRequest('ping', undefined, 200);
      const assertion = expect(promise).rejects.toThrow(/timed out after 200ms/);

      await vi.advanceTimersByTimeAsync(200);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
