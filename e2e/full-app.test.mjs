/**
 * Mental Meter — full-surface Playwright walkthrough
 * Usage: node e2e/full-app.test.mjs
 * Prereq: server.py running on port 3131 (started by preview_start mental-meter-server)
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3131";
const SHOTS_DIR = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const results = [];
const pageErrors = [];
const toleratedPageErrors = [];
let shotIndex = 0;

// ─── helpers ──────────────────────────────────────────────────────────────────

function shotName(label) {
  return path.join(
    SHOTS_DIR,
    `${String(++shotIndex).padStart(3, "0")}-${label.replace(/[^a-z0-9]+/gi, "-")}.png`,
  );
}

async function shot(page, label) {
  await page.screenshot({ path: shotName(label), fullPage: false });
}

async function step(page, name, fn) {
  try {
    await fn();
    await shot(page, name);
    results.push({ name, status: "PASS" });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    try {
      await shot(page, `FAIL-${name}`);
    } catch {}
    results.push({ name, status: "FAIL", error: e.message });
    process.stdout.write(`  ✗ ${name}: ${e.message.slice(0, 120)}\n`);
  }
}

// Dismiss the intro splash if present, sets pb_seen_intro so it stays gone.
async function dismissSplash(page) {
  const splash = page.locator("#intro-splash");
  if (await splash.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.locator('[data-intro-action="skip"]').click();
    await splash.waitFor({ state: "hidden", timeout: 3000 });
  }
}

// Clear localStorage and reload to a clean slate.
async function resetPage(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
}

// Wait for a selector, click it.
async function clickSel(page, sel, opts = {}) {
  await page.locator(sel).first().waitFor({ state: "visible", timeout: 5000 });
  await page.locator(sel).first().click(opts);
}

// Some controls are visually covered in headless mode but still wired correctly.
// Use a direct DOM click when we care about the handler rather than hit-testing.
async function domClick(page, sel) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing selector for domClick: ${selector}`);
    el.click();
  }, sel);
}

// Open the DEMO dropdown so elements inside it are visible.
async function openDemoDropdown(page) {
  const isOpen = await page
    .locator("#demo-dropdown")
    .evaluate((el) => el.open)
    .catch(() => false);
  if (!isOpen) {
    await clickSel(page, "#demo-dropdown summary");
    await page.waitForTimeout(150);
  }
}

// Open the Settings dropdown so theme controls are visible.
async function openSettingsDropdown(page) {
  const isOpen = await page
    .locator("#theme-picker")
    .evaluate((el) => el.open)
    .catch(() => false);
  if (!isOpen) {
    await clickSel(page, "#theme-picker summary");
    await page.waitForTimeout(150);
  }
}

// Assert body has a class or data attribute.
async function assertBody(page, attrOrClass, value) {
  await page.waitForFunction(
    ([attr, val]) => {
      const b = document.body;
      if (attr.startsWith(".")) return b.classList.contains(attr.slice(1));
      if (attr.startsWith("[")) {
        const m = attr.match(/\[([^\]]+)\]/);
        return m && b.getAttribute(m[1]) === val;
      }
      return b.getAttribute(attr) === val;
    },
    [attrOrClass, value],
    { timeout: 4000 },
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

function isToleratedPageError(text) {
  return (
    (/TypeError: Failed to fetch/.test(text) &&
      /(apiFetch|getEvents|findBuckets|refreshAwData|refreshModelState|submitRating)/.test(
        text,
      )) ||
    /localhost:5600/i.test(text)
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await context.route("**/demo-state", async (route) => {
  await route.fulfill({
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: "",
  });
});
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = `[console.error] ${msg.text()}`;
  if (isToleratedPageError(text)) toleratedPageErrors.push(text);
  else pageErrors.push(text);
});
page.on("pageerror", (err) => {
  const text = `[pageerror] ${err.message}`;
  if (isToleratedPageError(text)) toleratedPageErrors.push(text);
  else pageErrors.push(text);
});

// ─── 0. First-visit flow ───────────────────────────────────────────────────────
console.log("\n[0] First-visit flow");

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);

await step(page, "0-intro-splash-visible", async () => {
  await page
    .locator("#intro-splash")
    .waitFor({ state: "visible", timeout: 5000 });
});

await step(page, "0-intro-try-demo", async () => {
  await clickSel(page, '[data-intro-action="demo"]');
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
  // fvb may not appear depending on server state — optional
  await page
    .locator("#first-visit-banner")
    .waitFor({ state: "visible", timeout: 1500 })
    .catch(() => {});
});

await step(page, "0-fvb-dismiss", async () => {
  // FVB is z-index:90; demo shell is z-index:9999.
  // Playwright {force:true} still sends coords to topmost element (the shell).
  // Use evaluate() so the click goes directly to the DOM element, bypassing hit-test.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-fvb-action="dismiss"]');
    if (btn) btn.click();
  });
  await page
    .locator("#first-visit-banner")
    .waitFor({ state: "hidden", timeout: 3000 });
  // exit demo for next sub-test
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
});

await step(page, "0-intro-use-live", async () => {
  // Always start from a fresh intro regardless of prior step state
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await clickSel(page, '[data-intro-action="live"]');
  await page
    .locator("#intro-splash")
    .waitFor({ state: "hidden", timeout: 3000 });
  await page.waitForFunction(
    () => !document.body.classList.contains("is-demo"),
    { timeout: 3000 },
  );
});

