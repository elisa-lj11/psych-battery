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

// ── Circadian glass legend + batteries + E/S map ──
{
  const p = await freshPage(900, 900, "editorial");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById("open-diagnostics")?.click());
  await p.waitForTimeout(900);

  // circadian chart with glass legend
  await p.evaluate(() =>
    document.getElementById("layer2-circadian")?.scrollIntoView(),
  );
  await p.waitForTimeout(400);
  await p.screenshot({ path: "e2e/screenshots/verify2/circadian-glass.png" });
  console.log("📸 circadian-glass");

  // state tanks (batteries - rounded corners)
  await p.evaluate(() =>
    document.querySelector(".layer2-system-card")?.scrollIntoView(),
  );
  await p.waitForTimeout(300);
  await p.screenshot({ path: "e2e/screenshots/verify2/batteries-rounded.png" });
  console.log("📸 batteries-rounded");

  // E/S map (larger, fills column)
  await p.evaluate(() =>
    document.querySelector(".phase-portrait-section")?.scrollIntoView(),
  );
  await p.waitForTimeout(400);
  await p.screenshot({ path: "e2e/screenshots/verify2/esmap-new.png" });
  console.log("📸 esmap-new");
  await p.close();
}

// ── Drain features (now 8 to match recovery) ──
{
  const p = await freshPage(1200, 1000, "editorial");
  await p.evaluate(() => document.getElementById("battery-toggle")?.click());
  await p.waitForTimeout(600);
  // expand signal breakdown details
  await p.evaluate(() => {
    const els = document.querySelectorAll("details,summary,button");
    for (const el of els) {
      if (/signal breakdown/i.test(el.textContent || "")) {
        el.click();
        break;
      }
    }
  });
  await p.waitForTimeout(600);
  await p.screenshot({
    path: "e2e/screenshots/verify2/drain-features-8.png",
    fullPage: true,
  });
  console.log("📸 drain-features-8");
  // count them
  const counts = await p.evaluate(() => ({
    drain: document.querySelectorAll("#layer1-drain-list .layer-feature-row")
      .length,
    recovery: document.querySelectorAll(
      "#layer1-recovery-list .layer-feature-row",
    ).length,
  }));
  console.log("Feature counts:", counts);
  await p.close();
}

// ── Demo batteries (rounded) ──
{
  const p = await freshPage(480, 900, "editorial");
  await p.evaluate(() => {
    if (typeof enterDemoMode === "function") enterDemoMode("sam");
  });
  await p.waitForTimeout(800);
  await p.screenshot({
    path: "e2e/screenshots/verify2/demo-batteries-rounded.png",
    fullPage: true,
  });
  console.log("📸 demo-batteries-rounded");
  await p.close();
}

await b.close();
console.log("done");
