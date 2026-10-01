import { listHeroes, listItems, listRanks } from "./services/assets.js";
import { getOpenApiContract } from "./services/versioning.js";
import { probeApiStatus } from "./services/api-status.js";
import { describeOperation, executeOperation, listApiOperations } from "./services/data-explorer.js";
import { API_BASE_URL } from "./api/client.js";
import { resolveAssetImage } from "./adapters/assets.js";
import { colorToCss, createAssetVersionContext } from "./services/asset-version.js";

const $ = selector => document.querySelector(selector);
const el = { content: $("#page-content"), dot: $("#api-dot"), status: $("#api-status") };
const assetVersion = createAssetVersionContext();
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const nameOf = hero => hero?.name ?? hero?.display_name ?? hero?.hero_name ?? ("Hero " + (hero?.id ?? "?"));
const idOf = hero => hero?.id ?? hero?.hero_id ?? hero?.class_name ?? "—";

function setConnection(online, label) {
  el.dot.classList.toggle("online", online);
  el.dot.classList.toggle("offline", !online);
  el.status.textContent = label;
}

function renderHeroGrid(data) {
  const heroes = Array.isArray(data) ? data : (data?.data ?? []);
  const grid = $("#hero-grid");
  grid.innerHTML = heroes.slice(0, 8).map(hero => {
    const image = resolveAssetImage(hero, ["hero_card_critical_webp", "hero_card_critical", "background_image_webp", "background_image"]);
    const heroColor = colorToCss(hero?.colors?.ui);
    return '<a class="hero-card" href="#/heroes/' + encodeURIComponent(idOf(hero)) + '">' +
      (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : "") +
      '<div class="hero-info"' + (heroColor ? ' style="--hero-accent:' + esc(heroColor) + '"' : "") + '><small>HERO ASSET</small><h3>' + esc(nameOf(hero)) + '</h3><p>ID ' + esc(idOf(hero)) + '</p></div></a>';
  }).join("") || '<article class="panel"><p>No hero assets returned.</p></article>';
}

function renderVersionControl() {
  const versions = assetVersion.list();
  return '<label class="version-control"><span>CLIENT VERSION</span><select id="client-version"><option value="">LATEST</option>' +
    versions.slice().reverse().map(version => '<option value="' + esc(version) + '"' +
      (assetVersion.get() === version ? ' selected' : '') + '>BUILD ' + esc(version) + '</option>').join("") +
    '</select></label>';
}

async function applyAssetColors() {
  try {
    const result = await assetVersion.loadColors();
    const colors = result?.data && typeof result.data === "object" ? result.data : {};
    const root = document.documentElement;
    for (const [name, value] of Object.entries(colors)) {
      const css = colorToCss(value);
      if (css && /^[a-z0-9_]+$/.test(name)) root.style.setProperty("--api-" + name.replaceAll("_", "-"), css);
    }
  } catch (error) {
    console.warn("Deadlock API color palette unavailable", error);
  }
}

async function loadAssetVersionContext() {
  try {
    await assetVersion.load({ cacheTtlMs: 10 * 60_000 });
  } catch (error) {
    console.warn("Deadlock API client versions unavailable", error);
  }
  await applyAssetColors();
}

function renderDashboard() {
  el.content.innerHTML = '<section class="hero-banner"><div><div class="dashboard-controls">' + renderVersionControl() + '</div><span class="eyebrow">LIVE DATA</span><h2>The city never sleeps.</h2><p>Explore Deadlock through live game data and visual assets delivered directly by the API.</p><div class="pills"><span>API-FIRST</span><span>OPENAPI</span></div></div></section>' +
    '<section class="section"><div class="section-head"><div><span class="eyebrow">ROSTER</span><h2>Heroes in the city</h2></div><a href="#/heroes">View all →</a></div><div id="hero-grid" class="hero-grid" aria-live="polite"></div></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">SYSTEM</span><h2>API connection</h2></div><b id="api-badge">CHECKING</b></div><div class="metric"><span>Endpoint</span><strong>' + esc(API_BASE_URL.replace("https://", "")) + '</strong></div><div class="metric"><span>Hero assets</span><strong id="asset-count">—</strong></div><div class="metric"><span>Response</span><strong id="api-latency">—</strong></div></article><article class="panel quote"><span>“</span><p>Data should feel like it belongs to the world it describes.</p><small>DEADLOCK STATS / NEW SITE</small></article></section>';
  loadDashboard();
}

