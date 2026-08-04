const REPO_URL = 'https://github.com/MatthewW05/Stackyard';

// Chrome Web Store / Firefox AMO links aren't real yet (chore/publish-stores,
// Phase 4) - both point at the repo's own "Loading the unpacked build"
// instructions until then.
const CHROME_INSTALL_URL = REPO_URL;
const FIREFOX_INSTALL_URL = REPO_URL;

/**
 * Replaces container's contents with a landing state for visitors who
 * reached this page without the Stackyard extension installed. This is a UX
 * nudge, not a security boundary - see extensionGate.ts.
 */
export function renderInstallPrompt(container: HTMLElement): void {
  container.replaceChildren();
  container.classList.add('install-prompt');

  const heading = document.createElement('h1');
  heading.textContent = 'Install the Stackyard extension to continue';
  container.append(heading);

  const message = document.createElement('p');
  message.textContent =
    "This page only works when opened from the Stackyard browser extension's " +
    'Preview button on a GitHub repo page.';
  container.append(message);

  const links = document.createElement('p');
  const chromeLink = document.createElement('a');
  chromeLink.href = CHROME_INSTALL_URL;
  chromeLink.textContent = 'Get it for Chrome';
  const firefoxLink = document.createElement('a');
  firefoxLink.href = FIREFOX_INSTALL_URL;
  firefoxLink.textContent = 'Get it for Firefox';
  links.append(chromeLink, ' · ', firefoxLink);
  container.append(links);
}
