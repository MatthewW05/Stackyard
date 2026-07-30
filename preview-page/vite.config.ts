import { defineConfig } from 'vite';

// COOP/COEP make this page cross-origin isolated, which is required for
// SharedArrayBuffer and therefore WebContainer.boot(). See
// WEBCONTAINER_SPIKE_NOTES.md - confirmed via curl -I, not just config
// presence. These only apply to the dev server; production headers are
// set separately via vercel.json.
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