async function loadDashboard() {
  try {
    const result = await listHeroes(assetVersion.options());
    setConnection(true, "API connected");
    $("#asset-count").textContent = result.data.length;
    $("#api-latency").textContent = result.latencyMs + " ms";
    $("#api-badge").textContent = "ONLINE";
    $("#api-badge").classList.add("online");
    renderHeroGrid(result.data);
  } catch (error) {
    setConnection(false, "API unavailable");
    $("#api-badge").textContent = "OFFLINE";
    $("#api-latency").textContent = "—";
    renderHeroGrid([]);
    console.error("Deadlock API request failed", { url: error?.url ?? API_BASE_URL, status: error?.status ?? null, error });
  }
}

function renderAssetCatalog(kind) {
  const config = {
    heroes: { title: "Heroes", eyebrow: "GAME / HEROES", description: "Hero metadata and real game assets from the current Deadlock API contract.", loader: listHeroes },
    items: { title: "Items", eyebrow: "GAME / ITEMS", description: "Items, abilities, weapons and upgrades published by the current game data.", loader: listItems },
    ranks: { title: "Ranks", eyebrow: "GAME / RANKS", description: "Rank metadata, names and badge assets published by the API.", loader: listRanks },
  }[kind];
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">' + config.eyebrow + '</span><h2>' + config.title + '</h2><p>' + config.description + '</p></section><section class="asset-catalog" id="asset-catalog"><div class="panel"><p>Loading assets…</p></div></section>';
  config.loader(assetVersion.options()).then(result => {
    const catalog = $("#asset-catalog");
    catalog.innerHTML = result.data.map(entity => {
      const image = resolveAssetImage(entity);
      return '<article class="asset-card">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<div class="asset-placeholder">NO ART</div>') + '<div><small>' + kind.toUpperCase() + '</small><h3>' + esc(entity.name ?? "Unnamed") + '</h3><p>ID ' + esc(entity.id ?? "—") + '</p></div></article>';
    }).join("") || '<div class="panel"><p>No assets returned.</p></div>';
    setConnection(true, "API connected");
  }).catch(error => {
    $("#asset-catalog").innerHTML = '<div class="panel"><p class="error-text">Asset request failed: ' + esc(error.message) + '</p></div>';
    setConnection(false, "API unavailable");
  });
}

function renderApiStatus() {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">SYSTEM / API</span><h2>API Status</h2><p>Live health probe for the documented Deadlock API infrastructure.</p></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">HEALTH</span><h2 id="status-title">Checking…</h2></div><b id="status-badge">CHECKING</b></div><div id="status-metrics"></div></article><article class="panel"><span class="eyebrow">SERVICES</span><h2>Infrastructure</h2><div id="service-list"></div></article></section>';
  loadApiStatus();
}

async function loadApiStatus() {
  const result = await probeApiStatus();
  const badge = $("#status-badge");
  badge.textContent = result.online ? (result.healthy === false ? "DEGRADED" : "ONLINE") : "OFFLINE";
  badge.classList.toggle("online", result.online && result.healthy !== false);
  $("#status-title").textContent = result.online ? (result.healthy === false ? "API reachable, service degraded" : "All required services healthy") : "API unreachable";
  $("#status-metrics").innerHTML = [["HTTP status", result.status ?? "—"], ["Latency", result.latencyMs != null ? result.latencyMs + " ms" : "—"], ["Endpoint", result.url ? new URL(result.url).pathname : "/v1/info/health"], ["Retry-After", result.headers?.["retry-after"] ?? "—"]].map(item => '<div class="metric"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong></div>').join("");
  const services = result.services ?? {};
  $("#service-list").innerHTML = ["clickhouse","postgres","redis"].map(name => {
    const value = services[name];
    return '<div class="metric"><span>' + esc(name) + '</span><strong>' + (value === true ? "HEALTHY" : value === false ? "UNHEALTHY" : "UNKNOWN") + '</strong></div>';
  }).join("");
  setConnection(result.online, result.online ? "API connected" : "API unavailable");
}

