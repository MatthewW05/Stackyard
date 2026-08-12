import { storage } from 'wxt/utils/storage';

// Holds the Device Flow access token once signed in, so the background
// script's GitHub relay handler can use it automatically - the hosted page
// never sees it. See roadmap Phase 3, feature/github-oauth-device-flow.
export const githubTokenStorage = storage.defineItem<string | null>('local:githubToken', {
  defaultValue: null,
});
