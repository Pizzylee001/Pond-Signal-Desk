import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const outDir = resolve(process.cwd(), 'public/screenshots');
mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--window-size=1440,960'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });

  const routes = [
    { url: 'https://pondsignaldesk.vercel.app/', name: '01-warm-signal-sdr.png' },
    { url: 'https://pondsignaldesk.vercel.app/debrief', name: '02-deal-debrief-studio.png' },
    { url: 'https://pondsignaldesk.vercel.app/crm', name: '03-crm-sheet.png' },
    { url: 'https://pondsignaldesk.vercel.app/spec', name: '04-spec-verifier-n8n.png' },
  ];

  for (const item of routes) {
    console.log(`Navigating to ${item.url}...`);
    await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    console.log(`Capturing ${item.name}...`);
    await page.screenshot({ path: `${outDir}/${item.name}`, fullPage: false });
  }

  console.log('All screenshots captured successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
