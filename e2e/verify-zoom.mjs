import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("./e2e/screenshots/verify2", { recursive: true });

const b = await chromium.launch({ headless: true });

async function freshPage(vw, vh, theme) {
  const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
  await p.goto("http://localhost:3131", { waitUntil: "networkidle" });
  await p.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_tour_done", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  return p;
}

// circadian chart full view
{
  const p = await freshPage(900, 600, "editorial");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById("open-diagnostics")?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById("layer2-circadian")?.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: "e2e/screenshots/verify2/circ-zoom.png" });
  console.log("circ-zoom done");
  await p.close();
}

// demo batteries close-up
{
  const p = await freshPage(600, 400, "editorial");
  await p.evaluate(() => { if (typeof enterDemoMode === "function") enterDemoMode("sam"); });
  await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector("[data-demo-battery-pair], .demo-batt-pair, [class*=batt]")?.scrollIntoView());
  await p.waitForTimeout(300);
  await p.screenshot({ path: "e2e/screenshots/verify2/batt-zoom.png", fullPage: true });
  console.log("batt-zoom done");
  await p.close();
}

await b.close();
console.log("done");
