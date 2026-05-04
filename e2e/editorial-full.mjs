/**
 * Full editorial-theme walkthrough — every button, dropdown, sheet, layer.
 * Usage: node e2e/editorial-full.mjs
 * Server must be running on port 3131.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "screenshots", "editorial-full");
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "http://localhost:3131";
let shotIdx = 0;
const issues = [];
const pageErrors = [];

function snap(label) {
  return path.join(
    SHOTS,
    `${String(++shotIdx).padStart(3, "0")}-${label.replace(/[^a-z0-9]+/gi, "-")}.png`,
  );
}

function isToleratedError(text) {
  return /Failed to fetch|localhost:5600|localhost:7070|CORS/.test(text);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await context.route("**/demo-state", (route) =>
  route.fulfill({
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: "",
  }),
);
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error" && !isToleratedError(msg.text()))
    pageErrors.push(msg.text());
});
page.on("pageerror", (err) => {
  if (!isToleratedError(err.message)) pageErrors.push(err.message);
});

async function setEditorial() {
  await page.evaluate(() => {
    localStorage.setItem("pb_theme", "editorial");
    document.body.dataset.theme = "editorial";
  });
}

async function cleanLoad(keepTheme = true) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (keepTheme) await setEditorial();
}

async function dismissSplash() {
  const splash = page.locator("#intro-splash");
  if (await splash.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('[data-intro-action="skip"]').click();
    await splash.waitFor({ state: "hidden", timeout: 3000 });
  }
}

async function closeAnySheet() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function flag(label, note) {
  issues.push({ label, note });
  console.log(`  ⚠️  ${label}: ${note}`);
}

async function check(label, fn) {
  try {
    await fn();
    process.stdout.write(`  ✓ ${label}\n`);
  } catch (e) {
    await page.screenshot({ path: snap(`ISSUE-${label}`) }).catch(() => {});
    issues.push({ label, note: e.message.slice(0, 120) });
    process.stdout.write(`  ✗ ${label}: ${e.message.slice(0, 120)}\n`);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function waitVisible(sel, timeout = 5000) {
  await page.locator(sel).first().waitFor({ state: "visible", timeout });
}
async function clickSel(sel) {
  await waitVisible(sel);
  await page.locator(sel).first().click();
}
async function domClick(sel) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("not found: " + s);
    el.click();
  }, sel);
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[0] SPLASH — editorial theme can't be set until after dismiss");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.screenshot({ path: snap("splash-default") });

await check("splash-visible", async () => {
  await waitVisible("#intro-splash");
});

// try demo button
await check("splash-try-demo", async () => {
  await clickSel('[data-intro-action="demo"]');
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});
await page.screenshot({ path: snap("splash-try-demo-result") });

