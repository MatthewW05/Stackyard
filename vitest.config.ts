import { defineConfig } from 'vitest/config';

// preview-page/ and webcontainer-spike/ are separate sub-projects with their
// own package.json and dependencies (see preview-page/package.json) - their
// own test files are run from within those directories, not from here.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '.output/**', 'preview-page/**', 'webcontainer-spike/**'],
  },
});
