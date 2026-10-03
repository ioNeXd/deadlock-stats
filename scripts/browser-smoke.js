import { chromium } from "playwright";

const baseUrl = process.env.BROWSER_BASE_URL || "http://127.0.0.1:4173";
const routes = [
  "",
  "matches",
  "players",
  "heroes",
  "maps",
  "patches",
  "items",
  "builds",
  "leaderboard",
  "analytics",
  "item-analytics",
  "data",
  "graphql",
  "tools",
  "api",
  "ranks",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];

page.on("pageerror", error => failures.push("pageerror: " + error.message));

for (const route of routes) {
  const url = route ? `${baseUrl}/#/${route}` : `${baseUrl}/#/`;
  const started = Date.now();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(1000);
  if (await page.locator("#page-content").innerText().then(text => text.trim().length) < 20) {
    const diagnostics = await page.evaluate(() => ({
      title: document.title,
      scripts: [...document.scripts].map(script => script.src),
      readyState: document.readyState,
      bodyText: document.body.innerText.slice(0, 500),
    }));
    throw new Error("browser route rendered no content: " + (route || "dashboard") + "\n" + JSON.stringify({ failures, diagnostics }));
  }
  const contentLength = await page.locator("#page-content").innerText().then(text => text.trim().length);
  const activeNavCount = await page.locator(".nav-item.active").count();
  const activeHref = activeNavCount ? await page.locator(".nav-item.active").getAttribute("href") : null;
  const expectedHref = route ? `#/${route}` : "#/";
  if (response && response.status() >= 500) {
    throw new Error(`browser route failed: ${route || "dashboard"} HTTP ${response?.status() ?? "no response"}`);
  }
  if (contentLength < 20) {
    throw new Error(`browser route rendered insufficient content: ${route || "dashboard"}`);
  }
  if (activeNavCount && activeHref !== expectedHref) {
    throw new Error(`browser route active navigation mismatch: ${route || "dashboard"} -> ${activeHref}`);
  }
  console.log(`browser route ok: ${route || "dashboard"} (${Date.now() - started}ms)`);
}

await page.goto(`${baseUrl}/#/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
await page.keyboard.press("Control+K");
await page.locator("#command-palette").waitFor({ state: "visible", timeout: 5_000 });
await page.locator("[data-command-palette-input]").fill("Data Explorer");
await page.locator("[data-command-index='0']").click();
await page.waitForURL(/#\/data$/, { timeout: 5_000 });
console.log("command palette navigation ok");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}/#/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
await page.locator("#page-content").waitFor({ state: "visible", timeout: 10_000 });
const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (horizontalOverflow) {
  throw new Error("mobile viewport has horizontal overflow");
}
console.log("mobile viewport overflow check ok");

const navigation = await page.evaluate(() => performance.getEntriesByType("navigation")[0]);
if (!navigation || navigation.domContentLoadedEventEnd <= 0) {
  throw new Error("navigation timing unavailable");
}
if (navigation.domContentLoadedEventEnd > 5000) {
  throw new Error(`dashboard DOMContentLoaded exceeded 5s: ${Math.round(navigation.domContentLoadedEventEnd)}ms`);
}
console.log(`browser performance smoke ok: DOMContentLoaded ${Math.round(navigation.domContentLoadedEventEnd)}ms`);

if (failures.length) {
  throw new Error(failures.join("\n"));
}

await browser.close();
console.log("Browser smoke checks passed.");
