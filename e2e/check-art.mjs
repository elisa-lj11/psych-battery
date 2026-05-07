import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("./e2e/screenshots/verify2", { recursive: true });

const b = await chromium.launch({ headless: true });

async function freshPage(vw, vh, theme) {
  const p = await (
    await b.newContext({ viewport: { width: vw, height: vh } })
  ).newPage();
  await p.goto("http://localhost:3131", { waitUntil: "networkidle" });
  await p.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_tour_done", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  return p;
}

// Render each demo card and screenshot the scene frame
for (const [theme, suffix] of [
  ["editorial", "light"],
  ["editorial-dark", "dark"],
]) {
  const p = await freshPage(900, 900, theme);
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    if (typeof enterDemoMode === "function") enterDemoMode();
  });
  await p.waitForTimeout(800);

  for (const actId of ["stretch", "hydrate", "back_to_back", "after_hours"]) {
    await p.evaluate((id) => {
      const btn = document.querySelector(`[data-demo-activity="${id}"]`);
      if (btn) btn.click();
    }, actId);
    await p.waitForTimeout(1000);
    const frame = await p.$(".demo-scene-frame");
    if (frame) {
      await frame.screenshot({
        path: `e2e/screenshots/verify2/art-${actId}-${suffix}.png`,
      });
      console.log(`📸 art-${actId}-${suffix}`);
    }
    // back out
    await p.evaluate(() => {
      const back = document.querySelector("[data-demo-back]");
      if (back) back.click();
    });
    await p.waitForTimeout(500);
  }
  await p.close();
}

await b.close();
console.log("done");