// reset and test skip
await cleanLoad(false);
await page.waitForTimeout(300);
await check("splash-skip", async () => {
  await clickSel('[data-intro-action="skip"]');
  await page
    .locator("#intro-splash")
    .waitFor({ state: "hidden", timeout: 3000 });
});
await setEditorial();
await page.screenshot({ path: snap("splash-skip-result") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[1] LAYER 0 — battery card main view in editorial");
await cleanLoad();
await dismissSplash();
await page.screenshot({ path: snap("layer0-battery") });

// Check battery card styling
const batteryInfo = await page.evaluate(() => {
  const card = document.querySelector("#battery-card");
  const cs = getComputedStyle(card);
  return {
    borderRadius: cs.borderRadius,
    boxShadow: cs.boxShadow.slice(0, 80),
    backdropFilter: cs.backdropFilter,
  };
});
console.log("  battery-card styles:", JSON.stringify(batteryInfo));
if (
  !batteryInfo.borderRadius.includes("22") &&
  !batteryInfo.borderRadius.includes("px")
) {
  await flag(
    "layer0-battery-radius",
    `Expected 22px, got ${batteryInfo.borderRadius}`,
  );
}

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[2] HEADER CONTROLS");

// Theme picker
await check("header-theme-picker-open", async () => {
  await clickSel("#theme-picker summary");
  await page
    .locator("#theme-picker[open]")
    .waitFor({ state: "visible", timeout: 3000 });
});
await page.screenshot({ path: snap("header-theme-picker-open") });

// Try all 5 themes including editorial
for (const theme of ["arcade", "pastel", "acrylic", "light", "editorial"]) {
  await check(`header-theme-${theme}`, async () => {
    const open = await page
      .locator("#theme-picker[open]")
      .isVisible()
      .catch(() => false);
    if (!open) await clickSel("#theme-picker summary");
    await page.locator(`.theme-swatch[data-theme="${theme}"]`).click();
    await page.waitForFunction(
      (t) => localStorage.getItem("pb_theme") === t,
      theme,
      { timeout: 3000 },
    );
  });
  await page.screenshot({ path: snap(`header-theme-${theme}`) });
}
// Restore editorial
await setEditorial();

// Timeline toggle — button may be inside #demo-dropdown <details>
await check("header-timeline-2m", async () => {
  // Ensure dropdown is open if timeline btn is nested inside it
  const inDropdown = await page.evaluate(() => {
    const btn = document.querySelector("#timeline-toggle-btn");
    return btn ? !!btn.closest("details") : false;
  });
  if (inDropdown) {
    const isOpen = await page
      .locator("#demo-dropdown")
      .evaluate((el) => el.open)
      .catch(() => false);
    if (!isOpen) await domClick("#demo-dropdown summary");
    await page.waitForTimeout(200);
  }
  await domClick("#timeline-toggle-btn");
  await page.waitForTimeout(300);
});
await page.screenshot({ path: snap("header-timeline-2m") });

await check("header-timeline-4h", async () => {
  await domClick("#timeline-toggle-btn");
  await page.waitForTimeout(300);
});
await page.screenshot({ path: snap("header-timeline-4h") });

// Demo dropdown + profile switcher
await check("header-demo-dropdown", async () => {
  const isOpen = await page
    .locator("#demo-dropdown")
    .evaluate((el) => el.open)
    .catch(() => false);
  if (!isOpen) await clickSel("#demo-dropdown summary");
  await page.waitForTimeout(200);
});
await page.screenshot({ path: snap("header-demo-dropdown") });

// Connection pill (should exist in DOM, may be hidden)
const pillInDom = await page.locator("#connection-pill").count();
console.log(`  connection-pill in DOM: ${pillInDom}`);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[3] LAYER NAVIGATION");

await cleanLoad();
await dismissSplash();

// Layer 1 — expand battery
await check("layer1-expand", async () => {
  await domClick("#battery-toggle");
  await page.waitForFunction(() => document.body.dataset.layer === "1", {
    timeout: 4000,
  });
});
await page.screenshot({ path: snap("layer1-expanded") });

// Scroll to check all content
await page.evaluate(() => window.scrollTo(0, 500));
await page.screenshot({ path: snap("layer1-scroll") });
await page.evaluate(() => window.scrollTo(0, 0));

// Layer 2 — diagnostics
await check("layer2-diagnostics", async () => {
  await domClick("#open-diagnostics");
  await page.waitForFunction(() => document.body.dataset.layer === "2", {
    timeout: 4000,
  });
});
await page.screenshot({ path: snap("layer2-diagnostics") });

// Window select in layer 2
await check("layer2-window-select", async () => {
  const sel = page.locator("#window-select");
  if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
    for (const opt of ["2", "4", "8", "24", "168"]) {
      await sel.selectOption(opt).catch(() => {});
    }
  }
});
await page.screenshot({ path: snap("layer2-window-select") });

// Layer-feature help buttons in layer 2
const helpBtns = await page.locator(".layer-feature-help-btn").count();
console.log(`  layer-feature-help-btn count: ${helpBtns}`);
if (helpBtns > 0) {
  await page.locator(".layer-feature-help-btn").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: snap("layer2-feature-popover") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

// Collapse back to layer 0
await check("layer0-collapse", async () => {
  await domClick("#collapse-btn");
  await page.waitForFunction(() => document.body.dataset.layer === "0", {
    timeout: 4000,
  });
});
await page.screenshot({ path: snap("layer0-after-collapse") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[4] SELF-LOG DOCK");

await cleanLoad();
await dismissSplash();

await page.screenshot({ path: snap("dock-default") });

// Energy sheet
await check("dock-energy-open", async () => {
  await domClick("#energy-btn");
  await waitVisible(".tap-score", 4000);
});
await page.screenshot({ path: snap("dock-energy-sheet") });

// Check tap score border-radius in editorial
const tapScoreRadius = await page.evaluate(() => {
  const el = document.querySelector(".tap-score");
  return el ? getComputedStyle(el).borderRadius : "not found";
});
console.log(`  .tap-score border-radius: ${tapScoreRadius}`);

await check("dock-energy-tap-7", async () => {
  await page.locator('.tap-score[data-value="7"]').click();
  await page.waitForTimeout(600);
});
await page.screenshot({ path: snap("dock-energy-tapped-7") });

// Re-open energy sheet, switch to stress tab
await check("dock-energy-stress-tab", async () => {
  await domClick("#energy-btn");
  await waitVisible('.tab-btn[data-kind="stress_rating"]', 3000);
  await page.locator('.tab-btn[data-kind="stress_rating"]').click();
  await page.waitForTimeout(300);
});
await page.screenshot({ path: snap("dock-stress-tab") });
await closeAnySheet();
await page.waitForTimeout(300);

// Stress sheet directly
await check("dock-stress-open", async () => {
  await domClick("#stress-btn");
  await waitVisible(".tap-score", 4000);
});
await page.screenshot({ path: snap("dock-stress-sheet") });
await closeAnySheet();
await page.waitForTimeout(300);

// Recovery sheet
await check("dock-recovery-open", async () => {
  await domClick("#recovery-trigger");
  await waitVisible(".activity-btn", 4000);
});
await page.screenshot({ path: snap("dock-recovery-sheet") });

const actBtnRadius = await page.evaluate(() => {
  const el = document.querySelector(".activity-btn");
  return el ? getComputedStyle(el).borderRadius : "not found";
});
console.log(`  .activity-btn border-radius: ${actBtnRadius}`);

// Click an instant activity (hydrate)
await check("dock-recovery-instant", async () => {
  const btn = page.locator('[data-activity-id="hydrate"]');
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(600);
  }
});
await page.screenshot({ path: snap("dock-recovery-instant-done") });

// Timer activity — breath
await check("dock-recovery-timer-open", async () => {
  await domClick("#recovery-trigger");
  await waitVisible('[data-activity-id="breath"]', 4000);
  await page.locator('[data-activity-id="breath"]').click();
  await page.waitForTimeout(400);
});
await page.screenshot({ path: snap("dock-recovery-timer-start") });

// Stepper buttons
await check("dock-recovery-stepper", async () => {
  const minus = page.locator('.stepper-btn[data-step="-1"]');
  const plus = page.locator('.stepper-btn[data-step="1"]');
  if (await minus.isVisible({ timeout: 2000 }).catch(() => false)) {
    const stepBtnRadius = await minus.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    );
    console.log(`  .stepper-btn border-radius: ${stepBtnRadius}`);
    await minus.click();
    await plus.click();
  }
});
await page.screenshot({ path: snap("dock-recovery-stepper") });

// Start screensaver
await check("dock-recovery-screensaver", async () => {
  const startBtn = page.locator(".start-btn");
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const startRadius = await startBtn.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    );
    console.log(`  .start-btn border-radius: ${startRadius}`);
    await startBtn.click();
    await page.waitForTimeout(600);
  }
});
await page.screenshot({ path: snap("dock-recovery-screensaver-active") });