function renderDataExplorer() {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">TOOLS / OPENAPI</span><h2>Data Explorer</h2><p>Inspect and execute documented API operations from the live OpenAPI contract.</p></section>' +
    '<section class="explorer"><aside class="explorer-list"><input id="operation-filter" class="explorer-search" placeholder="Filter operations…"><div id="operation-list"></div></aside><article class="panel explorer-main"><div id="explorer-empty"><span class="eyebrow">CONTRACT</span><h3>Select an operation</h3><p>The explorer is populated from the live OpenAPI contract.</p></div><div id="operation-detail" hidden></div></article></section>';
  loadExplorer();
}

async function loadExplorer() {
  try {
    const contractResult = await getOpenApiContract({ cacheTtlMs: 5 * 60_000 });
    const operations = listApiOperations(contractResult.data);
    const list = $("#operation-list");
    const filter = $("#operation-filter");
    const renderList = () => {
      const query = filter.value.trim().toLowerCase();
      const filtered = operations.filter(operation => !query || [operation.operationId, operation.path, operation.summary, ...operation.tags].join(" ").toLowerCase().includes(query));
      list.innerHTML = filtered.map(operation => '<button class="operation-row" data-operation-id="' + esc(operation.operationId) + '"><span class="method ' + operation.method.toLowerCase() + '">' + operation.method + '</span><span><b>' + esc(operation.operationId) + '</b><small>' + esc(operation.path) + '</small></span>' + (operation.deprecated ? "<em>deprecated</em>" : "") + "</button>").join("") || '<p class="muted">No operations match.</p>';
      list.querySelectorAll(".operation-row").forEach(button => button.addEventListener("click", () => renderOperation(operations.find(operation => operation.operationId === button.dataset.operationId))));
    };
    filter.addEventListener("input", renderList);
    renderList();
    setConnection(true, "API connected");
  } catch (error) {
    list.innerHTML = '<p class="error-text">OpenAPI contract could not be loaded: ' + esc(error.message) + "</p>";
    setConnection(false, "API unavailable");
  }
}

function schemaPlaceholder(schema) {
  if (!schema) return "value";
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type) return schema.type;
  if (schema.$ref) return schema.$ref.split("/").pop();
  return "value";
}

