import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
page.on('response', (res) => {
  if (res.url().includes('placehold') || res.url().includes('avatars')) {
    console.log('[response]', res.status(), res.url(), JSON.stringify(res.headers()));
  }
});

await page.goto('http://localhost:5272/');
await page.waitForTimeout(8000);
console.log('preview src:', await page.locator('#preview').getAttribute('src'));
await page.waitForTimeout(6000);
const frame = page.frameLocator('#preview');
console.log('control:', await frame.locator('#control-status').textContent().catch(() => 'n/a'));
console.log('test:', await frame.locator('#test-status').textContent().catch(() => 'n/a'));
await browser.close();
