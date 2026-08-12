import { startDeviceFlow, pollDeviceFlowOnce } from './githubDeviceFlow';
import {
  githubTokenStorage,
  deviceFlowStatusStorage,
  deviceFlowPollStateStorage,
} from './githubAuth';

// GitHub's real suggested interval (typically 5s) is passed straight
// through to chrome.alarms rather than pre-clamped here: Chrome itself
// clamps delays under 1 minute to 1 minute, but only for packed/published
// extensions - unpacked dev builds are deliberately exempted so local
// testing stays fast. Clamping to 60s ourselves would defeat that exemption
// and make every sign-in during development take a full minute per poll for
// no reason. Only guards against a degenerate non-positive interval.
function clampInterval(intervalSeconds: number): number {
  return Math.max(intervalSeconds, 1);
}

export interface StartSignInResult {
  userCode: string;
  verificationUri: string;
  nextPollDelaySeconds: number;
}

/** Starts a Device Flow sign-in and records the state a poll tick needs. */
export async function startSignIn(clientId: string): Promise<StartSignInResult> {
  const device = await startDeviceFlow(clientId);

  await deviceFlowPollStateStorage.setValue({
    clientId,
    deviceCode: device.device_code,
    intervalSeconds: device.interval,
    expiresAt: Date.now() + device.expires_in * 1000,
  });
  await deviceFlowStatusStorage.setValue({
    phase: 'awaiting-user',
    userCode: device.user_code,
    verificationUri: device.verification_uri,
  });

  return {
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    nextPollDelaySeconds: clampInterval(device.interval),
  };
}

/** Cancels an in-progress sign-in. Caller is still responsible for clearing the alarm. */
export async function cancelSignIn(): Promise<void> {
  await deviceFlowPollStateStorage.setValue(null);
  await deviceFlowStatusStorage.setValue({ phase: 'idle' });
}

const EXPIRED_MESSAGE =
  'The sign-in code expired before it was used. Start again to get a new one.';
const DENIED_MESSAGE = 'Sign-in was declined on GitHub.';

export type PollTickResult = { done: false; nextPollDelaySeconds: number } | { done: true };

/**
 * Runs one poll attempt for the in-progress sign-in, if any, updating
 * storage with the result. Meant to be called from browser.alarms.onAlarm -
 * kept free of any browser.alarms calls itself so this state machine stays
 * unit-testable without a real (or faked) alarms API.
 */
export async function runPollTick(): Promise<PollTickResult> {
  const pollState = await deviceFlowPollStateStorage.getValue();
  if (!pollState) return { done: true };

  if (Date.now() >= pollState.expiresAt) {
    await deviceFlowPollStateStorage.setValue(null);
    await deviceFlowStatusStorage.setValue({ phase: 'error', message: EXPIRED_MESSAGE });
    return { done: true };
  }

  let result;
  try {
    result = await pollDeviceFlowOnce(pollState.clientId, pollState.deviceCode);
  } catch (error) {
    await deviceFlowPollStateStorage.setValue(null);
    await deviceFlowStatusStorage.setValue({
      phase: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    return { done: true };
  }

  switch (result.status) {
    case 'success':
      await githubTokenStorage.setValue(result.token);
      await deviceFlowPollStateStorage.setValue(null);
      await deviceFlowStatusStorage.setValue({ phase: 'idle' });
      return { done: true };

    case 'pending':
      return { done: false, nextPollDelaySeconds: clampInterval(pollState.intervalSeconds) };

    case 'slow_down': {
      const intervalSeconds = Number.isFinite(result.intervalSeconds)
        ? result.intervalSeconds
        : pollState.intervalSeconds + 5;
      await deviceFlowPollStateStorage.setValue({ ...pollState, intervalSeconds });
      return { done: false, nextPollDelaySeconds: clampInterval(intervalSeconds) };
    }

    case 'expired':
      await deviceFlowPollStateStorage.setValue(null);
      await deviceFlowStatusStorage.setValue({ phase: 'error', message: EXPIRED_MESSAGE });
      return { done: true };

    case 'denied':
      await deviceFlowPollStateStorage.setValue(null);
      await deviceFlowStatusStorage.setValue({ phase: 'error', message: DENIED_MESSAGE });
      return { done: true };
  }
}
