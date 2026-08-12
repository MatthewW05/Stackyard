import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { startSignIn, cancelSignIn, runPollTick } from './deviceFlowOrchestrator';
import {
  githubTokenStorage,
  deviceFlowStatusStorage,
  deviceFlowPollStateStorage,
  type DeviceFlowPollState,
} from './githubAuth';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('deviceFlowOrchestrator', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('startSignIn', () => {
    it('records poll state and awaiting-user status, passing the real interval straight through', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      );

      const result = await startSignIn('client-abc');

      expect(result).toEqual({
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
        nextPollDelaySeconds: 5,
      });
      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({
        phase: 'awaiting-user',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
      });
      const pollState = await deviceFlowPollStateStorage.getValue();
      expect(pollState).toMatchObject({
        clientId: 'client-abc',
        deviceCode: 'device-123',
        intervalSeconds: 5,
      });
    });
  });

  describe('cancelSignIn', () => {
    it('clears poll state and resets status to idle', async () => {
      await deviceFlowPollStateStorage.setValue({
        clientId: 'client-abc',
        deviceCode: 'device-123',
        intervalSeconds: 5,
        expiresAt: Date.now() + 900_000,
      });
      await deviceFlowStatusStorage.setValue({
        phase: 'awaiting-user',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
      });

      await cancelSignIn();

      await expect(deviceFlowPollStateStorage.getValue()).resolves.toBeNull();
      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({ phase: 'idle' });
    });
  });

  describe('runPollTick', () => {
    async function seedPollState(overrides: Partial<DeviceFlowPollState> = {}) {
      await deviceFlowPollStateStorage.setValue({
        clientId: 'client-abc',
        deviceCode: 'device-123',
        intervalSeconds: 5,
        expiresAt: Date.now() + 900_000,
        ...overrides,
      });
    }

    it('is a no-op when there is no in-progress sign-in', async () => {
      await expect(runPollTick()).resolves.toEqual({ done: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stores the token and finishes on success', async () => {
      await seedPollState();
      fetchMock.mockResolvedValue(jsonResponse({ access_token: 'gho_token' }));

      await expect(runPollTick()).resolves.toEqual({ done: true });

      await expect(githubTokenStorage.getValue()).resolves.toBe('gho_token');
      await expect(deviceFlowPollStateStorage.getValue()).resolves.toBeNull();
      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({ phase: 'idle' });
    });

    it('reschedules at the stored interval on authorization_pending', async () => {
      await seedPollState({ intervalSeconds: 5 });
      fetchMock.mockResolvedValue(jsonResponse({ error: 'authorization_pending' }));

      await expect(runPollTick()).resolves.toEqual({ done: false, nextPollDelaySeconds: 5 });
      // Poll state (and the wait for the user) is still in progress.
      await expect(deviceFlowPollStateStorage.getValue()).resolves.not.toBeNull();
    });

    it('guards against a non-positive interval instead of scheduling a zero/negative delay', async () => {
      await seedPollState({ intervalSeconds: 0 });
      fetchMock.mockResolvedValue(jsonResponse({ error: 'authorization_pending' }));

      await expect(runPollTick()).resolves.toEqual({ done: false, nextPollDelaySeconds: 1 });
    });

    it('updates the stored interval and reschedules on slow_down', async () => {
      await seedPollState({ intervalSeconds: 5 });
      fetchMock.mockResolvedValue(jsonResponse({ error: 'slow_down', interval: 90 }));

      await expect(runPollTick()).resolves.toEqual({ done: false, nextPollDelaySeconds: 90 });

      const pollState = await deviceFlowPollStateStorage.getValue();
      expect(pollState?.intervalSeconds).toBe(90);
    });

    it('finishes with an error status on expired_token', async () => {
      await seedPollState();
      fetchMock.mockResolvedValue(jsonResponse({ error: 'expired_token' }));

      await expect(runPollTick()).resolves.toEqual({ done: true });

      await expect(deviceFlowPollStateStorage.getValue()).resolves.toBeNull();
      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({
        phase: 'error',
        message: expect.stringMatching(/expired/i),
      });
    });

    it('finishes with an error status on access_denied', async () => {
      await seedPollState();
      fetchMock.mockResolvedValue(jsonResponse({ error: 'access_denied' }));

      await expect(runPollTick()).resolves.toEqual({ done: true });

      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({
        phase: 'error',
        message: expect.stringMatching(/declined/i),
      });
    });

    it('finishes with an error status once the client-side deadline passes, without polling GitHub again', async () => {
      await seedPollState({ expiresAt: Date.now() - 1000 });

      await expect(runPollTick()).resolves.toEqual({ done: true });

      expect(fetchMock).not.toHaveBeenCalled();
      await expect(deviceFlowStatusStorage.getValue()).resolves.toEqual({
        phase: 'error',
        message: expect.stringMatching(/expired/i),
      });
    });

    it('finishes with an error status when the request itself fails', async () => {
      await seedPollState();
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(runPollTick()).resolves.toEqual({ done: true });

      await expect(deviceFlowPollStateStorage.getValue()).resolves.toBeNull();
      const status = await deviceFlowStatusStorage.getValue();
      expect(status.phase).toBe('error');
    });
  });
});
