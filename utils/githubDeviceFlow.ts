const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// Full repo access - this also grants private-repo support as a side effect
// of signing in, per roadmap Phase 3.
const DEFAULT_SCOPE = 'repo';

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
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
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
export async function startDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  const data = await githubOAuthFetch(DEVICE_CODE_URL, { client_id: clientId, scope: DEFAULT_SCOPE });
  return data as unknown as DeviceCodeResponse;
}

export type DeviceFlowPollResult =
  | { status: 'success'; token: string }
  | { status: 'pending' }
  | { status: 'slow_down'; intervalSeconds: number }
  | { status: 'expired' }
  | { status: 'denied' };

/**
 * Makes one poll attempt against GitHub's access_token endpoint. A single
 * attempt rather than a blocking loop, because the timing between attempts
 * is driven by browser.alarms in the background script (see
 * utils/deviceFlowOrchestrator.ts) rather than an in-page sleep loop - alarms
 * survive both the popup closing (it always does, the instant the user
 * switches to github.com to enter the code) and the background service
 * worker being suspended between ticks, per roadmap Phase 3.
 */
export async function pollDeviceFlowOnce(
  clientId: string,
  deviceCode: string,
): Promise<DeviceFlowPollResult> {
  const data = await githubOAuthFetch(ACCESS_TOKEN_URL, {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: GRANT_TYPE,
  });

  if (typeof data.access_token === 'string') {
    return { status: 'success', token: data.access_token };
  }

  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return {
        status: 'slow_down',
        intervalSeconds: typeof data.interval === 'number' ? data.interval : Number.NaN,
      };
    case 'expired_token':
      return { status: 'expired' };
    case 'access_denied':
      return { status: 'denied' };
    default:
      throw new Error(`Unexpected GitHub OAuth response: ${JSON.stringify(data)}`);
  }
}
