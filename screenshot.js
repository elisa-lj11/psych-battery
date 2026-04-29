/**
 * screenshot.js — Playwright visual checker for psych-battery-app
 *
 * Usage:
 *   node screenshot.js [--url URL] [--profile PROFILE] [--width W] [--height H] [--out FILE] [--full-page]
 *
 * Defaults:
 *   url       http://localhost:3131
 *   profile   sam  (one of: sam | maya | alex | jordan)
 *   width     390  (iPhone-size mobile)
 *   height    844
 *   out       screenshots/out.png
 *
 * Examples:
 *   node screenshot.js
 *   node screenshot.js --profile maya --out screenshots/maya.png
 *   node screenshot.js --width 1280 --height 900 --out screenshots/desktop.png
 *   node screenshot.js --url https://psych-battery.vercel.app --profile jordan
 *   node screenshot.js --full-page --out screenshots/full.png
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get  = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const flag = (f) => args.includes(f);

const TARGET   = get('--url',     'http://localhost:3131');
const PROFILE  = get('--profile', 'sam');
const WIDTH    = parseInt(get('--width',  '390'), 10);
const HEIGHT   = parseInt(get('--height', '844'), 10);
const OUT      = get('--out', 'screenshots/out.png');
const FULLPAGE = flag('--full-page');

fs.mkdirSync(path.dirname(OUT), { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx     = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    // Pre-seed localStorage so the app knows which demo profile to load
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(TARGET).origin,
        localStorage: [{ name: 'pb_demo_profile', value: PROFILE }]
      }]
    }
  });
  const page = await ctx.newPage();

  console.log(`→ opening ${TARGET} …`);
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Click the "Interactive Demo" button to enter demo mode
  const demoBtn = page.locator('#demo-toggle-btn');
  await demoBtn.waitFor({ state: 'visible', timeout: 5000 });
  await demoBtn.click();
  console.log(`→ demo mode entered (profile: ${PROFILE})`);

  // Wait for the demo shell to render
  await page.waitForSelector('#demo-shell:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(800);   // let animations settle

  await page.screenshot({ path: OUT, fullPage: FULLPAGE });
  console.log(`✓ screenshot saved → ${OUT}  (${WIDTH}×${HEIGHT})`);

  await browser.close();
})().catch(err => {
  console.error('✗', err.message);
  process.exit(1);
});
