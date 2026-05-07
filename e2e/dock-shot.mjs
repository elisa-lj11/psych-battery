import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const page = await (
  await b.newContext({ viewport: { width: 480, height: 900 } })
).newPage();
await page.goto("http://localhost:3131", { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("pb_seen_intro", "1");
  localStorage.setItem("pb_theme", "editorial");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "e2e/screenshots/audit/CHECK-dock-opacity.png" });
await b.close();
console.log("done");
