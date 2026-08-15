import { useEffect, useState } from 'react';
import {
  githubTokenStorage,
  deviceFlowStatusStorage,
  type DeviceFlowStatus,
} from '@/utils/githubAuth';
import type { BridgeResult } from '@/utils/messages';
import { fetchGitHubRateLimit, type RateLimitStatus } from './rateLimit';

interface StartSignInPayload {
  userCode: string;
  verificationUri: string;
}

async function sendBridgeMessage<T>(type: string): Promise<T> {
  const result = (await browser.runtime.sendMessage({ type })) as BridgeResult<T>;
  if (!result.ok) throw new Error(result.error);
  return result.payload;
}

function SignInView() {
  // null while the stored token hasn't been read yet.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<DeviceFlowStatus>({ phase: 'idle' });
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyToken(token: string | null) {
      setSignedIn(token !== null);
      if (token)
        fetchGitHubRateLimit(token)
          .then(setRateLimit)
          .catch(() => {});
      else setRateLimit(null);
    }

    githubTokenStorage.getValue().then((token) => {
      if (!cancelled) applyToken(token);
    });
    deviceFlowStatusStorage.getValue().then((value) => {
      if (!cancelled) setStatus(value);
    });

    // The popup closes the instant the user switches to github.com to enter
    // the code, so it never sees the sign-in finish directly - these watch
    // the background's alarm-driven poller instead, and pick up wherever
    // things landed whenever the popup happens to be open. See
    // utils/deviceFlowOrchestrator.ts and roadmap Phase 3.
    const unwatchToken = githubTokenStorage.watch(applyToken);
    const unwatchStatus = deviceFlowStatusStorage.watch(setStatus);

    return () => {
      cancelled = true;
      unwatchToken();
      unwatchStatus();
    };
  }, []);

  async function handleSignIn() {
    setStarting(true);
    try {
      await sendBridgeMessage<StartSignInPayload>('auth:start-sign-in');
    } catch (error) {
      await deviceFlowStatusStorage.setValue({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    await sendBridgeMessage('auth:cancel-sign-in');
  }

  async function handleSignOut() {
    await githubTokenStorage.setValue(null);
  }

  if (signedIn === null) {
    return <p>Loading...</p>;
  }

  if (signedIn) {
    return (
      <>
        <p>Signed in to GitHub.</p>
        <p className="rate-limit">
          {rateLimit
            ? `${rateLimit.remaining} of ${rateLimit.limit} requests/hour remaining.`
            : 'Checking rate limit...'}
        </p>
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <p>Sign in to preview private repos and raise the API rate limit to 5,000/hr.</p>

      {status.phase === 'idle' && (
        <button type="button" className="btn-primary" onClick={handleSignIn} disabled={starting}>
          {starting ? 'Starting...' : 'Sign in with GitHub'}
        </button>
      )}

      {status.phase === 'awaiting-user' && (
        <>
          <p>Enter this code at {status.verificationUri}:</p>
          <p className="user-code">{status.userCode}</p>
          <p>
            <a href={status.verificationUri} target="_blank" rel="noreferrer">
              Open {status.verificationUri}
            </a>
          </p>
          <p>Waiting for you to authorize on GitHub...</p>
          <button type="button" onClick={handleCancel}>
            Cancel
          </button>
        </>
      )}

      {status.phase === 'error' && (
        <>
          <p className="error-message">{status.message}</p>
          <button type="button" className="btn-primary" onClick={handleSignIn} disabled={starting}>
            Try again
          </button>
        </>
      )}
    </>
  );
}

export default SignInView;