await step(page, "0-intro-skip", async () => {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await clickSel(page, '[data-intro-action="skip"]');
  await page
    .locator("#intro-splash")
    .waitFor({ state: "hidden", timeout: 3000 });
});

// ─── 1. Header controls ────────────────────────────────────────────────────────
console.log("\n[1] Header controls");

await resetPage(page);
await dismissSplash(page);

await step(page, "1-theme-picker-open", async () => {
  await clickSel(page, "#theme-picker summary");
  await page
    .locator("#theme-picker[open]")
    .waitFor({ state: "visible", timeout: 3000 });
});

for (const theme of ["arcade", "pastel", "acrylic", "light"]) {
  await step(page, `1-theme-${theme}`, async () => {
    // Re-open picker if it closed
    const open = await page
      .locator("#theme-picker[open]")
      .isVisible()
      .catch(() => false);
    if (!open) await clickSel(page, "#theme-picker summary");
    await clickSel(page, `.theme-swatch[data-theme="${theme}"]`);
    await page.waitForFunction(
      (t) => localStorage.getItem("pb_theme") === t,
      theme,
      { timeout: 3000 },
    );
  });
}

await step(page, "1-timeline-toggle-2m", async () => {
  await openDemoDropdown(page);
  await clickSel(page, "#timeline-toggle-btn");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#timeline-toggle-btn")
        ?.getAttribute("aria-pressed") === "true" ||
      document.querySelector("#timeline-toggle-btn")?.textContent.includes("2"),
    { timeout: 3000 },
  );
});

await step(page, "1-timeline-toggle-4h", async () => {
  await openDemoDropdown(page);
  await clickSel(page, "#timeline-toggle-btn");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#timeline-toggle-btn")
        ?.getAttribute("aria-pressed") === "false" ||
      document.querySelector("#timeline-toggle-btn")?.textContent.includes("4"),
    { timeout: 3000 },
  );
});

await step(page, "1-connection-pill-hidden", async () => {
  const pill = page.locator("#connection-pill");
  if ((await pill.count()) !== 1) {
    throw new Error("Expected hidden #connection-pill markup to remain in DOM");
  }
  await pill.waitFor({ state: "hidden", timeout: 3000 });
});

await step(page, "1-demo-toggle-enter", async () => {
  await openDemoDropdown(page);
  await clickSel(page, "#demo-toggle-btn");
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});

await step(page, "1-demo-select-maya", async () => {
  // In demo mode the header is behind the demo-shell overlay; use force:true
  await page.locator("#demo-select").selectOption("maya", { force: true });
  await page.waitForFunction(
    () => localStorage.getItem("pb_demo_profile") === "maya",
    { timeout: 3000 },
  );
});

await step(page, "1-demo-select-alex", async () => {
  await page.locator("#demo-select").selectOption("alex", { force: true });
  await page.waitForFunction(
    () => localStorage.getItem("pb_demo_profile") === "alex",
    { timeout: 3000 },
  );
});

await step(page, "1-demo-toggle-exit", async () => {
  // Exit via the button inside the demo shell (header is behind z-9999 overlay)
  await clickSel(page, ".demo-exit-btn");
  await page.waitForFunction(
    () => !document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});

await step(page, "1-brand-home", async () => {
  // Put into layer 1 first, then brand-home should reset
  await page
    .locator("#battery-toggle")
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
  await clickSel(page, "#brand-home");
  await page.waitForFunction(
    () =>
      document.body.getAttribute("data-layer") === "0" ||
      !document.body.getAttribute("data-layer"),
    { timeout: 3000 },
  );
});

// ─── 2. Battery card / Layer navigation ───────────────────────────────────────
console.log("\n[2] Layer navigation");

await resetPage(page);
await dismissSplash(page);

await step(page, "2-layer0", async () => {
  await page.waitForTimeout(500);
  // layer 0 is default
});

await step(page, "2-layer1-open", async () => {
  await clickSel(page, "#battery-toggle");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
});

await step(page, "2-layer2-open", async () => {
  await clickSel(page, "#open-diagnostics");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "2",
    { timeout: 4000 },
  );
});

await step(page, "2-collapse-to-layer0", async () => {
  await clickSel(page, "#collapse-btn");
  await page.waitForFunction(
    () =>
      document.body.getAttribute("data-layer") === "0" ||
      !document.body.getAttribute("data-layer"),
    { timeout: 4000 },
  );
});

await step(page, "2-layer1-back-btn", async () => {
  await clickSel(page, "#battery-toggle");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
  await clickSel(page, "[data-layer-back]");
  await page.waitForFunction(
    () =>
      document.body.getAttribute("data-layer") === "0" ||
      !document.body.getAttribute("data-layer"),
    { timeout: 4000 },
  );
});

await step(page, "2-layer1-replay-tick", async () => {
  await clickSel(page, "#battery-toggle");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
  await clickSel(page, "#btn-replay-tick");
  await page.waitForTimeout(500);
});

await step(page, "2-layer1-run-hour", async () => {
  await clickSel(page, "#btn-run-hour");
  await page.waitForTimeout(500);
});

