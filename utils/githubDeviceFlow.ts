const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// Full repo access - this also grants private-repo support as a side effect
// of signing in, per roadmap Phase 3.
const DEFAULT_SCOPE = 'repo';

export class DeviceFlowAccessDeniedError extends Error {
  constructor() {
    super('Sign-in was declined on GitHub.');
    this.name = 'DeviceFlowAccessDeniedError';
  }
}

export class DeviceFlowExpiredError extends Error {
  constructor() {
    super('The sign-in code expired before it was used. Start again to get a new one.');
    this.name = 'DeviceFlowExpiredError';
  }
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

async function githubOAuthFetch(
  url: string,
  body: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth request failed (${response.status})`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * Starts a Device Flow sign-in, returning the code/URL to show the user and
 * the device_code + interval/expiry needed to poll for the resulting token.
 */
export async function startDeviceFlow(
  clientId: string,
  signal?: AbortSignal,
): Promise<DeviceCodeResponse> {
  const data = await githubOAuthFetch(
    DEVICE_CODE_URL,
    { client_id: clientId, scope: DEFAULT_SCOPE },
    signal,
  );
  return data as unknown as DeviceCodeResponse;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export interface PollForAccessTokenOptions {
  clientId: string;
  deviceCode: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  signal?: AbortSignal;
}

/**
 * Polls GitHub for the access token resulting from a Device Flow sign-in
 * started with `startDeviceFlow`, honoring the server's `interval` and
 * `slow_down` back-off. Runs in the options page itself, not the background
 * service worker, since MV3 service workers can be killed mid-poll (roadmap
 * Phase 3). Rejects with `DeviceFlowExpiredError` or
 * `DeviceFlowAccessDeniedError` if the user lets the code expire or declines
 * sign-in; rejects with an `AbortError` if `signal` is aborted.
 */
export async function pollForAccessToken(options: PollForAccessTokenOptions): Promise<string> {
  const { clientId, deviceCode, intervalSeconds, expiresInSeconds, signal } = options;
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;

  while (true) {
    await sleep(interval * 1000, signal);

    // Client-side safety net in addition to the server's own expired_token
    // response, so a slow_down-inflated interval can't push a poll past the
    // deadline before we'd otherwise notice.
    if (Date.now() >= deadline) {
      throw new DeviceFlowExpiredError();
    }

    const data = await githubOAuthFetch(
      ACCESS_TOKEN_URL,
      { client_id: clientId, device_code: deviceCode, grant_type: GRANT_TYPE },
      signal,
    );

    if (typeof data.access_token === 'string') {
      return data.access_token;
    }

    switch (data.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        interval = typeof data.interval === 'number' ? data.interval : interval + 5;
        continue;
      case 'expired_token':
        throw new DeviceFlowExpiredError();
      case 'access_denied':
        throw new DeviceFlowAccessDeniedError();
      default:
        throw new Error(`Unexpected GitHub OAuth response: ${JSON.stringify(data)}`);
    }
  }
}
