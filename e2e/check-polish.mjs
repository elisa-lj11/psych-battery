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
  await p.waitForTimeout(700);
  return p;
}

// ── Readout labels + phase portrait (light) ──
{
  const p = await freshPage(1200, 900, "editorial");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById("open-diagnostics")?.click());
  await p.waitForTimeout(900);

  await p.evaluate(() =>
    document.getElementById("layer2-readout")?.scrollIntoView(),
  );
  await p.waitForTimeout(300);
  await p.screenshot({ path: "e2e/screenshots/verify2/readout-labels.png" });
  console.log("📸 readout-labels");

  await p.evaluate(() =>
    document.querySelector(".phase-portrait-section")?.scrollIntoView(),
  );
  await p.waitForTimeout(400);
  await p.screenshot({
    path: "e2e/screenshots/verify2/phase-portrait-check.png",
  });
  console.log("📸 phase-portrait-check");
  await p.close();
}

// ── Demo timeline seeded (sam profile) ──
{
  const p = await freshPage(900, 900, "editorial");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(400);
  // Enter interactive demo
  await p.evaluate(() => {
    if (typeof enterDemoMode === "function") enterDemoMode();
  });
  await p.waitForTimeout(800);
  await p.screenshot({
    path: "e2e/screenshots/verify2/demo-timeline-seeded.png",
  });
  console.log("📸 demo-timeline-seeded");
  await p.close();
}

// ── Demo timeline with maya profile ──
{
  const p = await freshPage(900, 900, "editorial");
  await p.evaluate(() => {
    localStorage.setItem("pb_demo_profile", "maya");
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    if (typeof enterDemoMode === "function") enterDemoMode();
  });
  await p.waitForTimeout(800);
  await p.screenshot({
    path: "e2e/screenshots/verify2/demo-timeline-maya.png",
  });
  console.log("📸 demo-timeline-maya");

  // Check the light/dark toggle button is present
  const toggleBtn = await p.$("[data-demo-theme-toggle]");
  console.log("theme toggle present:", toggleBtn !== null);
  await p.close();
}

// ── Phase portrait dark theme ──
{
  const p = await freshPage(1200, 900, "editorial-dark");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById("open-diagnostics")?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() =>
    document.querySelector(".phase-portrait-section")?.scrollIntoView(),
  );
  await p.waitForTimeout(400);
  await p.screenshot({
    path: "e2e/screenshots/verify2/phase-portrait-dark.png",
  });
  console.log("📸 phase-portrait-dark");
  await p.close();
}

await b.close();
console.log("done");