function renderOperation(operation) {
  const detail = describeOperation(operation);
  $("\\#explorer-empty").hidden = true;
  const target = $("\\#operation-detail");
  target.hidden = false;

  const parameterFields = detail.parameterSummary.map(parameter => {
    const schema = parameter.schema;
    const constraints = [];
    if (parameter.constraints.minimum != null) constraints.push("min " + parameter.constraints.minimum);
    if (parameter.constraints.maximum != null) constraints.push("max " + parameter.constraints.maximum);
    if (parameter.constraints.minItems != null) constraints.push("min items " + parameter.constraints.minItems);
    if (parameter.constraints.maxItems != null) constraints.push("max items " + parameter.constraints.maxItems);

    const options = parameter.enum.length
      ? '<select name="' + esc(parameter.name) + '"><option value="">—</option>' +
        parameter.enum.map(value => '<option value="' + esc(value) + '">' + esc(value) + "</option>").join("") + "</select>"
      : '<input name="' + esc(parameter.name) + '" placeholder="' + esc(schemaPlaceholder(schema)) + '"' +
        (parameter.constraints.default != null ? ' value="' + esc(parameter.constraints.default) + '"' : "") +
        (parameter.required ? " required" : "") + ">";

    return '<label class="field"><span>' + esc(parameter.name) + ' <small>' +
      esc(parameter.in) + (parameter.required ? " · required" : "") +
      (parameter.deprecated ? " · deprecated" : "") + '</small></span>' +
      (parameter.description ? '<small class="muted">' + esc(parameter.description) + "</small>" : "") +
      options +
      (constraints.length ? '<small class="muted">' + esc(constraints.join(" · ")) + "</small>" : "") +
      "</label>";
  }).join("");

  const bodyTypes = detail.requestBodyInfo ?? [];
  const bodyField = bodyTypes.length
    ? '<label class="field"><span>Request body <small>' + (bodyTypes[0].required ? "required · " : "") + "JSON/body</small></span>" +
      '<select name="__contentType">' +
      bodyTypes.map(item => '<option value="' + esc(item.mediaType) + '">' + esc(item.mediaType) + "</option>").join("") +
      "</select><textarea name=\"__body\" rows=\"8\" placeholder=\"{ }\"></textarea></label>"
    : "";

  const responseSummary = detail.responseInfo.map(response =>
    '<div class="metric"><span>' + esc(response.status) + "</span><strong>" +
    esc(response.description || "Response") + "</strong></div>"
  ).join("");

  const securitySummary = detail.security.length
    ? '<div class="result-box"><span class="eyebrow">SECURITY</span><p class="muted">' +
      esc(detail.security.map(requirement => Object.keys(requirement).join(", ") || "optional").join(" · ")) +
      "</p></div>"
    : "";

  target.innerHTML =
    '<div class="operation-title"><div><span class="method ' + operation.method.toLowerCase() + '">' + operation.method +
    '</span><h3>' + esc(operation.operationId) + '</h3><code>' + esc(operation.path) + '</code></div>' +
    (operation.deprecated ? "<b>DEPRECATED</b>" : "") + "</div>" +
    '<p class="muted">' + esc(operation.description || operation.summary) + "</p>" +
    (securitySummary ? securitySummary : "") +
    '<form id="operation-form">' + parameterFields + bodyField +
    '<button class="primary-button" type="submit">Execute request</button></form>' +
    '<div id="operation-result" class="result-box"><span class="eyebrow">RESPONSE</span><pre>Waiting for request.</pre></div>' +
    '<div class="result-box"><span class="eyebrow">DOCUMENTED RESPONSES</span>' + responseSummary + "</div>";

  $("#operation-form").addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const resultBox = $("#operation-result");
    resultBox.querySelector("pre").textContent = "Loading…";
    try {
      const result = await executeOperation(operation, values);
      resultBox.querySelector("pre").textContent = JSON.stringify({
        status: result.status,
        latencyMs: result.latencyMs,
        url: result.url,
        contentType: result.contentType,
        request: result.request,
        data: result.data,
      }, null, 2);
    } catch (error) {
      resultBox.querySelector("pre").textContent = JSON.stringify({
        error: error.message,
        status: error.status ?? null,
        retryAfterMs: error.retryAfterMs ?? null,
        url: error.url ?? null,
      }, null, 2);
    }
  });
}

function bindVersionControl() {
  const select = $("#client-version");
  if (!select) return;
  select.addEventListener("change", async event => {
    assetVersion.set(event.target.value);
    await applyAssetColors();
    route();
  });
}

function route() {
  const routeName = location.hash.replace(/^#\\/?/, "").split("/")[0] || "dashboard";
  if (routeName === "api") renderApiStatus();
  else if (routeName === "data") renderDataExplorer();
  else if (routeName === "heroes" || routeName === "items" || routeName === "ranks") renderAssetCatalog(routeName);
  else renderDashboard();
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.getAttribute("href") === "#/" + (routeName === "dashboard" ? "" : routeName)));
  bindVersionControl();
}

window.addEventListener("hashchange", route);
loadAssetVersionContext().finally(route);
