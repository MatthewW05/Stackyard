import { useEffect, useState } from 'react';
import './App.css';
import { githubTokenStorage } from '@/utils/githubAuth';

function App() {
  // null while the stored token hasn't been read yet.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    githubTokenStorage.getValue().then((token) => {
      if (!cancelled) setSignedIn(token !== null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function openOptionsPage() {
    browser.runtime.openOptionsPage();
    window.close();
  }

  return (
    <main>
      <h1>Stackyard</h1>
      <p>Preview any public GitHub repo running live, right from its repo page.</p>
      {signedIn !== null && (
        <>
          <p>{signedIn ? 'Signed in to GitHub.' : 'Not signed in to GitHub.'}</p>
          <button type="button" onClick={openOptionsPage}>
            {signedIn ? 'Manage GitHub sign-in' : 'Sign in with GitHub'}
          </button>
        </>
      )}
    </main>
  );
}

export default App;