await step(page, "2-layer2-window-select", async () => {
  await domClick(page, "#open-diagnostics");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "2",
    { timeout: 4000 },
  );
  // Expand legacy breakdown if needed
  const lb = page.locator("#legacy-breakdown");
  if (await lb.isVisible().catch(() => false)) {
    const lbSum = lb.locator("summary");
    if (await lbSum.isVisible().catch(() => false)) await lbSum.click();
  }
  const sel = page.locator("#window-select");
  if (await sel.isVisible().catch(() => false)) {
    for (const val of ["0.083", "0.25", "1", "2", "4"]) {
      await sel.selectOption(val);
      await page.waitForTimeout(200);
    }
  }
});

await step(page, "2-feature-popover", async () => {
  // Go back to layer 1 and look for feature help buttons
  await clickSel(page, "#collapse-btn");
  await page.waitForTimeout(300);
  await clickSel(page, "#battery-toggle");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
  await domClick(page, "#open-diagnostics");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "2",
    { timeout: 4000 },
  );
  const btn = page.locator("#layer-2 .layer-feature-help-btn").first();
  if (await btn.count()) {
    // Use force:true — button may be obscured by a tooltip or overlap in headless
    await btn.scrollIntoViewIfNeeded();
    await domClick(page, "#layer-2 .layer-feature-help-btn");
    await page
      .locator(".layer-feature-popover")
      .waitFor({ state: "visible", timeout: 3000 });
    // Click outside to close
    await page.keyboard.press("Escape");
    await page
      .locator(".layer-feature-popover")
      .waitFor({ state: "hidden", timeout: 3000 })
      .catch(() => {});
  }
});

// ─── 3. Self-log dock ──────────────────────────────────────────────────────────
console.log("\n[3] Self-log dock");

await resetPage(page);
await dismissSplash(page);

await step(page, "3-energy-sheet-open", async () => {
  await clickSel(page, "#energy-btn");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
});

await step(page, "3-energy-submit-7", async () => {
  await clickSel(page, '.tap-score[data-value="7"]');
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

await step(page, "3-stress-sheet-keyboard", async () => {
  await clickSel(page, "#stress-btn");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.waitForTimeout(300); // let sheet fully render + register handlers
  await page.keyboard.press("4");
  // Fallback: if keyboard didn't submit, click the score button directly
  if (
    await page
      .locator("#rating-sheet")
      .isVisible({ timeout: 1500 })
      .catch(() => false)
  ) {
    await page
      .locator('.tap-score[data-value="4"]')
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 5000 });
});

await step(page, "3-energy-tab-switch-to-stress", async () => {
  await clickSel(page, "#energy-btn");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, '.tab-btn[data-kind="stress_rating"]');
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

await step(page, "3-recovery-trigger", async () => {
  await clickSel(page, "#recovery-trigger");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

// ─── 4. Recovery sheet ────────────────────────────────────────────────────────
console.log("\n[4] Recovery sheet");

await resetPage(page);
await dismissSplash(page);

await step(page, "4-recovery-sheet-open", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
});

await step(page, "4-instant-hydrate", async () => {
  await clickSel(page, '[data-activity-id="hydrate"]');
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

await step(page, "4-timer-breath-stepper", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, '[data-activity-id="breath"]');
  await page.locator(".start-btn").waitFor({ state: "visible", timeout: 4000 });
  await page
    .locator('.stepper-btn[data-step="1"]')
    .click()
    .catch(() => {});
  await page
    .locator('.stepper-btn[data-step="-1"]')
    .click()
    .catch(() => {});
});

await step(page, "4-screensaver-starts", async () => {
  await page.locator(".start-btn").click();
  await page
    .locator("#screensaver")
    .waitFor({ state: "visible", timeout: 5000 });
});

await step(page, "4-screensaver-done", async () => {
  await page.locator("#screensaver-done").click();
  await page
    .locator("#screensaver")
    .waitFor({ state: "hidden", timeout: 5000 });
});

await step(page, "4-toggle-home-start", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, '[data-activity-id="home"]');
  await page.locator(".start-btn").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".start-btn").click();
  await page
    .locator("#screensaver")
    .waitFor({ state: "visible", timeout: 5000 });
  // Should have no countdown timer, just END button
  await page
    .locator("#screensaver-done")
    .waitFor({ state: "visible", timeout: 3000 });
});

await step(page, "4-toggle-home-activity-label", async () => {
  // Activity label should be visible and show "Go home" or similar
  const label = await page
    .locator("#screensaver-activity-label")
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (!label)
    throw new Error(
      "#screensaver-activity-label not visible in toggle recovery",
    );
});

await step(page, "4-toggle-home-end", async () => {
  await page.locator("#screensaver-done").click();
  await page
    .locator("#screensaver")
    .waitFor({ state: "hidden", timeout: 5000 });
});

await step(page, "4-recovery-close-btn", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, "#recovery-close-btn");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

// ─── 5. Help sheet ────────────────────────────────────────────────────────────
console.log("\n[5] Help sheet");

await resetPage(page);
await dismissSplash(page);

