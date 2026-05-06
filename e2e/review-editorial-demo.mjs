/**
 * Editorial theme × demo mode walkthrough.
 * Applies the editorial theme first, then screenshots every demo surface.
 * Usage: node e2e/review-editorial-demo.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "screenshots", "editorial-demo");
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "http://localhost:3131";
const consoleErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(BASE, { waitUntil: "networkidle" });

// Dismiss splash
try {
  await page.locator("#intro-splash").waitFor({ timeout: 3000 });
  await page.locator('[data-intro-action="skip"]').click();
  await page
    .locator("#intro-splash")
    .waitFor({ state: "hidden", timeout: 3000 });
} catch {}

// Apply editorial theme via localStorage + body attribute
await page.evaluate(() => {
  localStorage.setItem("pb_theme", "editorial");
  document.body.dataset.theme = "editorial";
});
await page.waitForTimeout(300);

// Screenshot: layer 0 in editorial (base app before demo)
await page.screenshot({ path: path.join(SHOTS, "00-editorial-layer0.png") });

// Enter demo mode
await page.evaluate(() => {
  const btn = document.querySelector("#demo-toggle-btn");
  if (btn) btn.click();
});
await page.waitForFunction(() => document.body.classList.contains("is-demo"), {
  timeout: 5000,
});
await page.waitForTimeout(600);

// Screenshot: demo grid in editorial
await page.screenshot({ path: path.join(SHOTS, "01-editorial-demo-grid.png") });

// Inspect the demo grid cards for visual issues
const gridInfo = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll("[data-demo-activity]"));
  return cards.map((c) => {
    const cs = getComputedStyle(c);
    return {
      id: c.dataset.demoActivity,
      borderRadius: cs.borderRadius,
      background: cs.background.slice(0, 60),
      boxShadow: cs.boxShadow.slice(0, 80),
    };
  });
});
console.log("\n[GRID CARDS computed styles]");
gridInfo.forEach((c) => console.log(JSON.stringify(c)));

// Screenshot the demo grid detail panel (right side)
const detailPanel = await page
  .locator(".demo-detail-panel, .demo-right, .demo-panel-right")
  .first();
if (await detailPanel.isVisible().catch(() => false)) {
  const box = await detailPanel.boundingBox();
  if (box) {
    await page.screenshot({
      path: path.join(SHOTS, "01b-editorial-demo-grid-panel.png"),
      clip: box,
    });
  }
}

// Try each profile
const profiles = ["sam", "maya", "alex", "jordan"];
for (const profile of profiles) {
  await page.evaluate((p) => {
    const sel = document.querySelector("#demo-select");
    if (sel) {
      sel.value = p;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, profile);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(SHOTS, `02-editorial-profile-${profile}.png`),
  });
}

// Get all activity IDs
const activityIds = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-demo-activity]")).map(
    (c) => c.dataset.demoActivity,
  ),
);
console.log("\nActivities found:", activityIds.join(", "));

// Click each activity card
for (let i = 0; i < activityIds.length; i++) {
  const id = activityIds[i];

  await page.evaluate((actId) => {
    const card = document.querySelector(`[data-demo-activity="${actId}"]`);
    card?.click();
  }, id);

  try {
    await page.locator(".demo-scene-svg").waitFor({ timeout: 3000 });
    await page.waitForTimeout(500);

    // Full page screenshot
    await page.screenshot({
      path: path.join(
        SHOTS,
        `${String(i + 3).padStart(2, "0")}-${id}-full.png`,
      ),
    });

    // Crop just the scene area
    const sceneBox = await page.locator(".demo-scene-svg").boundingBox();
    if (sceneBox) {
      await page.screenshot({
        path: path.join(
          SHOTS,
          `${String(i + 3).padStart(2, "0")}-${id}-scene.png`,
        ),
        clip: {
          x: sceneBox.x - 8,
          y: sceneBox.y - 8,
          width: sceneBox.width + 16,
          height: sceneBox.height + 16,
        },
      });
    }

    // Inspect the scene frame container for editorial styles
    const frameInfo = await page.evaluate(() => {
      const frame = document.querySelector(".demo-scene-frame");
      const footer = document.querySelector(".demo-scene-footer");
      const backBtn = document.querySelector(".demo-back-btn");
      const cs = frame ? getComputedStyle(frame) : {};
      const bcs = backBtn ? getComputedStyle(backBtn) : {};
      return {
        frameBorderRadius: cs.borderRadius,
        frameBackground: (cs.background || "").slice(0, 80),
        backBtnBorderRadius: bcs.borderRadius,
        backBtnBackground: (bcs.background || "").slice(0, 60),
        backBtnColor: bcs.color,
      };
    });
    console.log(`\n[${id}] frame styles:`, JSON.stringify(frameInfo));
  } catch (e) {
    console.log(`[${id}] ERROR:`, e.message.slice(0, 120));
  }

  // Go back
  await page.evaluate(() => {
    const btn = document.querySelector("[data-demo-back], #demo-back-btn");
    if (btn) btn.click();
    else
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  await page.waitForTimeout(300);
}

// Screenshot demo grid again after all activities (state check)
await page.screenshot({ path: path.join(SHOTS, "99-editorial-demo-end.png") });

// Check timeline SVG
const timelineInfo = await page.evaluate(() => {
  const svg = document.querySelector(".demo-timeline-svg");
  if (!svg) return null;
  return {
    viewBox: svg.getAttribute("viewBox"),
    preserveAspectRatio: svg.getAttribute("preserveAspectRatio"),
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
    pathCount: svg.querySelectorAll("path, polyline, line").length,
  };
});
console.log("\n[TIMELINE SVG]", JSON.stringify(timelineInfo));

// Overall body computed style check
const bodyStyles = await page.evaluate(() => {
  const cs = getComputedStyle(document.body);
  return {
    background: cs.background.slice(0, 120),
    fontFamily: cs.fontFamily.slice(0, 60),
  };
});
console.log("\n[BODY editorial styles]", JSON.stringify(bodyStyles));

await browser.close();

console.log(`\nConsole errors (${consoleErrors.length}):`);
consoleErrors
  .filter((e) => !e.includes("Failed to fetch"))
  .forEach((e) => console.log(" ", e));
console.log(`\nScreenshots saved to ${SHOTS}`);
