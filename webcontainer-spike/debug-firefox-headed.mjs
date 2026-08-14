import { firefox } from 'playwright';

const mode = process.argv[2] ?? 'credentialless';
const port = mode === 'credentialless' ? 5272 : 5271;
const outPath = process.argv[3];

const browser = await firefox.launch({ headless: false });
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });

await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(20000); // generous wait
await page.screenshot({ path: outPath });
console.log('boot:', await page.locator('#boot-status').textContent().catch(() => 'n/a'));
await browser.close();