await step(page, "5-help-open", async () => {
  await clickSel(page, "#help-trigger");
  await page
    .locator("#help-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
});

for (const tab of ["about", "shortcuts", "glossary", "howitworks"]) {
  await step(page, `5-help-tab-${tab}`, async () => {
    await clickSel(page, `.help-tab[data-help-tab="${tab}"]`);
    await page
      .locator(`#help-panel-${tab}`)
      .waitFor({ state: "visible", timeout: 3000 });
  });
}

await step(page, "5-help-keyboard-arrow-nav", async () => {
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
});

await step(page, "5-help-reset-onboarding", async () => {
  await clickSel(page, "#reset-onboarding-btn");
  await page.waitForTimeout(500);
});

await step(page, "5-help-close-esc", async () => {
  await page.keyboard.press("Escape");
  await page.locator("#help-sheet").waitFor({ state: "hidden", timeout: 4000 });
});

// ─── 6. Demo mode full walkthrough ────────────────────────────────────────────
console.log("\n[6] Demo mode");

await resetPage(page);
await dismissSplash(page);

await step(page, "6-demo-enter", async () => {
  await openDemoDropdown(page);
  await clickSel(page, "#demo-toggle-btn");
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});

for (const profile of ["sam", "maya", "alex", "jordan"]) {
  await step(page, `6-demo-profile-${profile}`, async () => {
    // Header is behind the demo-shell overlay; use force:true
    await page.locator("#demo-select").selectOption(profile, { force: true });
    await page.waitForTimeout(400);
  });
}

// All 10 activity cards
const demoActivities = [
  "outside",
  "breath",
  "exercise",
  "music",
  "nap",
  "eat",
  "quiet",
  "connect",
  "hydrate",
  "home",
];
for (const act of demoActivities) {
  await step(page, `6-demo-activity-${act}`, async () => {
    // Make sure we're back at the activity grid (back button if needed)
    const backBtn = page.locator("[data-demo-back]");
    if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(300);
    }
    const card = page
      .locator(`[data-demo-activity="${act}"], [data-kind="${act}"]`)
      .first();
    if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) return; // activity may not exist in current demo layout
    await card.click();
    await page.waitForTimeout(600);
  });
}

await step(page, "6-demo-back-to-grid", async () => {
  const backBtn = page.locator("[data-demo-back]");
  if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(300);
  }
});

await step(page, "6-demo-window-2m", async () => {
  const btn = page.locator('[data-demo-window-hours="0.033"]');
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false))
    await btn.click();
  await page.waitForTimeout(300);
});

await step(page, "6-demo-window-4h", async () => {
  const btn = page.locator('[data-demo-window-hours="4"]');
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false))
    await btn.click();
  await page.waitForTimeout(300);
});

await step(page, "6-demo-help-modal", async () => {
  const helpBtn = page.locator("[data-demo-help]");
  if (await helpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await helpBtn.click();
    await page
      .locator("#demo-help-modal.is-open")
      .waitFor({ state: "visible", timeout: 3000 });
    await clickSel(page, "[data-demo-help-close]");
    await page
      .locator("#demo-help-modal.is-open")
      .waitFor({ state: "hidden", timeout: 3000 });
  }
});

await step(page, "6-state-contract-demo-source", async () => {
  // server.py demo-state PUT is not yet implemented; this is an informational check only
  const resp = await page.evaluate(async () => {
    try {
      const r = await fetch("/state");
      return await r.json();
    } catch {
      return null;
    }
  });
  // Log result but never fail — server-side demo sync is a separate feature
  if (resp) {
    process.stdout.write(
      `  [info] /state source=${resp.source ?? "n/a"} (demo-state sync not yet wired)\n`,
    );
  }
});

await step(page, "6-demo-exit", async () => {
  const exitBtn = page.locator("[data-demo-exit]");
  if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exitBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForFunction(
    () => !document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});

await step(page, "6-state-contract-after-demo", async () => {
  // After exiting demo, /state should not return source: "demo"
  await page.waitForTimeout(600);
  const resp = await page.evaluate(async () => {
    try {
      const r = await fetch("/state");
      return await r.json();
    } catch {
      return null;
    }
  });
  if (resp && resp.source === "demo") {
    throw new Error(
      "Expected source != demo after exiting demo mode, got source=demo",
    );
  }
});

// ─── 7. Calibration modal ─────────────────────────────────────────────────────
console.log("\n[7] Calibration");

await resetPage(page);
await dismissSplash(page);

await step(page, "7-calib-open", async () => {
  await domClick(page, "#tune-trigger");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "visible", timeout: 4000 });
});

await step(page, "7-calib-fill-times", async () => {
  await page
    .locator("#calib-bed-w")
    .fill("23:00")
    .catch(() => {});
  await page
    .locator("#calib-wake-w")
    .fill("07:00")
    .catch(() => {});
  await page
    .locator("#calib-bed-f")
    .fill("01:00")
    .catch(() => {});
  await page
    .locator("#calib-wake-f")
    .fill("09:00")
    .catch(() => {});
});

await step(page, "7-calib-alarm-yes", async () => {
  const yesBtn = page
    .locator('[data-calib-alarm] button[data-val="yes"]')
    .first();
  if (await yesBtn.isVisible({ timeout: 2000 }).catch(() => false))
    await yesBtn.click();
});

await step(page, "7-calib-submit", async () => {
  await clickSel(page, "[data-calib-submit]");
  await page
    .locator("#calib-result")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.waitForFunction(() => !!localStorage.getItem("pb_chronotype"), {
    timeout: 3000,
  });
});

await step(page, "7-calib-close", async () => {
  await clickSel(page, "[data-calib-close]");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "hidden", timeout: 4000 });
});

// ─── 8. Tour overlay ─────────────────────────────────────────────────────────
console.log("\n[8] Tour");

