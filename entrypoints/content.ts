import { parseGitHubRepo } from '@/utils/github';

export default defineContentScript({
  matches: ['*://github.com/*'],
  main(ctx) {
    const logRepoState = () => {
      const repo = parseGitHubRepo(location.href);
      console.log('[Stackyard] repo detection:', location.href, '->', repo);
    };

    logRepoState();
    ctx.addEventListener(window, 'wxt:locationchange', logRepoState);
  },
});
