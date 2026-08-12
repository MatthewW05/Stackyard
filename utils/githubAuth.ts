import { storage } from 'wxt/utils/storage';

// Holds the Device Flow access token once signed in, so the background
// script's GitHub relay handler can use it automatically - the hosted page
// never sees it. See roadmap Phase 3, feature/github-oauth-device-flow.
export const githubTokenStorage = storage.defineItem<string | null>('local:githubToken', {
  defaultValue: null,
});

export type DeviceFlowStatus =
  | { phase: 'idle' }
  | { phase: 'awaiting-user'; userCode: string; verificationUri: string }
  | { phase: 'error'; message: string };

// What the popup renders for an in-progress sign-in. Written by the
// background script's poll orchestrator (utils/deviceFlowOrchestrator.ts);
// the popup only reads and watches it, since the popup itself doesn't
// survive the user switching away to github.com to enter the code.
export const deviceFlowStatusStorage = storage.defineItem<DeviceFlowStatus>(
  'local:githubDeviceFlowStatus',
  { defaultValue: { phase: 'idle' } },
);

export interface DeviceFlowPollState {
  clientId: string;
  deviceCode: string;
  intervalSeconds: number;
  expiresAt: number;
}

// Background-internal bookkeeping for the alarm-driven poll loop - not
// rendered directly by the popup.
export const deviceFlowPollStateStorage = storage.defineItem<DeviceFlowPollState | null>(
  'local:githubDeviceFlowPollState',
  { defaultValue: null },
);