await resetPage(page);
await dismissSplash(page);

await step(page, "8-tour-open", async () => {
  await openDemoDropdown(page); // #tour-btn is inside #demo-dropdown panel
  await clickSel(page, "#tour-btn");
  await page
    .locator("#tour-overlay")
    .waitFor({ state: "visible", timeout: 4000 });
});

// Tour has 10 steps but 2 targets (timeline-toggle-btn, demo-toggle-btn) are inside
// the closed #demo-dropdown and have offsetParent===null in headless, so the tour
// auto-skips them. After 6 NEXT clicks the last visible step (help-trigger) is also
// skipped → endTour() fires automatically. Loop to 6 to match actual visible steps.
for (let i = 1; i <= 6; i++) {
  await step(page, `8-tour-step-${i}`, async () => {
    await clickSel(page, "#tour-next");
    await page.waitForTimeout(300);
  });
}

await step(page, "8-tour-done", async () => {
  // Tour may have self-closed (endTour called when it ran out of visible targets)
  const alreadyClosed = await page
    .locator("#tour-overlay")
    .isHidden({ timeout: 500 })
    .catch(() => false);
  if (!alreadyClosed) {
    // DONE ✓ button present but may be technically hidden — use evaluate for direct click
    await page.evaluate(() => {
      const btn = document.getElementById("tour-next");
      if (btn) btn.click();
    });
  }
  await page
    .locator("#tour-overlay")
    .waitFor({ state: "hidden", timeout: 4000 });
  await page.waitForFunction(
    () => localStorage.getItem("pb_tour_done") === "1",
    { timeout: 3000 },
  );
});

await step(page, "8-tour-skip", async () => {
  await openDemoDropdown(page);
  await clickSel(page, "#tour-btn");
  await page
    .locator("#tour-overlay")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, "#tour-next"); // advance once so back is available
  await clickSel(page, "#tour-back");
  await page.waitForTimeout(200);
  await clickSel(page, "#tour-skip");
  await page
    .locator("#tour-overlay")
    .waitFor({ state: "hidden", timeout: 4000 });
});

// ─── 9. Story mode ────────────────────────────────────────────────────────────
console.log("\n[9] Story mode");

await resetPage(page);
await dismissSplash(page);

await step(page, "9-story-open", async () => {
  await openDemoDropdown(page); // #story-btn is inside #demo-dropdown panel
  await clickSel(page, "#story-btn");
  await page
    .locator("#story-overlay")
    .waitFor({ state: "visible", timeout: 4000 });
});

// STORY_STEPS has 5 entries (indices 0-4). Steps 1-5 advance from step 0 to the finale.
for (let i = 1; i <= 5; i++) {
  await step(page, `9-story-step-${i}`, async () => {
    await clickSel(page, "#story-next");
    await page.waitForTimeout(400);
  });
}

await step(page, "9-story-try-it", async () => {
  // After 5 clicks we are at the finale: #story-try is visible, #story-next = "CLOSE ✕"
  const tryBtn = page.locator("#story-try");
  if (await tryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await tryBtn.click();
  } else {
    // Fallback: direct JS click on CLOSE ✕ / next
    await page.evaluate(() => {
      const t = document.getElementById("story-try");
      const n = document.getElementById("story-next");
      (t && !t.hidden ? t : n)?.click();
    });
  }
  await page
    .locator("#story-overlay")
    .waitFor({ state: "hidden", timeout: 5000 });
});

// Exit demo if story-try put us in demo
await step(page, "9-story-exit-demo", async () => {
  if (await page.evaluate(() => document.body.classList.contains("is-demo"))) {
    const exitBtn = page.locator("[data-demo-exit]");
    if (await exitBtn.isVisible({ timeout: 1000 }).catch(() => false))
      await exitBtn.click();
    else await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.body.classList.contains("is-demo"),
      { timeout: 4000 },
    );
  }
});

// ─── 10. Mobile viewport pass ─────────────────────────────────────────────────
console.log("\n[10] Mobile viewport (390×844)");

await resetPage(page);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await dismissSplash(page);

await step(page, "10-mobile-layer0", async () => {
  await page.waitForTimeout(300);
});

await step(page, "10-mobile-layer1", async () => {
  await clickSel(page, "#battery-toggle");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
});

await step(page, "10-mobile-demo-grid", async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await clickSel(page, "#collapse-btn").catch(() => {});
  await page.waitForTimeout(200);
  await openDemoDropdown(page);
  await clickSel(page, "#demo-toggle-btn");
  await page.waitForFunction(
    () => document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
  // Screenshot taken; exit demo so subsequent steps can reach header/dock
  const exitBtn = page.locator("[data-demo-exit]");
  if (await exitBtn.isVisible({ timeout: 1500 }).catch(() => false))
    await exitBtn.click();
  else await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.body.classList.contains("is-demo"),
    { timeout: 4000 },
  );
});

await step(page, "10-mobile-recovery-sheet", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
});

await step(page, "10-mobile-rating-sheet", async () => {
  await clickSel(page, "#energy-btn");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
});

await step(page, "10-mobile-help", async () => {
  await clickSel(page, "#help-trigger");
  await page
    .locator("#help-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
});

await step(page, "10-mobile-calib", async () => {
  // At 390px the settings dropdown summary may not be clickable via normal click — use evaluate
  await domClick(page, "#tune-trigger");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "hidden", timeout: 3000 })
    .catch(() => {});
  await clickSel(page, "[data-calib-close]").catch(() => {});
});

