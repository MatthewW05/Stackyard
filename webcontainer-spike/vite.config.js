import { defineConfig, loadEnv } from 'vite';

// COEP_MODE comes from .env.require-corp / .env.credentialless via Vite's
// --mode flag (see package.json scripts) rather than a shell env var, so
// this works the same in PowerShell and POSIX shells.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      headers: {
        'Cross-Origin-Embedder-Policy': env.VITE_COEP_MODE,
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  };
});
