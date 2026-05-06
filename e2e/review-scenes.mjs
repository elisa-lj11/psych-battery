/**
 * Scene image quality review — screenshots every demo activity pixel-art scene.
 * Usage: node e2e/review-scenes.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "screenshots", "scenes");
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "http://localhost:3131";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

await page.goto(BASE, { waitUntil: "networkidle" });

// Dismiss splash
try {
  await page.locator("#intro-splash").waitFor({ timeout: 3000 });
  await page.locator('[data-intro-action="skip"]').click();
  await page
    .locator("#intro-splash")
    .waitFor({ state: "hidden", timeout: 3000 });
} catch {}

// Enter demo (use JS in case button is hidden behind header)
await page.evaluate(() => {
  const btn = document.querySelector("#demo-toggle-btn");
  if (btn) btn.click();
});
await page.waitForFunction(() => document.body.classList.contains("is-demo"), {
  timeout: 5000,
});
await page.waitForTimeout(600);

// Get all activity IDs
const activityIds = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-demo-activity]")).map(
    (c) => c.dataset.demoActivity,
  ),
);
console.log("Activities found:", activityIds.join(", "));

// Screenshot the demo grid overview
await page.screenshot({ path: path.join(SHOTS, "00-demo-grid.png") });

// Click each activity and screenshot the scene SVG
for (let i = 0; i < activityIds.length; i++) {
  const id = activityIds[i];
  // Click the card
  await page.evaluate((actId) => {
    const card = document.querySelector(`[data-demo-activity="${actId}"]`);
    card?.click();
  }, id);

  // Wait for the scene SVG to appear
  try {
    await page.locator(".demo-scene-svg").waitFor({ timeout: 3000 });
    await page.waitForTimeout(400); // let animations settle

    // Screenshot the entire detail panel
    await page.screenshot({
      path: path.join(
        SHOTS,
        `${String(i + 1).padStart(2, "0")}-${id}-detail.png`,
      ),
    });

    // Also crop to just the scene SVG
    const sceneBox = await page.locator(".demo-scene-svg").boundingBox();
    if (sceneBox) {
      await page.screenshot({
        path: path.join(
          SHOTS,
          `${String(i + 1).padStart(2, "0")}-${id}-scene-crop.png`,
        ),
        clip: {
          x: sceneBox.x - 4,
          y: sceneBox.y - 4,
          width: sceneBox.width + 8,
          height: sceneBox.height + 8,
        },
      });
    }

    // Inspect scene SVG children
    const sceneInfo = await page.evaluate(() => {
      const svg = document.querySelector(".demo-scene-svg");
      return {
        childCount: svg?.children.length,
        childTags: Array.from(svg?.children || []).map(
          (c) =>
            c.tagName + (c.className?.baseVal ? "." + c.className.baseVal : ""),
        ),
        hasImage: !!svg?.querySelector("image"),
        animClasses: Array.from(
          svg?.querySelectorAll("[class*='anim-']") || [],
        ).map((el) => el.className?.baseVal),
      };
    });
    console.log(`\n[${id}]`, JSON.stringify(sceneInfo, null, 2));
  } catch (e) {
    console.log(`[${id}] ERROR:`, e.message.slice(0, 100));
  }

  // Back to demo grid
  await page.evaluate(() => {
    const backBtn = document.querySelector("[data-demo-back], #demo-back-btn");
    if (backBtn) backBtn.click();
    else {
      // Try pressing Escape
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
  });
  await page.waitForTimeout(300);
}

await browser.close();
console.log(`\nScreenshots saved to ${SHOTS}`);
