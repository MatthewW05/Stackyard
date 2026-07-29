import { parseGitHubRepo } from '@/utils/github';
import { OPEN_PREVIEW_MESSAGE, type OpenPreviewMessage } from '@/utils/messages';
import { buildPreviewUrl } from '@/utils/preview-url';

// GitHub renders two different headers for the same repo page depending on
// sign-in state: a legacy server-rendered one (logged out) and a Primer
// React one (logged in), each with its own Watch/Fork/Star container.
const REPO_HEADER_ACTIONS_SELECTOR = 'ul.pagehead-actions, ul[data-testid="repo-header-actions"]';

export default defineContentScript({
  matches: ['*://github.com/*'],
  main(ctx) {
    const logRepoState = () => {
      const repo = parseGitHubRepo(location.href);
      console.log('[Stackyard] repo detection:', location.href, '->', repo);
    };

    logRepoState();
    ctx.addEventListener(window, 'wxt:locationchange', logRepoState);

    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: () => (parseGitHubRepo(location.href) ? REPO_HEADER_ACTIONS_SELECTOR : null),
      tag: 'li',
      onMount: (wrapper) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-sm btn';
        button.setAttribute('aria-label', 'Open a live preview of this repository');
        button.innerHTML =
          '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" style="margin-right: 4px;"><path d="M4 2l10 6-10 6V2z"></path></svg>Preview';
        button.addEventListener('click', () => {
          const repo = parseGitHubRepo(location.href);
          if (!repo) return;
          // Content scripts don't have access to browser.tabs (privileged
          // API, background-only), so ask the background script to open it.
          const message: OpenPreviewMessage = {
            type: OPEN_PREVIEW_MESSAGE,
            url: buildPreviewUrl(repo),
          };
          browser.runtime.sendMessage(message);
        });
        wrapper.append(button);
        return button;
      },
    });

    ui.autoMount();

    // GitHub's signed-in header is a React island that periodically
    // re-renders its own children (e.g. refreshing star/watch counts)
    // without removing the header container itself. That wipes our button
    // out from underneath autoMount, which only reacts to the container
    // itself appearing/disappearing. Watch for our button specifically
    // getting detached and re-inject it when that happens.
    //
    // Deliberately not using ui.remove() here: WXT's remove() also calls
    // stopAutoMount() internally, which would permanently kill autoMount's
    // own watcher the first time this fires. Clear the wrapper directly
    // instead and re-run mount() (which can safely be called repeatedly).
    const reinjectIfDetached = () => {
      if (!parseGitHubRepo(location.href) || !ui.mounted || ui.wrapper.isConnected) return;
      ui.wrapper.replaceChildren();
      try {
        ui.mount();
      } catch {
        // Anchor element is mid-re-render and briefly missing; the next
        // mutation event will retry.
      }
    };
    const detachmentObserver = new MutationObserver(reinjectIfDetached);
    detachmentObserver.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => detachmentObserver.disconnect());
  },
});
