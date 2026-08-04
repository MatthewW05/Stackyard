import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForExtensionMarker } from './extensionGate';

describe('waitForExtensionMarker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves true immediately when the marker is already present', async () => {
    const result = waitForExtensionMarker(() => true, 500, 50);
    await expect(result).resolves.toBe(true);
  });

  it('resolves true once the marker appears within the grace period', async () => {
    let present = false;
    setTimeout(() => {
      present = true;
    }, 120);

    const result = waitForExtensionMarker(() => present, 500, 50);
    await vi.advanceTimersByTimeAsync(500);

    expect(await result).toBe(true);
  });

  it('resolves false once the timeout elapses without the marker appearing', async () => {
    const result = waitForExtensionMarker(() => false, 200, 50);
    await vi.advanceTimersByTimeAsync(200);

    expect(await result).toBe(false);
  });
});
