// Snapshot the demo activity view to verify layout
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
  page.on("console", (m) => {
    if (m.type() === "error") console.error("CONSOLE ERR:", m.text());
  });

  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // Force demo mode via JS (bypass intro splash and button visibility)
  await page.evaluate(() => {
    const splash = document.getElementById("intro-splash");
    if (splash) {
      splash.hidden = true;
      splash.style.display = "none";
    }
    document.body.classList.remove("sheet-open");
    const bd = document.getElementById("backdrop");
    if (bd) bd.style.display = "none";
    // Call the app's enterDemoMode directly
    if (typeof enterDemoMode === "function") {
      enterDemoMode();
    } else {
      // Fallback: toggle button via force
      document.getElementById("demo-toggle-btn")?.click();
    }
  });
  await page.waitForTimeout(600);

  // Screenshot demo grid (activity selection)
  await page.screenshot({
    path: path.join(OUT_DIR, "demo-grid.png"),
    fullPage: false,
  });
  console.log("saved demo-grid.png");

  // Click first activity card to enter activity view
  const actCard = await page.$("[data-demo-activity]");
  if (actCard) {
    await actCard.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, "demo-activity.png"),
      fullPage: false,
    });
    console.log("saved demo-activity.png");

    // Full page version too
    await page.screenshot({
      path: path.join(OUT_DIR, "demo-activity-full.png"),
      fullPage: true,
    });
    console.log("saved demo-activity-full.png");
  } else {
    console.log("No activity card found");
  }

  await browser.close();
})().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