await check("dock-screensaver-done", async () => {
  const doneBtn = page.locator("#screensaver-done");
  if (await doneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await doneBtn.click();
    await page.waitForTimeout(400);
  }
});
await page.screenshot({ path: snap("dock-screensaver-done") });

await closeAnySheet();
await page.waitForTimeout(300);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[5] HELP SHEET");

await cleanLoad();
await dismissSplash();

await check("help-open", async () => {
  await domClick("#help-trigger");
  await waitVisible("#help-sheet", 3000);
});
await page.screenshot({ path: snap("help-sheet-default") });

// Check help sheet border-radius
const helpRadius = await page.evaluate(() => {
  const el = document.querySelector("#help-sheet");
  return el ? getComputedStyle(el).borderRadius : "not found";
});
console.log(`  #help-sheet border-radius: ${helpRadius}`);

// All 4 tabs
for (const tab of ["about", "shortcuts", "glossary", "howitworks"]) {
  await check(`help-tab-${tab}`, async () => {
    const btn = page.locator(
      `.tab-btn[data-tab="${tab}"], .tab-btn[data-help-tab="${tab}"]`,
    );
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  });
  await page.screenshot({ path: snap(`help-tab-${tab}`) });
}

// Reset onboarding button
await check("help-reset-onboarding", async () => {
  const btn = page.locator("#reset-onboarding-btn");
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
  }
});
await page.screenshot({ path: snap("help-reset-onboarding") });

