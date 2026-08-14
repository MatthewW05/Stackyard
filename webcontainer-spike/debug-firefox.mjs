import { firefox } from 'playwright';

const browser = await firefox.launch();
const page = await browser.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
page.on('response', (res) => {
  if (res.url().includes('placehold') || res.url().includes('avatars') || res.url().includes('3111')) {
    console.log('[response]', res.status(), res.url());
  }
});
page.on('frameattached', (f) => console.log('[frameattached]', f.url()));
page.on('framenavigated', (f) => console.log('[framenavigated]', f.url()));

await page.goto('http://localhost:5272/');
await page.waitForTimeout(10000);
console.log('preview src:', await page.locator('#preview').getAttribute('src'));
await page.waitForTimeout(8000);

const frames = page.frames();
console.log('frame count:', frames.length);
for (const f of frames) {
  console.log('frame url:', f.url());
}

const frame = page.frameLocator('#preview');
console.log('control:', await frame.locator('#control-status').textContent({ timeout: 5000 }).catch((e) => 'ERR: ' + e.message.split('\n')[0]));
console.log('test:', await frame.locator('#test-status').textContent({ timeout: 5000 }).catch((e) => 'ERR: ' + e.message.split('\n')[0]));

await browser.close();
