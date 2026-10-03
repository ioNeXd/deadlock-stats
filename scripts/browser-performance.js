import { chromium } from "playwright";

const baseUrl = process.env.BROWSER_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const routes = ["", "heroes", "matches", "data"];
const budgets = {
  domContentLoadedMs: 5000,
  lcpMs: 4000,
  cls: 0.15,
  initialTransferBytes: 1_500_000,
};

for (const route of routes) {
  const url = route ? `${baseUrl}/#/${route}` : `${baseUrl}/#/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator("#page-content").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    let cls = 0;
    for (const entry of performance.getEntriesByType("layout-shift")) {
      if (!entry.hadRecentInput) cls += entry.value;
    }
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    const largest = performance.getEntriesByType("largest-contentful-paint").at(-1);
    const transfer = resources.reduce((sum, resource) => sum + Number(resource.transferSize || 0), 0);
    return {
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      responseEndMs: navigation?.responseEnd ?? null,
      fcpMs: paint?.startTime ?? null,
      lcpMs: largest?.startTime ?? null,
      cls,
      transferBytes: transfer,
      resourceCount: resources.length,
      jsResources: resources.filter(resource => /\.js(?:$|\?)/.test(resource.name)).length,
      cssResources: resources.filter(resource => /\.css(?:$|\?)/.test(resource.name)).length,
    };
  });

  console.log(`PERF ${route || "dashboard"} ${JSON.stringify(metrics)}`);
  if (metrics.domContentLoadedMs > budgets.domContentLoadedMs) {
    throw new Error(`${route || "dashboard"} DOMContentLoaded budget exceeded: ${Math.round(metrics.domContentLoadedMs)}ms`);
  }
  if (metrics.lcpMs !== null && metrics.lcpMs > budgets.lcpMs) {
    throw new Error(`${route || "dashboard"} LCP budget exceeded: ${Math.round(metrics.lcpMs)}ms`);
  }
  if (metrics.cls > budgets.cls) {
    throw new Error(`${route || "dashboard"} CLS budget exceeded: ${metrics.cls}`);
  }
  if (route === "" && metrics.transferBytes > budgets.initialTransferBytes) {
    throw new Error(`dashboard initial transfer budget exceeded: ${metrics.transferBytes} bytes`);
  }
}

await browser.close();
console.log("Browser performance budgets passed.");