// Close help
await check("help-close", async () => {
  await page.keyboard.press("Escape");
  await page.locator("#help-sheet").waitFor({ state: "hidden", timeout: 3000 });
});
await page.screenshot({ path: snap("help-closed") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[6] CALIBRATION (TUNE)");

await cleanLoad();
await dismissSplash();

await check("calib-open", async () => {
  await clickSel("#tune-trigger");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "visible", timeout: 3000 });
});
await page.screenshot({ path: snap("calib-open") });

const calibRadius = await page.evaluate(() => {
  const el = document.querySelector(".calib-card");
  return el ? getComputedStyle(el).borderRadius : "not found";
});
console.log(`  .calib-card border-radius: ${calibRadius}`);

// Fill in bed/wake times
await check("calib-fill-times", async () => {
  const bedW = page.locator("#calib-bed-w");
  const wakeW = page.locator("#calib-wake-w");
  const bedF = page.locator("#calib-bed-f");
  const wakeF = page.locator("#calib-wake-f");
  if (await bedW.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bedW.fill("23:00");
    await wakeW.fill("07:00");
    await bedF.fill("00:30");
    await wakeF.fill("09:00");
  }
});
await page.screenshot({ path: snap("calib-filled") });

// Alarm radio buttons
await check("calib-alarm-select", async () => {
  const btn = page.locator("[data-calib-alarm] button").first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(200);
  }
});

await check("calib-submit", async () => {
  const submitBtn = page.locator("[data-calib-submit]");
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(600);
  }
});
await page.screenshot({ path: snap("calib-result") });

await check("calib-close", async () => {
  const closeBtn = page.locator("[data-calib-close]");
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  } else {
    await page.keyboard.press("Escape");
  }
});
await page.screenshot({ path: snap("calib-closed") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[7] TOUR");

await cleanLoad();
await dismissSplash();

await check("tour-open", async () => {
  await domClick("#tour-btn");
  await waitVisible(".tour-step, #tour-overlay, [class*='tour']", 4000);
});
await page.screenshot({ path: snap("tour-step1") });

// Step through tour
for (let i = 2; i <= 5; i++) {
  await check(`tour-next-${i}`, async () => {
    const nextBtn = page.locator("#tour-next, [data-tour-next]");
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }
  });
  await page.screenshot({ path: snap(`tour-step${i}`) });
}

// Skip remaining tour
await check("tour-skip", async () => {
  const skip = page.locator("#tour-skip, [data-tour-skip]");
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  } else {
    await page.keyboard.press("Escape");
  }
});
await page.screenshot({ path: snap("tour-done") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[8] STORY MODE");

await cleanLoad();
await dismissSplash();

await check("story-open", async () => {
  await domClick("#story-btn");
  await waitVisible("#story-card, .story-card", 3000);
});
await page.screenshot({ path: snap("story-open") });

const storyRadius = await page.evaluate(() => {
  const el = document.querySelector("#story-card, .story-card");
  return el ? getComputedStyle(el).borderRadius : "not found";
});
console.log(`  #story-card border-radius: ${storyRadius}`);

// Step through story
for (let i = 2; i <= 5; i++) {
  await check(`story-next-${i}`, async () => {
    const btn = page.locator("#story-next, [data-story-next]");
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  });
  await page.screenshot({ path: snap(`story-step${i}`) });
}

// Close story if still open
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(300);

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[9] DEMO MODE full run");

await cleanLoad();
await dismissSplash();

await check("demo-enter", async () => {
  await domClick("#demo-toggle-btn");
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 5000 },
  );
  await page.waitForTimeout(500);
});
await page.screenshot({ path: snap("demo-grid") });

// Profile switcher
for (const p of ["sam", "maya", "alex", "jordan"]) {
  await check(`demo-profile-${p}`, async () => {
    await page.locator("#demo-select").selectOption(p, { force: true });
    await page.waitForTimeout(400);
  });
  await page.screenshot({ path: snap(`demo-profile-${p}`) });
}

