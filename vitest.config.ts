import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// preview-page/ and webcontainer-spike/ are separate sub-projects with their
// own package.json and dependencies (see preview-page/package.json) - their
// own test files are run from within those directories, not from here.
export default defineConfig({
  // Resolves the @/ import alias and provides `browser` as an in-memory
  // fakeBrowser (real chrome.storage.local, but browser.alarms is not
  // implemented - see utils/deviceFlowOrchestrator.ts, which is written to
  // avoid calling it directly so its logic stays testable here).
  plugins: [WxtVitest()],
  test: {
    exclude: ['**/node_modules/**', '.output/**', 'preview-page/**', 'webcontainer-spike/**'],
  },
});
