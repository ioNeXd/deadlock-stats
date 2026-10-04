import { chromium } from "playwright";

const baseUrl = process.env.BROWSER_BASE_URL || "http://127.0.0.1:4173";
const routes = [
  "", "matches", "players", "heroes", "maps", "items", "builds",
  "leaderboard", "analytics", "item-analytics", "data", "graphql",
  "tools", "api", "ranks", "patches"
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const failures = [];
const skipped = [];

page.on("pageerror", error => failures.push("pageerror: " + error.message));
page.on("console", message => {
  if (message.type() === "error") failures.push("console.error: " + message.text());
});

async function open(route = "") {
  const url = route ? `${baseUrl}/#/${route}` : `${baseUrl}/#/`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator("#page-content").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(350);
  if (response && response.status() >= 500) throw new Error(`HTTP ${response.status()} on ${url}`);
  const text = (await page.locator("#page-content").innerText()).trim();
  if (text.length < 20) throw new Error(`insufficient page content on ${url}`);
  return text;
}

for (const route of routes) {
  await open(route);
  console.log(`PASS route: ${route || "dashboard"}`);
}

await open();
await page.keyboard.press("Control+K");
await page.locator("#command-palette").waitFor({ state: "visible", timeout: 5_000 });
await page.locator("[data-command-palette-input]").fill("Data Explorer");
await page.locator("[data-command-index='0']").click();
await page.waitForURL(/#\/data$/, { timeout: 5_000 });
console.log("PASS command palette navigation");

await open("data");
await page.locator("#operation-list .operation-row").first().waitFor({ state: "visible", timeout: 15_000 });
await page.locator("#operation-filter").fill("heroes");
await page.locator("#operation-list .operation-row").first().click();
await page.locator("#operation-detail").waitFor({ state: "visible", timeout: 5_000 });
if (!(await page.locator("#operation-form").count())) throw new Error("Data Explorer operation form missing");
if (!(await page.locator("#operation-result").count())) throw new Error("Data Explorer response inspector missing");
console.log("PASS Data Explorer operation selection");

await open("heroes");
const heroForm = page.locator("#heroes-filters");
if (await heroForm.count()) {
  await heroForm.locator('input[name="search"]').fill("Abrams");
  await heroForm.locator('select[name="game_mode"]').selectOption("street_brawl");
  await heroForm.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForTimeout(300);
  console.log("PASS hero filters");
} else {
  skipped.push("hero filters: form unavailable");
}

await open("builds");
if (await page.locator("#build-filters").count()) {
  await page.locator("#build-filters input[name='search_name']").fill("test");
  await page.locator("#build-filters").getByRole("button", { name: /Search|Apply|Load/i }).click();
  await page.waitForTimeout(300);
  console.log("PASS build filters");
} else {
  skipped.push("build filters: form unavailable");
}

await open("leaderboard");
if (await page.locator("#leaderboard-filters").count()) {
  await page.locator("#leaderboard-filters select[name='region']").selectOption("SAmerica");
  await page.locator("#leaderboard-filters").getByRole("button", { name: "Load leaderboard" }).click();
  await page.waitForTimeout(300);
  console.log("PASS leaderboard filters");
} else {
  skipped.push("leaderboard filters: form unavailable");
}

await open("matches");
const matchRow = page.locator("#recent-match-list .match-row, #active-match-list .match-row").first();
if (await matchRow.count()) {
  await matchRow.click();
  await page.waitForURL(/#\/matches\/[^/]+$/, { timeout: 8_000 });
  await page.locator("#match-detail-status").waitFor({ state: "visible", timeout: 8_000 });
  console.log("PASS match detail navigation");
} else {
  skipped.push("match detail: no live/recent match row returned by API");
}

await open("players");
await page.locator("#player-search").waitFor({ state: "visible", timeout: 5_000 });
console.log("PASS player search surface");

await open("heroes");
const heroRow = page.locator("#heroes-list a, #heroes-list button, #hero-grid a, #hero-grid button").first();
if (await heroRow.count()) {
  await heroRow.click();
  await page.waitForTimeout(500);
  if (!(await page.locator("#hero-detail-name").count())) throw new Error("hero detail did not render");
  console.log("PASS hero detail navigation");
} else {
  skipped.push("hero detail: no hero result row returned by API");
}

await open("builds");
const buildRow = page.locator("#build-list a, #build-list button").first();
if (await buildRow.count()) {
  await buildRow.click();
  await page.waitForTimeout(500);
  if (!(await page.locator("#build-detail-name").count())) throw new Error("build detail did not render");
  console.log("PASS build detail navigation");
} else {
  skipped.push("build detail: no build result row returned by API");
}

await page.setViewportSize({ width: 390, height: 844 });
await open();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("mobile viewport has horizontal overflow");
console.log("PASS mobile 390px no horizontal overflow");

await page.setViewportSize({ width: 768, height: 1024 });
await open();
if (await page.locator("body").boundingBox() === null) throw new Error("tablet body is not measurable");
console.log("PASS tablet viewport render");

await page.setViewportSize({ width: 1920, height: 1200 });
await open();
console.log("PASS desktop 1920px render");

await open("data");
await page.locator("#operation-list .operation-row").first().click();
const form = page.locator("#operation-form");
if (await form.count()) {
  const firstInput = form.locator("input, select, textarea, button").first();
  await firstInput.focus();
  if (!(await firstInput.evaluate(el => document.activeElement === el))) {
    throw new Error("keyboard focus did not enter Data Explorer form");
  }
  await page.keyboard.press("Shift+Tab");
  console.log("PASS keyboard focus navigation");
}

if (failures.length) throw new Error(failures.join("\n"));
console.log(skipped.length ? `SKIP: ${skipped.join("; ")}` : "No conditional checks skipped.");
await browser.close();
console.log("Browser E2E checks passed.");