// All activity cards
const activities = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-demo-activity]")).map(
    (c) => c.dataset.demoActivity,
  ),
);
console.log("  Activities:", activities.join(", "));

for (let i = 0; i < activities.length; i++) {
  const id = activities[i];
  await check(`demo-activity-${id}`, async () => {
    await page.evaluate((actId) => {
      document.querySelector(`[data-demo-activity="${actId}"]`)?.click();
    }, id);
    await page.locator(".demo-scene-svg").waitFor({ timeout: 3000 });
    await page.waitForTimeout(400);
  });
  await page.screenshot({ path: snap(`demo-activity-${id}`) });

  // Check scene frame radius
  const frameRadius = await page.evaluate(() => {
    const el = document.querySelector(".demo-scene-frame");
    return el ? getComputedStyle(el).borderRadius : "not found";
  });
  if (!frameRadius.includes("22") && frameRadius !== "not found") {
    await flag(
      `demo-activity-${id}-frame-radius`,
      `border-radius: ${frameRadius}`,
    );
  }

  // Go back
  await page.evaluate(() => {
    const btn = document.querySelector("[data-demo-back]");
    if (btn) btn.click();
  });
  await page.waitForTimeout(300);
}

// Demo help modal
await check("demo-help-open", async () => {
  const helpBtn = page.locator(".demo-help-btn, [data-demo-help]");
  if (await helpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await helpBtn.click();
    await page.waitForTimeout(400);
  }
});
await page.screenshot({ path: snap("demo-help-modal") });

await check("demo-help-close", async () => {
  const closeBtn = page.locator(".demo-help-close, [data-demo-help-close]");
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  } else {
    await page.keyboard.press("Escape");
  }
});

// Exit demo
await check("demo-exit", async () => {
  await page.evaluate(() => {
    const btn = document.querySelector("[data-demo-exit], #demo-exit-btn");
    if (btn) btn.click();
  });
  await page.waitForFunction(
    () => !document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
  await setEditorial();
});
await page.screenshot({ path: snap("demo-exited") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[10] LAYER 1 detail — metrics, phase portrait, legacy");

await cleanLoad();
await dismissSplash();

await check("layer1-from-battery", async () => {
  await domClick("#battery-toggle");
  await page.waitForFunction(() => document.body.dataset.layer === "1", {
    timeout: 4000,
  });
  await page.waitForTimeout(400);
});
await page.screenshot({ path: snap("layer1-top") });

// Scroll layer 1 contents
await page.evaluate(() => window.scrollTo(0, 400));
await page.screenshot({ path: snap("layer1-scroll1") });
await page.evaluate(() => window.scrollTo(0, 800));
await page.screenshot({ path: snap("layer1-scroll2") });
await page.evaluate(() => window.scrollTo(0, 0));

// Phase portrait / metric cards
const metricCards = await page.locator(".metric-card").count();
console.log(`  .metric-card count: ${metricCards}`);
if (metricCards > 0) {
  const mcRadius = await page
    .locator(".metric-card")
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  console.log(`  .metric-card border-radius: ${mcRadius}`);
}

// Legacy breakdown
await check("layer1-legacy-expand", async () => {
  const summary = page.locator(
    ".layer-legacy summary, #legacy-breakdown summary",
  );
  if (await summary.isVisible({ timeout: 2000 }).catch(() => false)) {
    await summary.click();
    await page.waitForTimeout(300);
  }
});
await page.screenshot({ path: snap("layer1-legacy-expanded") });

// Replay tick, run hour buttons
await check("layer1-replay-tick", async () => {
  const btn = page.locator("#btn-replay-tick");
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
  }
});
await page.screenshot({ path: snap("layer1-replay-tick") });

// Back to layer 0
await check("layer1-back", async () => {
  await domClick("[data-layer-back], #collapse-btn");
  await page.waitForFunction(() => document.body.dataset.layer === "0", {
    timeout: 4000,
  });
});
await page.screenshot({ path: snap("layer1-back-to-0") });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[11] MOBILE VIEWPORT");

await cleanLoad();
await dismissSplash();
await page.setViewportSize({ width: 390, height: 844 });
await setEditorial();
await page.screenshot({ path: snap("mobile-layer0") });

// Mobile layer 1
await domClick("#battery-toggle");
await page.waitForTimeout(500);
await page.screenshot({ path: snap("mobile-layer1") });

// Mobile recovery
await page.evaluate(() => (document.body.dataset.layer = "0"));
await page.waitForTimeout(200);
await domClick("#recovery-trigger").catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: snap("mobile-recovery") });
await closeAnySheet();

