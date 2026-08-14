import { firefox } from 'playwright';

const browser = await firefox.launch({ headless: false });
const page = await browser.newPage();
page.on('response', (res) => {
  if (res.url().includes('3111') || res.url().includes('no-server')) {
    console.log('[response]', res.status(), res.url());
  }
});
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));

await page.goto('http://localhost:5271/'); // require-corp

for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(5000);
  console.log(`--- t=${(i + 1) * 5}s ---`);
}

await page.screenshot({ path: process.argv[2] });
await browser.close();
