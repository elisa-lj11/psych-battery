// Comprehensive light-mode audit. Uses force:true and JS state setting to
// reliably open every UI surface.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TARGET = process.env.TARGET || "http://localhost:3131";
const OUT_DIR = path.resolve(__dirname, "screenshots/audit");
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

async function snap(page, name, full = false) {
  await page.screenshot({
    path: path.join(OUT_DIR, name + ".png"),
    fullPage: full,
  });
  console.log("saved", name + (full ? " (full)" : ""));
}

async function hideSplash(page) {
  await page.evaluate(() => {
    const splash = document.getElementById("intro-splash");
    if (splash) {
      splash.hidden = true;
      splash.style.display = "none";
    }
    document.body.classList.remove("sheet-open");
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(TARGET).origin,
          localStorage: [
            { name: "pb_intro_seen", value: "1" },
            { name: "pb_first_visit_seen", value: "1" },
            { name: "pb_tour_done", value: "1" },
            { name: "pb_demo_profile", value: "maya" },
            { name: "pb_theme", value: "light" },
          ],
        },
      ],
    },
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGE ERR:", e.message));

  // ========== LAYER 0
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await hideSplash(page);
  await snap(page, "01-layer0");

  // ========== ENERGY rating sheet
  await page.click("#energy-btn", { force: true });
  await page.waitForTimeout(500);
  await snap(page, "02-rating-energy");

  // ========== STRESS rating sheet — switch tab via tab-btn
  await page.evaluate(() => {
    const stressTab = document.querySelector(
      '.tab-btn[data-kind="stress_rating"]',
    );
    if (stressTab) stressTab.click();
  });
  await page.waitForTimeout(300);
  await snap(page, "03-rating-stress");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ========== RECOVERY sheet (picker)
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await hideSplash(page);
  await page.click("#recovery-trigger", { force: true });
  await page.waitForTimeout(500);
  await snap(page, "04-recovery-picker");

  // ========== RECOVERY timer-mode start (breath)
  await page.click('[data-activity-id="breath"]', { force: true });
  await page.waitForTimeout(400);
  await snap(page, "05-recovery-timer-start");

  // ========== RECOVERY toggle/go-home start
  await page
    .click("[data-recovery-back], #recovery-back", { force: true })
    .catch(() => {});
  await page.waitForTimeout(300);
  await page
    .click('[data-activity-id="home"]', { force: true })
    .catch(() => {});
  await page.waitForTimeout(400);
  await snap(page, "06-recovery-toggle-start");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ========== CALIBRATION / TUNE — trigger via JS (button is in More menu)
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await hideSplash(page);
  await page.evaluate(() => {
    const m =
      document.getElementById("calib-modal") ||
      document.querySelector(".calib-modal");
    if (m) {
      m.hidden = false;
      m.style.display = "flex";
    }
    if (typeof openCalibModal === "function") openCalibModal();
  });
  await page.waitForTimeout(400);
  await snap(page, "07-calibration");
  await snap(page, "07b-calibration-full", true);
  // Close via cancel button or hide modal manually
  await page.evaluate(() => {
    const m =
      document.getElementById("calib-modal") ||
      document.querySelector(".calib-modal");
    if (m) {
      m.hidden = true;
      m.style.display = "none";
    }
  });
  await page.waitForTimeout(200);

  // ========== LAYER 1 — fresh page so calibration modal residue is gone
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await hideSplash(page);
  await page.click("#battery-toggle", { force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await snap(page, "08-layer1");

  // ========== LAYER 2 (diagnostics)
  await page.click("#open-diagnostics", { force: true });
  await page.waitForTimeout(600);
  await snap(page, "09-layer2-top");
  await snap(page, "09b-layer2-full", true);

  // Open the legacy/raw diagnostics dropdown
  await page.evaluate(() => {
    const d = document.getElementById("legacy-breakdown");
    if (d) d.open = true;
  });
  await page.waitForTimeout(300);
  await snap(page, "11-layer2-raw-diagnostics-open");
  await snap(page, "11b-layer2-raw-diagnostics-full", true);

  await page.click("#collapse-btn", { force: true }).catch(() => {});
  await page.waitForTimeout(300);

  // ========== DEMO grid
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await hideSplash(page);
  await page.evaluate(() => {
    if (typeof enterDemoMode === "function") enterDemoMode();
  });
  await page.waitForTimeout(500);
  await snap(page, "12-demo-grid");
  await snap(page, "12b-demo-grid-full", true);

  // ========== DEMO help dialog
  await page.click("[data-demo-help]", { force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await snap(page, "13-demo-help");
  await page.click("[data-demo-help-close]", { force: true }).catch(() => {});
  await page.waitForTimeout(200);

  // ========== DEMO activity (recovery: outside)
  await page
    .click('[data-demo-activity="outside"]', { force: true })
    .catch(() => {});
  await page.waitForTimeout(700);
  await snap(page, "14-demo-activity-outside");
  await snap(page, "14b-demo-activity-outside-full", true);

  // ========== DEMO activity (drain: zoom)
  await page.click("[data-demo-back]", { force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await page
    .click('[data-demo-activity="zoom"]', { force: true })
    .catch(() => {});
  await page.waitForTimeout(700);
  await snap(page, "15-demo-activity-zoom");

  await browser.close();
})().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