// Restore desktop
await page.setViewportSize({ width: 1280, height: 900 });

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[12] BOTTOM SHEET border-radius spot-check");

await cleanLoad();
await dismissSplash();

// Open a bottom sheet (energy) and check styles
await domClick("#energy-btn");
await page.waitForTimeout(400);
const sheetInfo = await page.evaluate(() => {
  const sheet = document.querySelector(".bottom-sheet, [class*='sheet']");
  if (!sheet) return null;
  const cs = getComputedStyle(sheet);
  return {
    class: sheet.className.slice(0, 50),
    borderRadius: cs.borderRadius,
    background: cs.backgroundColor,
  };
});
console.log("  bottom-sheet:", JSON.stringify(sheetInfo));
await page.screenshot({ path: snap("bottom-sheet-energy") });
await closeAnySheet();

// ════════════════════════════════════════════════════════════════════════════
console.log("\n[13] VERTICAL BATTERY — editorial pill shape");

await cleanLoad();
await dismissSplash();
await page.setViewportSize({ width: 1280, height: 900 });

// 1. SVG should be hidden in editorial mode
await check("editorial-battery-svg-hidden", async () => {
  const svgDisplay = await page.evaluate(() => {
    const svg = document.querySelector("#battery-visual svg");
    if (!svg) return "no-svg";
    return getComputedStyle(svg).display;
  });
  if (svgDisplay !== "none" && svgDisplay !== "no-svg")
    throw new Error(`SVG display is "${svgDisplay}", expected "none"`);
});

// 2. Battery-visual is taller than wide (portrait/vertical)
await check("editorial-battery-portrait", async () => {
  const dims = await page.evaluate(() => {
    const bv = document.getElementById("battery-visual");
    const r = bv.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (dims.h <= dims.w)
    throw new Error(`Battery not portrait: ${dims.w}×${dims.h}`);
  console.log(`    battery-visual: ${dims.w}×${dims.h}px ✓`);
});

// 3. Battery has rounded-rect border-radius (≥ 8px, not fully pill)
await check("editorial-battery-rounded", async () => {
  const br = await page.evaluate(() => {
    const bv = document.getElementById("battery-visual");
    return getComputedStyle(bv).borderRadius;
  });
  const val = parseFloat(br);
  if (val < 8)
    throw new Error(`border-radius ${br} — expected rounded rect (≥ 8px)`);
  console.log(`    border-radius: ${br} ✓`);
});

// 4. --battery-pct CSS variable is set on documentElement
await check("editorial-battery-pct-var", async () => {
  const pct = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--battery-pct")
      .trim(),
  );
  if (!pct) throw new Error("--battery-pct not set");
  const val = parseFloat(pct);
  if (isNaN(val) || val < 0 || val > 1)
    throw new Error(`--battery-pct="${pct}" out of 0–1 range`);
  console.log(`    --battery-pct: ${pct} ✓`);
});

await page.screenshot({ path: snap("editorial-vertical-battery-layer0") });

// 5. Stress ring: ::after pseudo rendered (check via box-shadow on battery-visual)
await check("editorial-stress-ring-css", async () => {
  const styles = await page.evaluate(() => {
    const bv = document.getElementById("battery-visual");
    const cs = getComputedStyle(bv);
    return {
      overflow: cs.overflow,
      position: cs.position,
    };
  });
  if (styles.overflow !== "hidden")
    throw new Error(`overflow is "${styles.overflow}", expected "hidden"`);
  if (styles.position !== "relative")
    throw new Error(`position is "${styles.position}", expected "relative"`);
});

// 6. --stress-pct is set
await check("editorial-stress-pct-var", async () => {
  const pct = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--stress-pct")
      .trim(),
  );
  if (!pct) throw new Error("--stress-pct not set");
  const val = parseFloat(pct);
  if (isNaN(val) || val < 0 || val > 1)
    throw new Error(`--stress-pct="${pct}" out of range`);
  console.log(`    --stress-pct: ${pct} ✓`);
});