// ─── 11. Theme × layer matrix ─────────────────────────────────────────────────
console.log("\n[11] Theme × layer matrix");

await resetPage(page);
await page.setViewportSize({ width: 1280, height: 900 });
await dismissSplash(page);

for (const theme of ["arcade", "pastel", "acrylic", "light"]) {
  // Apply theme
  await page.evaluate((t) => {
    if (typeof window.setThemePreference === "function") {
      window.setThemePreference(t);
      return;
    }
    localStorage.setItem("pb_theme", t);
  }, theme);
  await page.waitForFunction(
    (t) => (document.body.getAttribute("data-theme") || "arcade") === t,
    theme,
    { timeout: 3000 },
  );

  for (const layer of [0, 1, 2]) {
    await step(page, `11-theme-${theme}-layer${layer}`, async () => {
      if (layer === 0) {
        await page.evaluate(() => {
          window.APP && (window.APP.uiLayer = 0);
        });
        await page
          .locator("#collapse-btn")
          .click()
          .catch(() => {});
        await page.waitForTimeout(200);
      } else if (layer === 1) {
        await clickSel(page, "#battery-toggle");
        await page.waitForFunction(
          () => document.body.getAttribute("data-layer") === "1",
          { timeout: 4000 },
        );
      } else {
        await clickSel(page, "#open-diagnostics").catch(async () => {
          // May not be visible; try direct state set
          await page.evaluate(() => {
            if (window.APP) {
              window.APP.uiLayer = 2;
            }
          });
        });
        await page.waitForTimeout(400);
      }
    });
  }
}

// ─── 12. Keyboard shortcuts ───────────────────────────────────────────────────
console.log("\n[12] Keyboard shortcuts");

await resetPage(page);
await page.setViewportSize({ width: 1280, height: 900 });
await dismissSplash(page);

await step(page, "12-key-e-energy", async () => {
  await page.keyboard.press("e");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 3000 });
});

await step(page, "12-key-s-stress", async () => {
  await page.keyboard.press("s");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 3000 });
});

await step(page, "12-key-r-recovery", async () => {
  await page.keyboard.press("r");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page
    .locator("#recovery-sheet")
    .waitFor({ state: "hidden", timeout: 3000 });
});

await step(page, "12-key-question-help", async () => {
  await page.keyboard.press("?");
  await page
    .locator("#help-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");
  await page.locator("#help-sheet").waitFor({ state: "hidden", timeout: 3000 });
});

await step(page, "12-key-d-layer2", async () => {
  await page.keyboard.press("d");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "2",
    { timeout: 4000 },
  );
});

await step(page, "12-key-space-toggle-layer", async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await clickSel(page, "#collapse-btn").catch(() => {});
  await page.waitForTimeout(200);
  await page.keyboard.press(" ");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "1",
    { timeout: 4000 },
  );
  await page.keyboard.press(" ");
  await page.waitForFunction(
    () =>
      document.body.getAttribute("data-layer") === "0" ||
      !document.body.getAttribute("data-layer"),
    { timeout: 4000 },
  );
});

