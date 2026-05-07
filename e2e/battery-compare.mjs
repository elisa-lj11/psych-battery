import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("./e2e/screenshots/battery", { recursive: true });

const b = await chromium.launch({ headless: true });

for (const theme of ["editorial", "editorial-dark"]) {
  const page = await (
    await b.newContext({ viewport: { width: 480, height: 900 } })
  ).newPage();
  await page.goto("http://localhost:3131", { waitUntil: "networkidle" });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem("pb_seen_intro", "1");
    localStorage.setItem("pb_tour_done", "1");
    localStorage.setItem("pb_theme", t);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `e2e/screenshots/battery/${theme}-layer0.png`,
  });
  console.log(`📸 ${theme} layer0`);
  await page.close();
}

await b.close();
console.log("done");
