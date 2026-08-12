import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startDeviceFlow, pollDeviceFlowOnce } from './githubDeviceFlow';

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

describe('pollDeviceFlowOnce', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts client_id/device_code/grant_type to the access token endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'gho_token' }));

    await pollDeviceFlowOnce('client-abc', 'device-123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(init.body)).toEqual({
      client_id: 'client-abc',
      device_code: 'device-123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('returns a success result with the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'gho_token', token_type: 'bearer' }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).resolves.toEqual({
      status: 'success',
      token: 'gho_token',
    });
  });

  it('returns a pending result on authorization_pending', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'authorization_pending' }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).resolves.toEqual({
      status: 'pending',
    });
  });

  it('returns the new interval on slow_down', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'slow_down', interval: 10 }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).resolves.toEqual({
      status: 'slow_down',
      intervalSeconds: 10,
    });
  });

  it('returns an expired result on expired_token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'expired_token' }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).resolves.toEqual({
      status: 'expired',
    });
  });

  it('returns a denied result on access_denied', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'access_denied' }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).resolves.toEqual({
      status: 'denied',
    });
  });

  it('throws on an unrecognized error code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'something_new' }));

    await expect(pollDeviceFlowOnce('client-abc', 'device-123')).rejects.toThrow(
      /Unexpected GitHub OAuth response/,
    );
  });
});
