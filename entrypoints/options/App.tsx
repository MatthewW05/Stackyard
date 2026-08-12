import { useEffect, useRef, useState } from 'react';
import './App.css';
import { GITHUB_OAUTH_CLIENT_ID } from '@/utils/githubOAuthConfig';
import { githubTokenStorage } from '@/utils/githubAuth';
import { startDeviceFlow, pollForAccessToken } from '@/utils/githubDeviceFlow';
import { fetchGitHubRateLimit, type RateLimitStatus } from './rateLimit';

const CLIENT_ID_CONFIGURED = GITHUB_OAUTH_CLIENT_ID !== 'REPLACE_WITH_YOUR_GITHUB_OAUTH_APP_CLIENT_ID';

type SignInState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'awaiting-user'; userCode: string; verificationUri: string }
  | { status: 'error'; message: string };

function App() {
  // null while the stored token hasn't been read yet.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null);
  const [state, setState] = useState<SignInState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    githubTokenStorage.getValue().then((token) => {
      if (cancelled) return;
      setSignedIn(token !== null);
      if (token) fetchGitHubRateLimit(token).then(setRateLimit).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn() {
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'starting' });

    try {
      const device = await startDeviceFlow(GITHUB_OAUTH_CLIENT_ID, controller.signal);
      setState({
        status: 'awaiting-user',
        userCode: device.user_code,
        verificationUri: device.verification_uri,
      });

      const token = await pollForAccessToken({
        clientId: GITHUB_OAUTH_CLIENT_ID,
        deviceCode: device.device_code,
        intervalSeconds: device.interval,
        expiresInSeconds: device.expires_in,
        signal: controller.signal,
      });

      await githubTokenStorage.setValue(token);
      setSignedIn(true);
      setState({ status: 'idle' });
      fetchGitHubRateLimit(token).then(setRateLimit).catch(() => {});
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setState({ status: 'idle' });
        return;
      }
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleSignOut() {
    await githubTokenStorage.setValue(null);
    setSignedIn(false);
    setRateLimit(null);
    setState({ status: 'idle' });
  }

  return (
    <main>
      <h1>Stackyard settings</h1>

      {signedIn === null && <p>Loading...</p>}

      {signedIn === true && (
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
      )}

      {signedIn === false && (
        <>
          <p>Sign in to preview private repos and raise the API rate limit to 5,000/hr.</p>

          {!CLIENT_ID_CONFIGURED && (
            <p className="error-message">
              No GitHub OAuth client ID is configured yet - set GITHUB_OAUTH_CLIENT_ID in
              utils/githubOAuthConfig.ts.
            </p>
          )}

          {state.status === 'idle' && (
            <button type="button" onClick={handleSignIn} disabled={!CLIENT_ID_CONFIGURED}>
              Sign in with GitHub
            </button>
          )}

          {state.status === 'starting' && <p>Starting sign-in...</p>}

          {state.status === 'awaiting-user' && (
            <>
              <p>Enter this code at {state.verificationUri}:</p>
              <p className="user-code">{state.userCode}</p>
              <p>
                <a href={state.verificationUri} target="_blank" rel="noreferrer">
                  Open {state.verificationUri}
                </a>
              </p>
              <p>Waiting for you to authorize on GitHub...</p>
              <button type="button" onClick={handleCancel}>
                Cancel
              </button>
            </>
          )}

          {state.status === 'error' && (
            <>
              <p className="error-message">{state.message}</p>
              <button type="button" onClick={handleSignIn} disabled={!CLIENT_ID_CONFIGURED}>
                Try again
              </button>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default App;
