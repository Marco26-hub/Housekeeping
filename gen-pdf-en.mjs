import puppeteer from 'puppeteer';
import path from 'path';

const browser = await puppeteer.launch({headless: true});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900});

const filePath = path.resolve('/Users/md/pulizie srl/brochure-en.html');
await page.goto(`file://${filePath}`, {waitUntil: 'networkidle0', timeout: 30000});

await page.evaluateHandle('document.fonts.ready');
await new Promise(r => setTimeout(r, 3000));

await page.emulateMediaType('print');
await page.evaluate(() => {
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) toolbar.style.display = 'none';
});

await page.pdf({
  path: '/Users/md/pulizie srl/brochure-en.pdf',
  format: 'A4',
  printBackground: true,
  margin: {top: '0', right: '0', bottom: '0', left: '0'},
  preferCSSPageSize: true
});

await browser.close();
console.log('EN PDF generated.');
