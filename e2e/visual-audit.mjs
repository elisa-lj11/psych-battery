/**
 * visual-audit.mjs — comprehensive Playwright screenshot audit
 * Run: node e2e/visual-audit.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3131";
const DIR = "./e2e/screenshots/audit";
mkdirSync(DIR, { recursive: true });

const VIEWPORT = { width: 480, height: 900 };

let page, browser;
const errors = [];
const findings = [];

async function shot(name) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function fresh(theme = "editorial") {
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

async function enterDemo() {
  // Open the MENU dropdown first, then click Interactive Demo inside it
  const dd = await page.$("#demo-dropdown");
  if (dd) {
    await page.evaluate(() => {
      const d = document.getElementById("demo-dropdown");
      if (d) d.open = true;
    });
    await page.waitForTimeout(200);
  }
  const btn = await page.$("#demo-toggle-btn");
  if (btn) {
    const isDemo = await page.evaluate(() =>
      document.body.classList.contains("is-demo"),
    );
    if (!isDemo) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  } else {
    findings.push("❌ #demo-toggle-btn not found");
  }
}

(async () => {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  page = await ctx.newPage();

  page.on("pageerror", (e) => findings.push(`PAGE ERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") findings.push(`JS ERROR: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  // ── 1. CLEAN theme layer 0 ────────────────────────────────────────────────
  console.log("\n── [1] Layer 0 CLEAN ──");
  await fresh("editorial");
  await shot("01-layer0-clean");

  // ── 2. Theme picker — check it's a toggle, not two swatches ──────────────
  console.log("\n── [2] Theme picker ──");
  const swatches = await page.$$(".theme-swatch");
  const themeToggle = await page.$("#theme-mode-toggle");
  console.log(
    `  Theme swatches found: ${swatches.length} | Toggle found: ${!!themeToggle}`,
  );
  // Pixel art swatches (3) live in the help sheet — that's correct.
  // Only flag if there are swatches outside the help sheet.
  const headerSwatches = await page.$$("#app-header .theme-swatch");
  if (headerSwatches.length > 0)
    findings.push(
      `⚠️  Header still has ${headerSwatches.length} theme swatch(es) — should use toggle only`,
    );
  if (!themeToggle) findings.push("❌ #theme-mode-toggle not found");
  await shot("02-theme-picker");

  // Switch to DARK via toggle
  if (themeToggle) {
    await themeToggle.click();
    await page.waitForTimeout(400);
    await shot("02b-dark-theme");
  }

  // ── 3. DARK theme layer 0 ─────────────────────────────────────────────────
  console.log("\n── [3] DARK theme ──");
  await fresh("editorial-dark");
  await shot("03-layer0-dark");

  // ── 4. Demo mode — CLEAN — home grid ─────────────────────────────────────
  console.log("\n── [4] Demo home grid (CLEAN) ──");
  await fresh("editorial");
  await enterDemo();
  await shot("04-demo-grid-clean");

  // Check demo-state-row exists and is side-by-side
  const stateRow = await page.$(".demo-state-row");
  if (!stateRow) {
    findings.push("❌ .demo-state-row NOT found in demo home view");
  } else {
    const box = await stateRow.boundingBox();
    console.log(
      `  demo-state-row: w=${box?.width?.toFixed(0)}px h=${box?.height?.toFixed(0)}px`,
    );
    if (box && box.height > 200)
      findings.push(
        `⚠️  demo-state-row height ${box.height.toFixed(0)}px is too tall`,
      );
  }

  // Battery pair vs timeline positioning
  const battPair = await page.$(".demo-battery-pair");
  const timeline = await page.$(".demo-timeline-pane");
  if (battPair && timeline) {
    const bBox = await battPair.boundingBox();
    const tBox = await timeline.boundingBox();
    console.log(
      `  Battery pair:  x=${bBox?.x?.toFixed(0)} y=${bBox?.y?.toFixed(0)} w=${bBox?.width?.toFixed(0)} h=${bBox?.height?.toFixed(0)}`,
    );
    console.log(
      `  Timeline pane: x=${tBox?.x?.toFixed(0)} y=${tBox?.y?.toFixed(0)} w=${tBox?.width?.toFixed(0)} h=${tBox?.height?.toFixed(0)}`,
    );
    // They should be side-by-side (same y, different x)
    if (bBox && tBox) {
      if (Math.abs(bBox.y - tBox.y) > 30)
        findings.push(
          `❌ Battery and timeline NOT side-by-side — battery y=${bBox.y.toFixed(0)}, timeline y=${tBox.y.toFixed(0)} (stacked vertically!)`,
        );
      if (bBox.height > 180)
        findings.push(`⚠️  Battery pair too tall: ${bBox.height.toFixed(0)}px`);
    }
  } else {
    findings.push(
      `❌ Battery pair found: ${!!battPair}, Timeline found: ${!!timeline}`,
    );
  }

  // ── 5. Demo — click an activity ───────────────────────────────────────────
  console.log("\n── [5] Demo activity view ──");
  const cards = await page.$$("[data-demo-activity]");
  console.log(`  Activity cards found: ${cards.length}`);
  if (cards.length === 0)
    findings.push("❌ No [data-demo-activity] cards found");
  if (cards.length > 0) {
    await cards[0].click();
    await page.waitForTimeout(800);
    await shot("05-demo-activity-view");

    // Check battery+timeline side-by-side in activity view too
    const actBatt = await page.$(".demo-battery-pair");
    const actTimeline = await page.$(".demo-timeline-pane");
    if (actBatt && actTimeline) {
      const bBox = await actBatt.boundingBox();
      const tBox = await actTimeline.boundingBox();
      console.log(
        `  [activity] Battery: y=${bBox?.y?.toFixed(0)} h=${bBox?.height?.toFixed(0)}`,
      );
      console.log(
        `  [activity] Timeline: y=${tBox?.y?.toFixed(0)} h=${tBox?.height?.toFixed(0)}`,
      );
      if (bBox && tBox && Math.abs(bBox.y - tBox.y) > 30)
        findings.push(
          `❌ ACTIVITY VIEW: battery+timeline still stacked vertically`,
        );
    }

    // Back — re-query after render to avoid stale element
    await page.waitForTimeout(300);
    const backBtn = await page.$(
      "[data-demo-back], .demo-back-btn, .demo-scene-back",
    );
    if (backBtn) {
      try {
        await backBtn.click();
      } catch {
        // Re-query once if stale
        const bb2 = await page.$(
          "[data-demo-back], .demo-back-btn, .demo-scene-back",
        );
        if (bb2) await bb2.click();
      }
      await page.waitForTimeout(500);
      await shot("05b-demo-after-back");
    } else {
      findings.push("❌ No back button found in activity view");
    }
  }

  // ── 6. Demo dropdown panel (hover Interactive Demo btn) ───────────────────
  console.log("\n── [6] Demo panel / dropdown ──");
  await fresh("editorial");
  await shot("06-header-before-dropdown");

  // Open the MENU dropdown
  await page.evaluate(
    () => (document.getElementById("demo-dropdown").open = true),
  );
  await page.waitForTimeout(300);
  await shot("06b-demo-panel-open");

  // Check Interactive Demo button hover — dropdown must be open
  const demoToggleInPanel = await page.$("#demo-toggle-btn");
  if (demoToggleInPanel) {
    const color_before = await page.evaluate(() => {
      const el = document.getElementById("demo-toggle-btn");
      return el ? window.getComputedStyle(el).color : "not found";
    });
    await demoToggleInPanel.hover();
    await page.waitForTimeout(200);
    const color_hover = await page.evaluate(() => {
      const el = document.getElementById("demo-toggle-btn");
      if (!el) return "not found";
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return window.getComputedStyle(el).color;
    });
    console.log(`  demo-toggle-btn color before hover: ${color_before}`);
    console.log(`  demo-toggle-btn color on hover:     ${color_hover}`);
    await shot("06c-demo-toggle-hover");
  }

  // ── 7. Demo DARK theme ────────────────────────────────────────────────────
  console.log("\n── [7] Demo DARK theme ──");
  await fresh("editorial-dark");
  await enterDemo();
  await shot("07-demo-dark-grid");

  // Activity in dark
  const darkCards = await page.$$("[data-demo-activity]");
  if (darkCards.length > 0) {
    await darkCards[0].click();
    await page.waitForTimeout(800);
    await shot("07b-demo-dark-activity");
    await page.waitForTimeout(300);
    const backBtn2 = await page.$("[data-demo-back], .demo-back-btn");
    if (backBtn2) {
      try {
        await backBtn2.click();
      } catch {
        const bb3 = await page.$("[data-demo-back], .demo-back-btn");
        if (bb3) await bb3.click();
      }
      await page.waitForTimeout(400);
    }
  }

  // ── 8. Layer 1 CLEAN ─────────────────────────────────────────────────────
  console.log("\n── [8] Layer 1 CLEAN ──");
  await fresh("editorial");
  await page.click("#battery-toggle");
  await page.waitForTimeout(600);
  await shot("08-layer1-clean");

  // State tanks vs model explain height
  const sysCard = await page.$(".layer2-system-card");
  const modelExp = await page.$(".layer2-model-explain");
  if (sysCard && modelExp) {
    const sH = (await sysCard.boundingBox())?.height;
    const mH = (await modelExp.boundingBox())?.height;
    console.log(
      `  System card h=${sH?.toFixed(0)} | Model explain h=${mH?.toFixed(0)}`,
    );
    if (sH && mH && Math.abs(sH - mH) > 30)
      findings.push(
        `⚠️  State tanks (${sH?.toFixed(0)}px) not aligned with model-explain (${mH?.toFixed(0)}px)`,
      );
  }

  // ── 9. Layer 1 content card — bg should end above More Info ──────────────
  const contentCard = await page.$(".layer1-content-card");
  const moreInfoBtn = await page.$("#open-diagnostics");
  if (contentCard && moreInfoBtn) {
    const cBox = await contentCard.boundingBox();
    const mBox = await moreInfoBtn.boundingBox();
    console.log(
      `  layer1-content-card bottom: ${(cBox.y + cBox.height).toFixed(0)}`,
    );
    console.log(`  More Info button top:        ${mBox.y.toFixed(0)}`);
    if (mBox.y < cBox.y + cBox.height)
      findings.push(`⚠️  More Info button overlaps content card`);
  }

  // ── 10. Layer 2 — phase portrait visible ─────────────────────────────────
  console.log("\n── [10] Layer 2 + phase portrait ──");
  await page.click("#open-diagnostics");
  await page.waitForTimeout(600);
  await shot("09-layer2-clean");

  const phaseSection = await page.$(
    ".phase-portrait-section, #phase-portrait-dropdown",
  );
  if (!phaseSection)
    findings.push("❌ Phase portrait section not found in layer 2");
  else console.log("  ✅ Phase portrait section present");

  const phasePortrait = await page.$("#phase-portrait");
  console.log(`  #phase-portrait visible: ${!!phasePortrait}`);

  // ── 11. Help sheet all tabs ───────────────────────────────────────────────
  console.log("\n── [11] Help sheet ──");
  await fresh("editorial");
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  await shot("10-help-about");

  for (const tab of ["shortcuts", "glossary", "howitworks", "pixelart"]) {
    const btn = await page.$(`[data-help-tab="${tab}"]`);
    if (!btn) {
      findings.push(`❌ Help tab "${tab}" not found`);
      continue;
    }
    await btn.click();
    await page.waitForTimeout(250);
    await shot(`10-help-${tab}`);
  }

  // Reset button label
  const resetBtn = await page.$("#reset-onboarding-btn");
  if (resetBtn) {
    const label = (await resetBtn.textContent()).trim();
    console.log(`  Reset btn: "${label}"`);
    if (!label.toLowerCase().includes("first-visit"))
      findings.push(
        `❌ Reset btn still says "${label}", expected "Reset first-visit experience"`,
      );
    else console.log("  ✅ Reset btn label correct");
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ── 12. Bottom dock buttons ───────────────────────────────────────────────
  console.log("\n── [12] Bottom dock ──");
  await fresh("editorial");
  await shot("11-dock-clean");
  await fresh("editorial-dark");
  await shot("11-dock-dark");

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log(`Screenshots: ${DIR}/`);
  if (findings.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`\n🔍 FINDINGS (${findings.length}):`);
    findings.forEach((f) => console.log(`  ${f}`));
  }

  await browser.close();
})();
