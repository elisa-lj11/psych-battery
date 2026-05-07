import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("./e2e/screenshots/verify", { recursive: true });

const b = await chromium.launch({ headless: true });

async function shot(page, name) {
  await page.screenshot({ path: `e2e/screenshots/verify/${name}.png` });
  console.log(`  📸 ${name}`);
}

async function fresh(page, theme = "editorial") {
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_tour_done", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

// ── Mobile (480px) ────────────────────────────────────────────────────────────
const mobile = await (
  await b.newContext({ viewport: { width: 480, height: 900 } })
).newPage();
await mobile.goto("http://localhost:3131", { waitUntil: "networkidle" });

// 1. Dock buttons + toggle switch
await fresh(mobile);
await shot(mobile, "01-dock-and-toggle-mobile");

// 2. Demo home — batteries side-by-side
await fresh(mobile);
await mobile.evaluate(() => {
  document.getElementById("demo-dropdown").open = true;
});
await mobile.waitForTimeout(200);
await mobile.click("#demo-toggle-btn");
await mobile.waitForTimeout(800);
await shot(mobile, "02-demo-home-batteries-mobile");

const bp = await mobile.$(".demo-battery-pair");
const tp = await mobile.$(".demo-timeline-pane");
const bb = await bp?.boundingBox();
const tb = await tp?.boundingBox();
console.log(`  Batteries: y=${bb?.y?.toFixed(0)} h=${bb?.height?.toFixed(0)}`);
console.log(`  Timeline:  y=${tb?.y?.toFixed(0)} h=${tb?.height?.toFixed(0)}`);
console.log(`  Y-diff: ${Math.abs((bb?.y ?? 0) - (tb?.y ?? 0)).toFixed(0)}px`);

// 3. Demo activity view — batteries side-by-side
const cards = await mobile.$$("[data-demo-activity]");
if (cards[0]) {
  await cards[0].click();
  await mobile.waitForTimeout(800);
  await shot(mobile, "03-demo-activity-batteries-mobile");
  const ab = await mobile.$(".demo-battery-pair");
  const at = await mobile.$(".demo-timeline-pane");
  const abb = await ab?.boundingBox();
  const atb = await at?.boundingBox();
  console.log(
    `  Activity batteries: y=${abb?.y?.toFixed(0)} h=${abb?.height?.toFixed(0)}`,
  );
  console.log(
    `  Activity timeline:  y=${atb?.y?.toFixed(0)} h=${atb?.height?.toFixed(0)}`,
  );
}

// ── Desktop (1280px) ──────────────────────────────────────────────────────────
const desk = await (
  await b.newContext({ viewport: { width: 1280, height: 900 } })
).newPage();
await desk.goto("http://localhost:3131", { waitUntil: "networkidle" });

// 4. State tanks side-by-side
await fresh(desk);
await desk.click("#battery-toggle");
await desk.waitForTimeout(800);
await desk.evaluate(() => {
  const el = document.querySelector(".layer2-viz-row");
  if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
});
await desk.waitForTimeout(300);
await shot(desk, "04-state-tanks-desktop");

const sc = await desk.$(".layer2-system-card");
const me = await desk.$(".layer2-model-explain");
const sb = await sc?.boundingBox();
const mb = await me?.boundingBox();
console.log(
  `  State tanks:   y=${sb?.y?.toFixed(0)} h=${sb?.height?.toFixed(0)}`,
);
console.log(
  `  Model explain: y=${mb?.y?.toFixed(0)} h=${mb?.height?.toFixed(0)}`,
);

// 5. Demo desktop batteries
await fresh(desk);
await desk.evaluate(() => {
  document.getElementById("demo-dropdown").open = true;
});
await desk.waitForTimeout(200);
await desk.click("#demo-toggle-btn");
await desk.waitForTimeout(800);
await shot(desk, "05-demo-home-batteries-desktop");

await b.close();
console.log("All done");
