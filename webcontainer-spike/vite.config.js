import { defineConfig } from 'vite';

// COOP/COEP make this page "cross-origin isolated", which is what unlocks
// SharedArrayBuffer — WebContainers need it for their in-browser filesystem/runtime.
// See ../webcontainer-spike/NOTES.md for why these two specific values.
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
