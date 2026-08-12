import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startDeviceFlow,
  pollForAccessToken,
  DeviceFlowExpiredError,
  DeviceFlowAccessDeniedError,
} from './githubDeviceFlow';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('startDeviceFlow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts client_id and scope=repo to the device code endpoint', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        device_code: 'device-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    );

    const result = await startDeviceFlow('client-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://github.com/login/device/code');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ client_id: 'client-abc', scope: 'repo' });
    expect(result.device_code).toBe('device-123');
    expect(result.user_code).toBe('ABCD-1234');
  });

  it('throws when the device code request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'bad request' }, 400));

    await expect(startDeviceFlow('client-abc')).rejects.toThrow(/GitHub OAuth request failed/);
  });
});

describe('pollForAccessToken', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves with the access token once GitHub returns one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'gho_token', token_type: 'bearer' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toBe('gho_token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(init.body)).toEqual({
      client_id: 'client-abc',
      device_code: 'device-123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('keeps polling at the given interval on authorization_pending', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_token' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe('gho_token');
  });

  it('backs off to the new interval on slow_down', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down', interval: 10 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_token' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Still using the old 5s interval wouldn't be enough to trigger the next
    // poll - only the slow_down response's new 10s interval should.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(promise).resolves.toBe('gho_token');
  });

  it('rejects with DeviceFlowExpiredError on expired_token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'expired_token' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });
    const expectation = expect(promise).rejects.toThrow(DeviceFlowExpiredError);
    await vi.advanceTimersByTimeAsync(5000);
    await expectation;
  });

  it('rejects with DeviceFlowAccessDeniedError on access_denied', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'access_denied' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });
    const expectation = expect(promise).rejects.toThrow(DeviceFlowAccessDeniedError);
    await vi.advanceTimersByTimeAsync(5000);
    await expectation;
  });

  it('rejects with DeviceFlowExpiredError client-side once the deadline passes, without polling again', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'authorization_pending' }));

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 8,
    });
    const expectation = expect(promise).rejects.toThrow(DeviceFlowExpiredError);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Second wake-up (10s elapsed) is past the 8s expiry - should reject
    // before firing another fetch.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expectation;
  });

  it('rejects when aborted mid-wait, without polling again', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'authorization_pending' }));
    const controller = new AbortController();

    const promise = pollForAccessToken({
      clientId: 'client-abc',
      deviceCode: 'device-123',
      intervalSeconds: 5,
      expiresInSeconds: 900,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();
    await expectation;
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
