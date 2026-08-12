import { useState } from 'react';
import './App.css';
import SignInView from './SignInView';

type View = 'home' | 'sign-in';

function App() {
  const [view, setView] = useState<View>('home');

  return (
    <div className="layout">
      <nav className="sidebar">
        <button
          type="button"
          className={view === 'home' ? 'active' : ''}
          onClick={() => setView('home')}
        >
          Home
        </button>
        <button
          type="button"
          className={view === 'sign-in' ? 'active' : ''}
          onClick={() => setView('sign-in')}
        >
          Sign in
        </button>
      </nav>
      <main className="content">
        {view === 'home' && (
          <>
            <h1>Stackyard</h1>
            <p>Preview any public GitHub repo running live, right from its repo page.</p>
          </>
        )}
        {view === 'sign-in' && <SignInView />}
      </main>
    </div>
  );
}

export default App;
