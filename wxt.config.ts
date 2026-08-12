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
  },
});
