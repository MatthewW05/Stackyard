import { chromium, firefox } from 'playwright';
import path from 'node:path';

const SCREENSHOT_DIR =
  process.argv[2] ??
  'C:\\Users\\Matthew\\AppData\\Local\\Temp\\claude\\c--Users-Matthew-Desktop-Projects-Stackyard\\186dbe31-f575-4b1a-995c-bab27cc383a0\\scratchpad\\screenshots';

const targets = [
  { browserName: 'chromium', launch: chromium, mode: 'require-corp', url: 'http://localhost:5271/' },
  { browserName: 'chromium', launch: chromium, mode: 'credentialless', url: 'http://localhost:5272/' },
  { browserName: 'firefox', launch: firefox, mode: 'require-corp', url: 'http://localhost:5271/' },
  { browserName: 'firefox', launch: firefox, mode: 'credentialless', url: 'http://localhost:5272/' },
];

async function waitForTerminal(locator, isTerminal, timeout) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await locator.textContent({ timeout: 1000 });
    } catch {
      last = null;
    }
    if (last && isTerminal(last)) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  return last ? `${last} (timed out)` : '(timed out, no text)';
}

async function waitForPreviewSrc(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const src = await page.locator('#preview').getAttribute('src').catch(() => null);
    if (src) return src;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const results = [];

for (const target of targets) {
  const browser = await target.launch.launch({ headless: false });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(target.url);

  const coi = await page.locator('#coi').textContent();
  const installStatus = await waitForTerminal(
    page.locator('#install-status'),
    (t) => t === 'npm install done' || t.includes('failed') || t.startsWith('error'),
    60000,
  );

  let previewSrc = null;
  let controlStatus = 'n/a (install failed)';
  let testStatus = 'n/a (install failed)';

  if (installStatus === 'npm install done') {
    previewSrc = await waitForPreviewSrc(page, 30000);
    if (previewSrc) {
      // Give the proxy/server extra settle time before reading iframe content.
      await page.waitForTimeout(4000);
      const frame = page.frameLocator('#preview');
      controlStatus = await waitForTerminal(
        frame.locator('#control-status'),
        (t) => t.includes('loaded') || t.includes('blocked'),
        15000,
      );
      testStatus = await waitForTerminal(
        frame.locator('#test-status'),
        (t) => t.includes('loaded') || t.includes('blocked'),
        15000,
      );
    } else {
      controlStatus = 'n/a (server-ready never fired)';
      testStatus = 'n/a (server-ready never fired)';
    }
  }

  const screenshotPath = path.join(SCREENSHOT_DIR, `${target.browserName}-${target.mode}.png`);
  await page.screenshot({ path: screenshotPath });

  results.push({
    browser: target.browserName,
    mode: target.mode,
    crossOriginIsolated: coi,
    installStatus,
    previewSrc,
    controlStatus,
    testStatus,
    screenshotPath,
    consoleErrors: consoleErrors.slice(0, 5),
  });

  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
