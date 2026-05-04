// One-off: snapshot the Mental Meter Layer-2 dashboard at desktop size,
// post-UI-overhaul. Skips intro + opens layers via DOM events so we don't
// fight onboarding.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TARGET = process.env.TARGET || "http://localhost:3131";
const OUT_DIR = path.resolve(__dirname, "screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

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
          ],
        },
      ],
    },
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGE ERR:", e.message));

  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // Force-close any auto-opened sheets, hide intro splash if present
  await page.evaluate(() => {
    document.querySelectorAll(".bottom-sheet").forEach((s) => {
      s.hidden = true;
      s.style.display = "none";
    });
    const splash = document.getElementById("intro-splash");
    if (splash) {
      splash.hidden = true;
      splash.style.display = "none";
    }
    document.body.classList.remove("sheet-open");
    const bd = document.getElementById("backdrop");
    if (bd) bd.style.display = "none";
  });

  // Snapshot 1: Layer 0 (front menu)
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT_DIR, "layer0.png"),
    fullPage: false,
  });
  console.log("saved layer0.png");

  // Open Layer 1 → Layer 2 via the buttons
  await page.click("#battery-toggle").catch(() => {});
  await page.waitForTimeout(300);
  await page.click("#open-diagnostics").catch(() => {});
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(OUT_DIR, "layer2.png"),
    fullPage: false,
  });
  console.log("saved layer2.png");

  // Full-page Layer 2 (so we see the bottom sections, signal breakdown etc.)
  await page.screenshot({
    path: path.join(OUT_DIR, "layer2-full.png"),
    fullPage: true,
  });
  console.log("saved layer2-full.png");

  await browser.close();
})().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
