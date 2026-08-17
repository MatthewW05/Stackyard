import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: {
    eslintrc: {
      enabled: 9,
    },
  },
  manifest: {
    name: 'Stackyard',
    description: 'Preview any public GitHub repo running live, right from its repo page.',
    // Needed for the OAuth Device Flow endpoints (login/device/code,
    // login/oauth/access_token): unlike api.github.com, they don't send
    // permissive CORS headers, so a plain fetch from an extension page would
    // be blocked without this. host_permissions lets extension-context
    // fetches to a matching origin bypass CORS entirely. See roadmap Phase 3,
    // feature/github-oauth-device-flow.
    host_permissions: ['https://github.com/*'],
    // 'storage' is required for wxt/storage (chrome.storage.local), used to
    // persist the signed-in GitHub token - see utils/githubAuth.ts. 'alarms'
    // drives the Device Flow poll loop from the background script instead of
    // an in-page timer - see utils/deviceFlowOrchestrator.ts.
    permissions: ['storage', 'alarms'],
    // Required by AMO as of Nov 2025: disclose what user data the extension
    // sends off-device. The only such data is the GitHub OAuth token, sent
    // to GitHub's own API in Authorization headers - and only if the user
    // opts into signing in (see entrypoints/popup/SignInView.tsx), so it's
    // optional rather than required.
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ['none'],
          optional: ['authenticationInfo'],
        },
      },
    },
  },
});
