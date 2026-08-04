const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_INTERVAL_MS = 50;

/**
 * True once the extension-marker content script
 * (entrypoints/extension-marker.content.ts) has set its DOM attribute on
 * this page. This is a UX nudge, not a security boundary - see
 * WEBCONTAINER_SPIKE_NOTES.md / roadmap for why that's fine here.
 */
export function isExtensionMarkerPresent(): boolean {
  return document.documentElement.dataset.stackyardExtensionInstalled === 'true';
}

/**
 * Polls checkPresent until it returns true or timeoutMs elapses. The marker
 * content script runs at document_start, so on a real page checkPresent()
 * is already true on the first call - the grace period only covers browser
 * timing edge cases, not the common case.
 */
export function waitForExtensionMarker(
  checkPresent: () => boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const check = () => {
      if (checkPresent()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(check, intervalMs);
    };

    check();
  });
}
