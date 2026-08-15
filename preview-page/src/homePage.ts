const REPO_URL = 'https://github.com/MatthewW05/Stackyard';

// Chrome Web Store / Firefox AMO links aren't real yet (chore/publish-stores,
// Phase 4) - both point at the repo's own "Loading the unpacked build"
// instructions until then.
const CHROME_INSTALL_URL = REPO_URL;
const FIREFOX_INSTALL_URL = REPO_URL;

interface HomePageOptions {
  /** Whether the extension-marker content script was detected on this page. */
  extensionInstalled: boolean;
}

const ctaSection = ({ extensionInstalled }: HomePageOptions): string =>
  extensionInstalled
    ? `
      <div class="home-cta">
        <a class="btn btn-primary" href="https://github.com">Browse GitHub</a>
      </div>
      <p class="home-cta-hint">
        Extension detected — open any public repo and click <strong>Preview</strong> to start.
      </p>`
    : `
      <div class="home-cta">
        <a class="btn btn-primary" href="${CHROME_INSTALL_URL}">Get it for Chrome</a>
        <a class="btn btn-secondary" href="${FIREFOX_INSTALL_URL}">Get it for Firefox</a>
      </div>
      <p class="home-cta-hint">
        Then open any public repo on GitHub and click <strong>Preview</strong>.
      </p>`;

/**
 * Renders the same marketing-style home page whether this page was reached
 * without the Stackyard extension installed, or with the extension present
 * but no owner/repo query params (i.e. visited directly rather than via the
 * extension's Preview button) - only the CTA section differs. This is a UX
 * nudge, not a security boundary - see extensionGate.ts.
 */
export function renderHomePage(container: HTMLElement, options: HomePageOptions): void {
  container.innerHTML = `
    <div class="home">
      <header class="home-nav">
        <a class="home-brand" href="${REPO_URL}">
          <img src="/favicon.png" alt="" width="20" height="20" />
          Stackyard
        </a>
        <a class="home-nav-link" href="${REPO_URL}" target="_blank" rel="noreferrer">GitHub</a>
      </header>

      <section class="home-hero">
        <h1>Preview any GitHub repo, live.</h1>
        <p>
          Stackyard boots a real dev server in your browser and streams it straight into a
          preview — no clone, no local install.
        </p>
        ${ctaSection(options)}
      </section>

      <section class="home-features">
        <div class="home-feature">
          <h2>A real dev server</h2>
          <p>
            Runs your project's actual dev/start script inside a WebContainer — not a static
            render or a mock.
          </p>
        </div>
        <div class="home-feature">
          <h2>Zero setup</h2>
          <p>
            No git clone, no local npm install, no CI wait. Click Preview on any repo page and
            it's running in seconds.
          </p>
        </div>
        <div class="home-feature">
          <h2>Sign in with GitHub</h2>
          <p>
            Optional sign-in raises the API rate limit to 5,000 requests/hour and unlocks
            previews of your private repos.
          </p>
        </div>
      </section>

      <footer class="home-footer">
        <p>
          Live previews powered by
          <a href="https://webcontainers.io/" target="_blank" rel="noreferrer">WebContainers</a>
          (StackBlitz) ·
          <a href="${REPO_URL}" target="_blank" rel="noreferrer">View source on GitHub</a>
        </p>
      </footer>
    </div>
  `;
}