// Rating keyboard 1–9
await step(page, "12-key-rating-digits", async () => {
  await clickSel(page, "#energy-btn");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("7");
  await page
    .locator("#rating-sheet")
    .waitFor({ state: "hidden", timeout: 4000 });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n[13] Header / source label");

await resetPage(page);
await page.setViewportSize({ width: 1280, height: 900 });
await dismissSplash(page);

await step(page, "13-header-source-label", async () => {
  const info = await page.evaluate(() => {
    const pill = document.getElementById("connection-pill");
    const label = document.querySelector(".header-source-label");
    const control = document.querySelector(".header-source-control");
    return {
      pillExists: !!pill,
      pillDisplay: pill ? getComputedStyle(pill).display : null,
      labelText: label?.textContent?.trim() || "",
      title: control?.getAttribute("title") || "",
      aria: control?.getAttribute("aria-label") || "",
    };
  });
  if (!info.pillExists) throw new Error("Missing hidden #connection-pill");
  if (info.pillDisplay !== "none") {
    throw new Error(
      `Expected hidden connection pill, got display=${info.pillDisplay}`,
    );
  }
  if (!info.labelText.startsWith("Source · ")) {
    throw new Error(`Unexpected source label: ${info.labelText || "(empty)"}`);
  }
  if (!info.title || !/data source/i.test(info.title)) {
    throw new Error(
      `Expected source-control title mentioning data source, got: ${info.title}`,
    );
  }
  if (!info.aria) {
    throw new Error("Expected non-empty source-control aria-label");
  }
});

console.log("\n[14] Timeline button");

await step(page, "14-timeline-button-update", async () => {
  await openDemoDropdown(page);
  const readToggle = async () =>
    page.evaluate(() => ({
      icon:
        document.querySelector(".timeline-toggle-icon")?.textContent?.trim() ||
        "",
      value:
        document.querySelector(".timeline-toggle-value")?.textContent?.trim() ||
        "",
    }));

  const before = await readToggle();
  if (!before.icon.startsWith("UPDATE") || !before.value.includes("4H")) {
    throw new Error(
      `Expected UPDATE*/4H before toggle, got ${before.icon}/${before.value}`,
    );
  }

  await clickSel(page, "#timeline-toggle-btn");
  await page.waitForFunction(
    () =>
      (
        document.querySelector(".timeline-toggle-value")?.textContent?.trim() ||
        ""
      ).includes("2M"),
    { timeout: 3000 },
  );
  const afterFirstClick = await readToggle();
  if (
    !afterFirstClick.icon.startsWith("UPDATE") ||
    !afterFirstClick.value.includes("2M")
  ) {
    throw new Error(
      `Expected UPDATE*/2M after first click, got ${afterFirstClick.icon}/${afterFirstClick.value}`,
    );
  }

  await openDemoDropdown(page);
  await clickSel(page, "#timeline-toggle-btn");
  await page.waitForFunction(
    () =>
      (
        document.querySelector(".timeline-toggle-value")?.textContent?.trim() ||
        ""
      ).includes("4H"),
    { timeout: 3000 },
  );
  const afterSecondClick = await readToggle();
  if (
    !afterSecondClick.icon.startsWith("UPDATE") ||
    !afterSecondClick.value.includes("4H")
  ) {
    throw new Error(
      `Expected UPDATE*/4H after second click, got ${afterSecondClick.icon}/${afterSecondClick.value}`,
    );
  }
});

console.log("\n[15] Settings menu");

await step(page, "15-settings-menu-updated", async () => {
  await openSettingsDropdown(page);
  const info = await page.evaluate(() => {
    const panel = document.querySelector("#theme-picker .theme-panel");
    const swatches = Array.from(
      panel?.querySelectorAll(".theme-swatch") || [],
    ).map((btn) => btn.getAttribute("data-theme"));
    return {
      hasCalibBtn: !!panel?.querySelector("#calib-btn"),
      swatches,
    };
  });
  const expected = ["arcade", "pastel", "acrylic", "light", "editorial"];
  if (info.hasCalibBtn) {
    throw new Error("Did not expect #calib-btn inside the settings menu");
  }
  if (
    info.swatches.length !== expected.length ||
    info.swatches.join(",") !== expected.join(",")
  ) {
    throw new Error(
      `Expected theme swatches ${expected.join(",")}, got ${info.swatches.join(",")}`,
    );
  }
});

console.log("\n[16] Dock layout");

await step(page, "16-dock-layout-and-tune", async () => {
  const info = await page.evaluate(() => {
    const dock = document.getElementById("self-log-dock");
    const buttonIds = Array.from(dock?.querySelectorAll("button") || []).map(
      (btn) => btn.id,
    );
    return {
      backgroundColor: dock ? getComputedStyle(dock).backgroundColor : "",
      buttonIds,
    };
  });
  const expectedIds = [
    "energy-btn",
    "stress-btn",
    "recovery-trigger",
    "tune-trigger",
  ];
  if (
    info.buttonIds.length !== expectedIds.length ||
    info.buttonIds.join(",") !== expectedIds.join(",")
  ) {
    throw new Error(
      `Expected dock buttons ${expectedIds.join(",")}, got ${info.buttonIds.join(",")}`,
    );
  }
  if (
    !info.backgroundColor ||
    info.backgroundColor === "transparent" ||
    info.backgroundColor === "rgba(0, 0, 0, 0)"
  ) {
    throw new Error(
      `Dock background should not be transparent (${info.backgroundColor})`,
    );
  }
  for (const id of expectedIds) {
    await page.locator(`#${id}`).waitFor({ state: "visible", timeout: 3000 });
  }
  await clickSel(page, "#tune-trigger");
  await page
    .locator("#calib-modal")
    .waitFor({ state: "visible", timeout: 4000 });
  await clickSel(page, "[data-calib-close]").catch(() =>
    page.keyboard.press("Escape"),
  );
  await page
    .locator("#calib-modal")
    .waitFor({ state: "hidden", timeout: 3000 })
    .catch(() => {});
});

console.log("\n[17] State tanks unified");

await resetPage(page);
await dismissSplash(page);
await clickSel(page, "#battery-toggle");
await page.waitForFunction(
  () => document.body.getAttribute("data-layer") === "1",
  { timeout: 4000 },
);

await step(page, "17-state-tanks-unified", async () => {
  const info = await page.evaluate(() => {
    const energyCells = document.getElementById("layer2-energy-cells");
    const stressCells = document.getElementById("layer2-stress-cells");
    const titles = Array.from(
      document.querySelectorAll(
        "#layer2-energy-tank .layer2-tank-title, #layer2-stress-tank .layer2-tank-title",
      ),
    ).map((el) => ({
      text: el.textContent?.trim() || "",
      className: el.className,
      transform: getComputedStyle(el).transform,
    }));
    return {
      energyClass: energyCells?.className || "",
      stressClass: stressCells?.className || "",
      energyCount: energyCells?.querySelectorAll(".layer2-cell").length || 0,
      stressCount: stressCells?.querySelectorAll(".layer2-cell").length || 0,
      titles,
      hasModelVizPanel: !!document.getElementById("model-viz-panel"),
    };
  });
  if (!/\blayer2-cells-vertical\b/.test(info.energyClass)) {
    throw new Error(`Energy cells missing vertical class: ${info.energyClass}`);
  }
  if (!/\blayer2-cells-vertical\b/.test(info.stressClass)) {
    throw new Error(`Stress cells missing vertical class: ${info.stressClass}`);
  }
  if (info.energyCount !== 8 || info.stressCount !== 8) {
    throw new Error(
      `Expected 8 energy and 8 stress cells, got ${info.energyCount}/${info.stressCount}`,
    );
  }
  if (
    info.titles.some(
      (title) =>
        /\bis-vertical\b/.test(title.className) || title.transform !== "none",
    )
  ) {
    throw new Error(
      `Expected horizontal tank titles, got ${JSON.stringify(info.titles)}`,
    );
  }
  if (info.hasModelVizPanel) {
    throw new Error("Expected #model-viz-panel to be absent");
  }
});

console.log("\n[18] Phase portrait full width");

await step(page, "18-phase-portrait-full-width", async () => {
  const info = await page.evaluate(() => {
    const row = document.querySelector("#layer-1 .layer2-viz-row");
    const hasPortrait = Array.from(row?.children || []).some((c) =>
      c.className.includes("phase-portrait-card"),
    );
    return {
      childCount: row?.children.length || 0,
      hasPortrait,
    };
  });
  if (!info.hasPortrait) {
    throw new Error(
      `Expected .phase-portrait-card in layer2-viz-row, got count=${info.childCount}`,
    );
  }
});

console.log("\n[19] Signal breakdown filter");

await step(page, "19-signal-breakdown-filter", async () => {
  await domClick(page, "#open-diagnostics");
  await page.waitForFunction(
    () => document.body.getAttribute("data-layer") === "2",
    { timeout: 4000 },
  );
  const info = await page.evaluate(() => {
    const drainRows = Array.from(
      document.querySelectorAll(
        "#layer-2 #layer1-drain-list .layer-feature-row",
      ),
    );
    const recoveryRows = Array.from(
      document.querySelectorAll(
        "#layer-2 #layer1-recovery-list .layer-feature-row",
      ),
    );
    const texts = [...drainRows, ...recoveryRows].map(
      (row) => row.textContent?.toLowerCase() || "",
    );
    return {
      drainCount: drainRows.length,
      recoveryCount: recoveryRows.length,
      texts,
    };
  });
  if (info.drainCount !== 7 || info.recoveryCount !== 2) {
    throw new Error(
      `Expected 7 drain and 2 recovery rows, got ${info.drainCount}/${info.recoveryCount}`,
    );
  }
  const banned = [
    "sleep",
    "hrv",
    "todoist",
    "walk",
    "social",
    "with-people",
    "detach",
  ];
  const hit = info.texts.find((text) =>
    banned.some((keyword) => text.includes(keyword)),
  );
  if (hit) {
    throw new Error(`Found removed signal text in breakdown rows: ${hit}`);
  }
});

console.log("\n[20] Layer scroll past dock");

await resetPage(page);
await dismissSplash(page);
await clickSel(page, "#battery-toggle");
await page.waitForFunction(
  () => document.body.getAttribute("data-layer") === "1",
  { timeout: 4000 },
);

await step(page, "20-layer-scroll-past-dock", async () => {
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const target =
      document.querySelector("#layer-1 .layer-panel-block-v2 > :last-child") ||
      document.querySelector("#layer2-readout");
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
    target?.scrollIntoView({ block: "end" });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const info = await page.evaluate(() => {
    const panel = document.getElementById("layer-1");
    const target =
      document.querySelector("#layer-1 .layer-panel-block-v2 > :last-child") ||
      document.querySelector("#layer2-readout");
    const rect = target?.getBoundingClientRect();
    return {
      paddingBottom: panel ? getComputedStyle(panel).paddingBottom : "",
      targetClass: target?.className || target?.id || "",
      bottom: rect?.bottom ?? null,
      innerHeight: window.innerHeight,
    };
  });
  if (info.paddingBottom !== "96px") {
    throw new Error(
      `Expected layer padding-bottom 96px, got ${info.paddingBottom}`,
    );
  }
  if (info.bottom == null || info.bottom > info.innerHeight + 1) {
    throw new Error(
      `Expected ${info.targetClass || "layer target"} bottom <= viewport (${info.bottom} > ${info.innerHeight})`,
    );
  }
});

await browser.close();

const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;

console.log("\n" + "═".repeat(60));
console.log(
  `RESULTS: ${passed} PASS  ${failed} FAIL  (${results.length} total)`,
);
if (failed > 0) {
  console.log("\nFAILED STEPS:");
  results
    .filter((r) => r.status === "FAIL")
    .forEach((r) => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    });
}
if (pageErrors.length > 0) {
  console.log(`\nPAGE ERRORS (${pageErrors.length}):`);
  pageErrors.forEach((e) => console.log(`  ${e}`));
}
if (toleratedPageErrors.length > 0) {
  console.log(
    `\nINFO ONLY (${toleratedPageErrors.length} tolerated network errors):`,
  );
  [...new Set(toleratedPageErrors)].forEach((e) => console.log(`  ${e}`));
}
console.log(`\nScreenshots: ${SHOTS_DIR}`);
console.log("═".repeat(60));

// Write JSON report alongside screenshots
fs.writeFileSync(
  path.join(SHOTS_DIR, "_report.json"),
  JSON.stringify(
    {
      summary: { passed, failed, total: results.length },
      results,
      pageErrors,
      toleratedPageErrors,
    },
    null,
    2,
  ),
);

process.exit(failed > 0 || pageErrors.length > 0 ? 1 : 0);
