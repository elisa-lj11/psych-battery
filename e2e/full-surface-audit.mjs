/**
 * full-surface-audit.mjs — exhaustive screenshot of every UI surface
 * Covers: all demo activities, all profiles, all sheets/modals, dropdowns, themes
 * Run: node e2e/full-surface-audit.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3131";
const DIR = "./e2e/screenshots/surfaces";
mkdirSync(DIR, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

let page, browser;
const findings = [];
let shotCount = 0;

async function shot(name) {
  const path = `${DIR}/${String(shotCount++).padStart(3, "0")}-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}`);
  return path;
}

async function fresh(theme = "editorial") {
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_tour_done", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

async function enterDemo(profile = null) {
  // Always open the MENU dropdown first (profile select lives inside it)
  await page.evaluate(() => {
    const d = document.getElementById("demo-dropdown");
    if (d) d.open = true;
  });
  await page.waitForTimeout(200);

  // Switch profile — #demo-select has 'hidden' attr so use evaluate() directly
  if (profile) {
    await page.evaluate((p) => {
      const sel = document.getElementById("demo-select");
      if (sel) {
        sel.value = p;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, profile);
    await page.waitForTimeout(400);
  }

  // Enter demo if not already in it
  const isDemo = await page.evaluate(() =>
    document.body.classList.contains("is-demo"),
  );
  if (!isDemo) {
    await page.click("#demo-toggle-btn");
    await page.waitForTimeout(800);
  } else {
    // Close the dropdown
    await page.evaluate(() => {
      const d = document.getElementById("demo-dropdown");
      if (d) d.open = false;
    });
    await page.waitForTimeout(200);
  }
}

async function closeSheet() {
  // Try Escape first, then any visible close button
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const anyClose = await page.$(
    ".sheet-close, .modal-close, [data-close], #recovery-close-btn, #calib-close-btn",
  );
  if (anyClose) {
    try {
      await anyClose.click();
    } catch {}
    await page.waitForTimeout(300);
  }
}

(async () => {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  page = await ctx.newPage();

  page.on("pageerror", (e) => findings.push(`PAGE ERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const txt = m.text();
      if (
        txt.includes("502") ||
        txt.includes("Failed to fetch") ||
        txt.includes("net::ERR_") ||
        txt.includes("NetworkError")
      )
        return;
      findings.push(`JS ERROR: ${txt}`);
    }
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  // ══════════════════════════════════════════════════════
  // SECTION A: LAYER 0 — Light & Dark
  // ══════════════════════════════════════════════════════
  console.log("\n══ [A] LAYER 0 ══");
  await fresh("editorial");
  await shot("layer0-light");

  await fresh("editorial-dark");
  await shot("layer0-dark");

  // ══════════════════════════════════════════════════════
  // SECTION B: MENU DROPDOWN (open state)
  // ══════════════════════════════════════════════════════
  console.log("\n══ [B] MENU DROPDOWN ══");
  await fresh("editorial");
  await page.evaluate(() => {
    const d = document.getElementById("demo-dropdown");
    if (d) d.open = true;
  });
  await page.waitForTimeout(300);
  await shot("menu-dropdown-open-light");

  await fresh("editorial-dark");
  await page.evaluate(() => {
    const d = document.getElementById("demo-dropdown");
    if (d) d.open = true;
  });
  await page.waitForTimeout(300);
  await shot("menu-dropdown-open-dark");

  // ══════════════════════════════════════════════════════
  // SECTION C: THEME TOGGLE SWITCH
  // ══════════════════════════════════════════════════════
  console.log("\n══ [C] THEME TOGGLE ══");
  await fresh("editorial");
  const toggleEl = await page.$("#theme-mode-toggle");
  if (toggleEl) {
    const box = await toggleEl.boundingBox();
    if (box) {
      // Zoom in on toggle area
      await page.screenshot({
        path: `${DIR}/${String(shotCount++).padStart(3, "0")}-theme-toggle-light-closeup.png`,
        clip: {
          x: Math.max(0, box.x - 40),
          y: Math.max(0, box.y - 10),
          width: box.width + 80,
          height: box.height + 20,
        },
      });
      console.log("  📸 theme-toggle-light-closeup");
    }
  }
  // Toggle to dark and capture
  if (toggleEl) {
    await toggleEl.click();
    await page.waitForTimeout(400);
    const box2 = await toggleEl.boundingBox();
    if (box2) {
      await page.screenshot({
        path: `${DIR}/${String(shotCount++).padStart(3, "0")}-theme-toggle-dark-closeup.png`,
        clip: {
          x: Math.max(0, box2.x - 40),
          y: Math.max(0, box2.y - 10),
          width: box2.width + 80,
          height: box2.height + 20,
        },
      });
      console.log("  📸 theme-toggle-dark-closeup");
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION D: DEMO HOME — ALL PROFILES (light)
  // ══════════════════════════════════════════════════════
  console.log("\n══ [D] DEMO PROFILES (light) ══");
  const profiles = ["sam", "maya", "alex", "jordan"];
  for (const profile of profiles) {
    await fresh("editorial");
    await enterDemo(profile);
    await shot(`demo-home-light-${profile}`);
  }

  // ══════════════════════════════════════════════════════
  // SECTION E: DEMO HOME — ALL PROFILES (dark)
  // ══════════════════════════════════════════════════════
  console.log("\n══ [E] DEMO PROFILES (dark) ══");
  for (const profile of profiles) {
    await fresh("editorial-dark");
    await enterDemo(profile);
    await shot(`demo-home-dark-${profile}`);
  }

  // ══════════════════════════════════════════════════════
  // SECTION F: DEMO ACTIVITY — first card only, light + dark
  // ══════════════════════════════════════════════════════
  console.log("\n══ [F] DEMO ACTIVITY (first card, light) ══");
  await fresh("editorial");
  await enterDemo();
  const activityCards = await page.$$("[data-demo-activity]");
  console.log(`  Found ${activityCards.length} activity cards`);
  if (activityCards.length === 0) {
    findings.push("❌ No [data-demo-activity] cards found in demo");
  } else {
    try {
      const cards = await page.$$("[data-demo-activity]");
      const actId =
        (await cards[0].getAttribute("data-demo-activity")) || "card0";
      await cards[0].click();
      await page.waitForTimeout(800);
      await shot(`demo-activity-light-${actId}`);
      const backBtn = await page.$(
        "[data-demo-back], .demo-back-btn, .demo-scene-back",
      );
      if (backBtn) {
        await backBtn.click();
      } else {
        findings.push("⚠️ No back button found after demo activity");
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(500);
    } catch (e) {
      findings.push(`❌ Demo activity error: ${e.message}`);
    }
  }

  console.log("\n══ [G] DEMO ACTIVITY (first card, dark) ══");
  await fresh("editorial-dark");
  await enterDemo();
  const darkActivityCards = await page.$$("[data-demo-activity]");
  console.log(`  Found ${darkActivityCards.length} activity cards (dark)`);
  if (darkActivityCards.length > 0) {
    try {
      const cards = await page.$$("[data-demo-activity]");
      const actId =
        (await cards[0].getAttribute("data-demo-activity")) || "card0";
      await cards[0].click();
      await page.waitForTimeout(800);
      await shot(`demo-activity-dark-${actId}`);
      const backBtn = await page.$(
        "[data-demo-back], .demo-back-btn, .demo-scene-back",
      );
      if (backBtn) {
        await backBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(500);
    } catch (e) {
      findings.push(`❌ Dark demo activity error: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION H: DEMO WINDOW TOGGLES
  // ══════════════════════════════════════════════════════
  console.log("\n══ [H] DEMO WINDOW TOGGLES ══");
  await fresh("editorial");
  await enterDemo();
  const winBtns = await page.$$("[data-demo-window-hours]");
  console.log(`  Found ${winBtns.length} window toggle buttons`);
  for (let i = 0; i < winBtns.length; i++) {
    const hours = await winBtns[i].getAttribute("data-demo-window-hours");
    await winBtns[i].click();
    await page.waitForTimeout(500);
    await shot(`demo-window-${hours}h`);
  }

  // ══════════════════════════════════════════════════════
  // SECTION I: DEMO HELP MODAL
  // ══════════════════════════════════════════════════════
  console.log("\n══ [I] DEMO HELP MODAL ══");
  await fresh("editorial");
  await enterDemo();
  const demoHelpBtn = await page.$(
    "[data-demo-help], .demo-help-btn, #demo-help-btn",
  );
  if (demoHelpBtn) {
    await demoHelpBtn.click();
    await page.waitForTimeout(400);
    await shot("demo-help-modal");
    const closeHelp = await page.$("[data-demo-help-close], .demo-help-close");
    if (closeHelp) await closeHelp.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    console.log("  ⚠️  No demo help button found (may not exist)");
  }

  // ══════════════════════════════════════════════════════
  // SECTION J: LOG / RATING SHEET
  // ══════════════════════════════════════════════════════
  console.log("\n══ [J] LOG / RATING SHEET ══");
  await fresh("editorial");

  // Energy rating
  const logBtn = await page.$("#log-btn, #energy-btn");
  if (logBtn) {
    await logBtn.click();
    await page.waitForTimeout(500);
    await shot("sheet-log-energy-light");

    // Switch to stress tab if available
    const stressTab = await page.$(
      '[data-kind="stress_rating"], [data-tab="stress"]',
    );
    if (stressTab) {
      await stressTab.click();
      await page.waitForTimeout(300);
      await shot("sheet-log-stress-light");
    }
    await closeSheet();
  } else {
    findings.push("❌ Log/energy button not found");
  }

  // Dark mode rating sheet
  await fresh("editorial-dark");
  const logBtnDark = await page.$("#log-btn, #energy-btn");
  if (logBtnDark) {
    await logBtnDark.click();
    await page.waitForTimeout(500);
    await shot("sheet-log-energy-dark");
    await closeSheet();
  }

  // ══════════════════════════════════════════════════════
  // SECTION K: RECOVERY SHEET
  // ══════════════════════════════════════════════════════
  console.log("\n══ [K] RECOVERY SHEET ══");
  await fresh("editorial");
  const recBtn = await page.$("#recovery-trigger");
  if (recBtn) {
    await recBtn.click();
    await page.waitForTimeout(500);
    await shot("sheet-recovery-light");

    // Scroll down inside recovery sheet to see all options
    const sheet = await page.$(
      ".recovery-sheet, .sheet-body, [data-sheet='recovery']",
    );
    if (sheet) {
      await sheet.evaluate((el) => el.scrollTo(0, 300));
      await page.waitForTimeout(200);
      await shot("sheet-recovery-light-scrolled");
    }
    await closeSheet();
  } else {
    findings.push("❌ #recovery-trigger not found");
  }

  // Dark
  await fresh("editorial-dark");
  const recBtnDark = await page.$("#recovery-trigger");
  if (recBtnDark) {
    await recBtnDark.click();
    await page.waitForTimeout(500);
    await shot("sheet-recovery-dark");
    await closeSheet();
  }

  // ══════════════════════════════════════════════════════
  // SECTION L: TUNE / CALIBRATION MODAL
  // ══════════════════════════════════════════════════════
  console.log("\n══ [L] TUNE / CALIBRATION ══");
  await fresh("editorial");
  const tuneBtn = await page.$("#tune-trigger, #calib-btn");
  if (tuneBtn) {
    await tuneBtn.click();
    await page.waitForTimeout(500);
    await shot("sheet-tune-light");
    await closeSheet();
  } else {
    findings.push("❌ #tune-trigger / #calib-btn not found");
  }

  await fresh("editorial-dark");
  const tuneBtnDark = await page.$("#tune-trigger, #calib-btn");
  if (tuneBtnDark) {
    await tuneBtnDark.click();
    await page.waitForTimeout(500);
    await shot("sheet-tune-dark");
    await closeSheet();
  }

  // ══════════════════════════════════════════════════════
  // SECTION M: HELP SHEET — all 5 tabs, light + dark
  // ══════════════════════════════════════════════════════
  console.log("\n══ [M] HELP SHEET ══");
  const helpTabs = ["about", "shortcuts", "glossary", "howitworks", "pixelart"];

  await fresh("editorial");
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  for (const tab of helpTabs) {
    const tabBtn = await page.$(`[data-help-tab="${tab}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await page.waitForTimeout(250);
      await shot(`help-tab-${tab}-light`);
    } else {
      findings.push(`⚠️ Help tab "${tab}" not found`);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await fresh("editorial-dark");
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  for (const tab of helpTabs) {
    const tabBtn = await page.$(`[data-help-tab="${tab}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await page.waitForTimeout(250);
      await shot(`help-tab-${tab}-dark`);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ══════════════════════════════════════════════════════
  // SECTION N: TOUR OVERLAY
  // ══════════════════════════════════════════════════════
  console.log("\n══ [N] TOUR OVERLAY ══");
  await fresh("editorial");
  try {
    // Tour btn may be inside help sheet — open it first
    await page.keyboard.press("?");
    await page.waitForTimeout(400);
    const tourBtnInHelp = await page.$("#tour-btn");
    if (tourBtnInHelp) {
      // Force-click via JS in case it's hidden
      await page.evaluate(() => document.getElementById("tour-btn")?.click());
      await page.waitForTimeout(500);
      // Close help if still open
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await shot("tour-step1-light");

      for (let step = 2; step <= 10; step++) {
        const nextBtn = await page.$(
          "#tour-next, .tour-next-btn, [data-tour-next]",
        );
        if (!nextBtn) break;
        try {
          await nextBtn.click({ timeout: 3000 });
        } catch {
          await page.evaluate(() =>
            document
              .querySelector("#tour-next, .tour-next-btn, [data-tour-next]")
              ?.click(),
          );
        }
        await page.waitForTimeout(300);
        await shot(`tour-step${step}-light`);
      }
      // Finish/close
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      // No tour btn in help — try directly
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      const tourBtnDirect = await page.$("#tour-btn");
      if (tourBtnDirect) {
        await page.evaluate(() => document.getElementById("tour-btn")?.click());
        await page.waitForTimeout(500);
        await shot("tour-step1-light");
        await page.keyboard.press("Escape");
      } else {
        findings.push("❌ #tour-btn not found anywhere");
      }
    }
  } catch (e) {
    findings.push(`❌ Tour section error: ${e.message.split("\n")[0]}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // ══════════════════════════════════════════════════════
  // SECTION O: STORY MODE
  // ══════════════════════════════════════════════════════
  console.log("\n══ [O] STORY MODE ══");
  await fresh("editorial");
  try {
    // Story btn may also be inside help sheet
    await page.keyboard.press("?");
    await page.waitForTimeout(400);
    const storyBtnInHelp = await page.$("#story-btn");
    if (storyBtnInHelp) {
      await page.evaluate(() => document.getElementById("story-btn")?.click());
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await shot("story-scene1-light");

      for (let scene = 2; scene <= 6; scene++) {
        const nextBtn = await page.$(
          "#story-next, .story-next-btn, [data-story-next]",
        );
        if (!nextBtn) break;
        try {
          await nextBtn.click({ timeout: 3000 });
        } catch {
          await page.evaluate(() =>
            document.querySelector("#story-next, .story-next-btn")?.click(),
          );
        }
        await page.waitForTimeout(400);
        await shot(`story-scene${scene}-light`);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      console.log("  ⚠️  #story-btn not found in help or page");
    }
  } catch (e) {
    findings.push(`❌ Story section error: ${e.message.split("\n")[0]}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // ══════════════════════════════════════════════════════
  // SECTION P: LAYER 1 — light + dark
  // ══════════════════════════════════════════════════════
  console.log("\n══ [P] LAYER 1 ══");
  await fresh("editorial");
  await page.click("#battery-toggle");
  await page.waitForTimeout(600);
  await shot("layer1-light");

  await fresh("editorial-dark");
  await page.click("#battery-toggle");
  await page.waitForTimeout(600);
  await shot("layer1-dark");

  // ══════════════════════════════════════════════════════
  // SECTION Q: LAYER 2 — light + dark
  // ══════════════════════════════════════════════════════
  console.log("\n══ [Q] LAYER 2 ══");
  await fresh("editorial");
  await page.click("#battery-toggle");
  await page.waitForTimeout(400);
  await page.click("#open-diagnostics");
  await page.waitForTimeout(600);
  await shot("layer2-light");

  await fresh("editorial-dark");
  await page.click("#battery-toggle");
  await page.waitForTimeout(400);
  await page.click("#open-diagnostics");
  await page.waitForTimeout(600);
  await shot("layer2-dark");

  // ══════════════════════════════════════════════════════
  // SECTION R: DOCK BUTTONS CLOSE-UP
  // ══════════════════════════════════════════════════════
  console.log("\n══ [R] DOCK BUTTONS ══");
  await fresh("editorial");
  const dock = await page.$("#self-log-dock, .dock, [id*='dock']");
  if (dock) {
    const dBox = await dock.boundingBox();
    if (dBox) {
      await page.screenshot({
        path: `${DIR}/${String(shotCount++).padStart(3, "0")}-dock-light-closeup.png`,
        clip: {
          x: Math.max(0, dBox.x - 20),
          y: Math.max(0, dBox.y - 10),
          width: Math.min(dBox.width + 40, 1440),
          height: dBox.height + 20,
        },
      });
      console.log("  📸 dock-light-closeup");
    }
  }

  await fresh("editorial-dark");
  const dockDark = await page.$("#self-log-dock, .dock, [id*='dock']");
  if (dockDark) {
    const dBox2 = await dockDark.boundingBox();
    if (dBox2) {
      await page.screenshot({
        path: `${DIR}/${String(shotCount++).padStart(3, "0")}-dock-dark-closeup.png`,
        clip: {
          x: Math.max(0, dBox2.x - 20),
          y: Math.max(0, dBox2.y - 10),
          width: Math.min(dBox2.width + 40, 1440),
          height: dBox2.height + 20,
        },
      });
      console.log("  📸 dock-dark-closeup");
    }
  }

  // ══════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════");
  console.log(`Total screenshots: ${shotCount}`);
  console.log(`Output: ${DIR}/`);
  if (findings.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`\n🔍 FINDINGS (${findings.length}):`);
    findings.forEach((f) => console.log(`  ${f}`));
  }

  await browser.close();
})();
