import { chromium } from "playwright";
import { mkdirSync } from "fs";

mkdirSync("./e2e/screenshots/audit", { recursive: true });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:3131", { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("pb_seen_intro", "1");
  localStorage.setItem("pb_theme", "editorial");
  localStorage.setItem("pb_tour_done", "1");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

// Open layer 1
await page.click("#battery-toggle");
await page.waitForTimeout(800);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Scroll to state tanks
await page.evaluate(() => {
  const el = document.querySelector(".layer2-viz-row");
  if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
});
await page.waitForTimeout(400);
await page.screenshot({ path: "e2e/screenshots/audit/CHECK-state-tanks2.png" });
console.log("State tanks screenshot done");

// Check bounding boxes
const systemCard = await page.$(".layer2-system-card");
const modelExplain = await page.$(".layer2-model-explain");
if (systemCard && modelExplain) {
  const sb = await systemCard.boundingBox();
  const mb = await modelExplain.boundingBox();
  console.log(
    `  State tanks:    x=${sb.x.toFixed(0)} y=${sb.y.toFixed(0)} w=${sb.width.toFixed(0)} h=${sb.height.toFixed(0)}`,
  );
  console.log(
    `  Model explain:  x=${mb.x.toFixed(0)} y=${mb.y.toFixed(0)} w=${mb.width.toFixed(0)} h=${mb.height.toFixed(0)}`,
  );
  const yDiff = Math.abs(sb.y - mb.y);
  console.log(
    `  Y diff: ${yDiff.toFixed(0)}px (should be < 20 for side-by-side)`,
  );
}

// Demo batteries
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("pb_seen_intro", "1");
  localStorage.setItem("pb_theme", "editorial");
  localStorage.setItem("pb_tour_done", "1");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

const dd = await page.$("#demo-dropdown");
if (dd) {
  await page.evaluate(() => {
    document.getElementById("demo-dropdown").open = true;
  });
  await page.waitForTimeout(200);
}
const demoBtn = await page.$("#demo-toggle-btn");
if (demoBtn) {
  await demoBtn.click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: "e2e/screenshots/audit/CHECK-demo-1280.png" });
console.log("Demo screenshot done");

const bp = await page.$(".demo-battery-pair");
const tp = await page.$(".demo-timeline-pane");
if (bp && tp) {
  const bb = await bp.boundingBox();
  const tb = await tp.boundingBox();
  console.log(
    `  Battery pair:  y=${bb.y.toFixed(0)} h=${bb.height.toFixed(0)}`,
  );
  console.log(
    `  Timeline pane: y=${tb.y.toFixed(0)} h=${tb.height.toFixed(0)}`,
  );
  console.log(`  Y diff: ${Math.abs(bb.y - tb.y).toFixed(0)}px`);
}

await b.close();
console.log("Done");