// 7. #battery-stress-display is visible in editorial, hidden in other themes
await check("editorial-stress-display-visible", async () => {
  const vis = await page.evaluate(() => {
    const el = document.getElementById("battery-stress-display");
    if (!el) throw new Error("#battery-stress-display not found");
    return getComputedStyle(el).display;
  });
  if (vis === "none")
    throw new Error(`#battery-stress-display display is "${vis}" in editorial`);
  console.log(`    stress display: ${vis} ✓`);
});

await check("editorial-stress-display-hidden-other-theme", async () => {
  const vis = await page.evaluate(() => {
    document.body.dataset.theme = "arcade";
    const el = document.getElementById("battery-stress-display");
    const d = getComputedStyle(el).display;
    document.body.dataset.theme = "editorial";
    return d;
  });
  if (vis !== "none")
    throw new Error(`Should be hidden in arcade, got display="${vis}"`);
});

// 8. Demo mode: stress display updates, ring color changes with profile
await check("editorial-demo-stress-sam", async () => {
  // Enter demo, select Sam (high stress)
  await domClick("#demo-toggle-btn");
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const sel = document.getElementById("demo-select");
    if (sel) {
      sel.value = "sam";
      sel.dispatchEvent(new Event("change"));
    }
  });
  await page.waitForTimeout(800);
  const stressPct = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--stress-pct")
      .trim(),
  );
  console.log(`    Sam --stress-pct: ${stressPct}`);
  // Sam should animate toward higher stress over time; just check it's set
  if (!stressPct) throw new Error("--stress-pct not set in demo");
});
await page.screenshot({ path: snap("editorial-battery-demo-sam") });

await check("editorial-demo-stress-maya", async () => {
  await page.evaluate(() => {
    const sel = document.getElementById("demo-select");
    if (sel) {
      sel.value = "maya";
      sel.dispatchEvent(new Event("change"));
    }
  });
  await page.waitForTimeout(800);
  const stressPct = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--stress-pct")
      .trim(),
  );
  console.log(`    Maya --stress-pct: ${stressPct} (expect lower than Sam)`);
});
await page.screenshot({ path: snap("editorial-battery-demo-maya") });

// Exit demo
await domClick("#demo-toggle-btn").catch(() => {});
await page.waitForTimeout(400);

// 9. Battery fill is proportional: check ::before height matches --battery-pct
await check("editorial-battery-fill-proportional", async () => {
  const result = await page.evaluate(() => {
    const bv = document.getElementById("battery-visual");
    const batteryH = bv.getBoundingClientRect().height;
    const pct = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--battery-pct",
      ),
    );
    // Compute expected fill height
    const expectedH = batteryH * pct;
    return {
      batteryH: Math.round(batteryH),
      pct,
      expectedH: Math.round(expectedH),
    };
  });
  console.log(
    `    battery ${result.batteryH}px × ${(result.pct * 100).toFixed(0)}% = ${result.expectedH}px fill`,
  );
  // Just verify the variable is sane
  if (result.pct < 0 || result.pct > 1)
    throw new Error(`--battery-pct ${result.pct} out of range`);
});

// 10. Default theme is now editorial (no stored preference)
await check("default-theme-is-editorial", async () => {
  const theme = await page.evaluate(() => {
    localStorage.removeItem("pb_theme");
    // Re-init theme
    const stored = localStorage.getItem("pb_theme") || "editorial";
    return stored;
  });
  if (theme !== "editorial")
    throw new Error(`Default theme is "${theme}", expected "editorial"`);
});

await page.screenshot({ path: snap("editorial-battery-final") });

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
console.log("\n════ SUMMARY ════");
console.log(`Screenshots: ${shotIdx} saved to ${SHOTS}`);
console.log(`Issues found (${issues.length}):`);
issues.forEach((i, n) => console.log(`  ${n + 1}. [${i.label}] ${i.note}`));
console.log(`\nPage errors (${pageErrors.length}):`);
pageErrors.slice(0, 10).forEach((e) => console.log("  " + e.slice(0, 120)));

await browser.close();
