import { getActiveMatchesSnapshot, getRecentlyFetchedMatchesSnapshot, getBulkMatchMetadataSnapshot } from "./services/matches.js";
import { listHeroes, listItems, listRanks, listMiscEntities } from "./services/assets.js";
import { getOpenApiContract } from "./services/versioning.js";
import { probeApiStatus } from "./services/api-status.js";
import { describeOperation, executeOperation, listApiOperations } from "./services/data-explorer.js";
import { API_BASE_URL } from "./api/client.js";
import { resolveAssetImage } from "./adapters/assets.js";
import { colorToCss, createAssetVersionContext } from "./services/asset-version.js";
import { getDashboardSnapshot } from "./services/dashboard.js";
import { listBuilds } from "./services/builds.js";
import { safeExternalUrl } from "./ui/security.js";
import { getAnalyticsSnapshot, getHeroStatsSnapshot, getHeroMatchupSnapshot, getHeroBuildStatsSnapshot, getAbilityOrderStatsSnapshot, getHeroComboSnapshot, getBuildItemSnapshot, getBuffSnapshot, getBadgeDistributionSnapshot, getItemStatsSnapshot, getItemPermutationSnapshot, getItemFlowSnapshot, normalizeGameStats, normalizeHeroBanStats } from "./services/analytics.js";

const $ = selector => document.querySelector(selector);
const el = { content: $("#page-content"), dot: $("#api-dot"), status: $("#api-status") };
const assetVersion = createAssetVersionContext();
let routeController = null;
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
    return '<a class="hero-card" href="#/heroes">' +
      (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : "") +
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

function isAborted(error) {
  return error?.code === "ABORTED" || error?.name === "AbortError";
}

function beginRoute() {
  routeController?.abort();
  routeController = new AbortController();
  return routeController.signal;
}

function renderDashboard(signal) {
  el.content.innerHTML = '<section class="hero-banner"><div><div class="dashboard-controls">' + renderVersionControl() + '</div><span class="eyebrow">LIVE DATA</span><h2>The city never sleeps.</h2><p>Explore Deadlock through live game data and visual assets delivered directly by the API.</p><div class="pills"><span>API-FIRST</span><span>OPENAPI</span><span>LIVE CONTRACT</span></div></div></section>' +
    '<section class="dashboard-metrics">' +
      '<article class="metric-card"><span>FETCHED MATCHES / 24H</span><strong id="matches-per-day">—</strong><small>API info</small></article>' +
      '<article class="metric-card"><span>DATABASE TABLES</span><strong id="table-count">—</strong><small>reported by API</small></article>' +
      '<article class="metric-card"><span>KNOWN ROWS</span><strong id="known-rows">—</strong><small>reported table sizes</small></article>' +
      '<article class="metric-card"><span>HERO ASSETS</span><strong id="asset-count">—</strong><small>current catalog response</small></article>' +
    '</section>' +
    '<section class="section"><div class="section-head"><div><span class="eyebrow">ROSTER</span><h2>Heroes in the city</h2></div><a href="#/heroes">View all →</a></div><div id="hero-grid" class="hero-grid" aria-live="polite"></div></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">SYSTEM</span><h2>API connection</h2></div><b id="api-badge">CHECKING</b></div><div class="metric"><span>Endpoint</span><strong>' + esc(API_BASE_URL.replace("https://", "")) + '</strong></div><div class="metric"><span>Hero response</span><strong id="api-latency">—</strong></div><div class="metric"><span>Latest patch</span><strong id="latest-patch" class="patch-link">Loading…</strong></div></article><article class="panel quote"><span>“</span><p>Data should feel like it belongs to the world it describes.</p><small>DEADLOCK STATS / NEW SITE</small></article></section>';
  loadDashboard(signal);
}

async function loadDashboard(signal) {
  const options = { ...assetVersion.options(), signal };
  const [heroesResult, snapshotResult] = await Promise.allSettled([
    listHeroes(options),
    getDashboardSnapshot(options),
  ]);

  if (signal.aborted) return;

  const heroes = heroesResult.status === "fulfilled" ? heroesResult.value : null;
  const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;

  if (heroes) {
    $("#asset-count").textContent = heroes.data.length;
    $("#api-latency").textContent = heroes.latencyMs + " ms";
    renderHeroGrid(heroes.data);
  } else {
    $("#asset-count").textContent = "—";
    $("#api-latency").textContent = "—";
    renderHeroGrid([]);
  }

  if (snapshot) {
    const info = snapshot.info?.data ?? {};
    const tableSizes = info.table_sizes && typeof info.table_sizes === "object" ? info.table_sizes : {};
    const knownRows = Object.values(tableSizes)
      .map(table => Number(table?.rows))
      .filter(Number.isFinite)
      .reduce((sum, rows) => sum + rows, 0);
    $("#matches-per-day").textContent = Number.isFinite(Number(info.fetched_matches_per_day))
      ? Number(info.fetched_matches_per_day).toLocaleString()
      : "—";
    $("#table-count").textContent = Object.keys(tableSizes).length || "—";
    $("#known-rows").textContent = knownRows ? knownRows.toLocaleString() : "—";

    const patch = snapshot.latestPatch;
    const patchUrl = safeExternalUrl(patch?.link);
    const patchTitle = esc(patch?.title ?? "Latest patch");
    const patchDate = patch?.pub_date ? new Date(patch.pub_date).toLocaleDateString() : "Unknown date";
    const patchMeta = esc(patch?.source?.toUpperCase() ?? "FEED") + " · " + esc(patchDate);
    $("#latest-patch").innerHTML = patch
      ? (patchUrl
        ? '<a href="' + esc(patchUrl) + '" target="_blank" rel="noopener noreferrer">' + patchTitle + '</a><small>' + patchMeta + '</small>'
        : '<span>' + patchTitle + '</span><small>' + patchMeta + '</small>')
      : "No patch feed entries returned.";
  } else {
    $("#matches-per-day").textContent = "—";
    $("#table-count").textContent = "—";
    $("#known-rows").textContent = "—";
    $("#latest-patch").textContent = "Patch feed unavailable.";
  }

  if (heroes || snapshot) {
    setConnection(true, "API connected");
    $("#api-badge").textContent = snapshot ? "ONLINE" : "PARTIAL";
    $("#api-badge").classList.add("online");
  } else {
    setConnection(false, "API unavailable");
    $("#api-badge").textContent = "OFFLINE";
    renderHeroGrid([]);
  }

  for (const result of [heroesResult, snapshotResult]) {
    if (result.status === "rejected" && !isAborted(result.reason)) {
      console.error("Deadlock API request failed", result.reason);
    }
  }
}

function renderAssetCatalog(kind, signal) {
  const config = {
    heroes: { title: "Heroes", eyebrow: "GAME / HEROES", description: "Hero metadata and real game assets from the current Deadlock API contract.", loader: listHeroes },
    items: { title: "Items", eyebrow: "GAME / ITEMS", description: "Items, abilities, weapons and upgrades published by the current game data.", loader: listItems },
    ranks: { title: "Ranks", eyebrow: "GAME / RANKS", description: "Rank metadata, names and badge assets published by the API.", loader: listRanks },
  }[kind];
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">' + config.eyebrow + '</span><h2>' + config.title + '</h2><p>' + config.description + '</p></section><section class="asset-catalog" id="asset-catalog"><div class="panel"><p>Loading assets…</p></div></section>';
  config.loader({ ...assetVersion.options(), signal }).then(result => {
    if (signal.aborted) return;
    const catalog = $("#asset-catalog");
    catalog.innerHTML = result.data.map(entity => {
      const image = resolveAssetImage(entity);
      return '<article class="asset-card">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '<div class="asset-placeholder">NO ART</div>') + '<div><small>' + kind.toUpperCase() + '</small><h3>' + esc(entity.name ?? "Unnamed") + '</h3><p>ID ' + esc(entity.id ?? "—") + '</p></div></article>';
    }).join("") || '<div class="panel"><p>No assets returned.</p></div>';
    setConnection(true, "API connected");
  }).catch(error => {
    if (isAborted(error)) return;
    const catalog = $("#asset-catalog");
    if (!catalog) return;
    catalog.innerHTML = '<div class="panel"><p class="error-text">Asset request failed: ' + esc(error.message) + '</p></div>';
    setConnection(false, "API unavailable");
  });
}

function normalizeAnalyticsFilters(filters = {}) {
  const normalized = { ...filters };
  for (const key of ["min_unix_timestamp", "max_unix_timestamp"]) {
    if (normalized[key]) {
      const timestamp = /^\d+$/.test(String(normalized[key])) ? Number(normalized[key]) : Math.floor(new Date(normalized[key] + "T00:00:00Z").getTime() / 1000);
      if (Number.isFinite(timestamp)) normalized[key] = timestamp;
      else delete normalized[key];
    }
  }
  for (const key of ["min_average_badge", "max_average_badge", "min_duration_s", "max_duration_s", "min_networth", "max_networth", "comb_size"]) {
    if (normalized[key] !== undefined && normalized[key] !== "") normalized[key] = Number(normalized[key]);
    else delete normalized[key];
  }
  for (const key of ["hero_ids", "account_ids", "include_item_ids", "exclude_item_ids", "ability_order_prefix", "ability_unlock_order_prefix"]) {
    if (normalized[key] === undefined || normalized[key] === "") {
      delete normalized[key];
      continue;
    }
    const values = String(normalized[key]).split(",").map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value >= 0);
    if (values.length) normalized[key] = values;
    else delete normalized[key];
  }
  for (const key of ["is_high_skill_range_parties", "is_low_pri_pool", "is_new_player_pool"]) {
    if (normalized[key] === "") delete normalized[key];
    else if (normalized[key] !== undefined) normalized[key] = normalized[key] === "true";
  }
  return normalized;
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return "—";
  const value = Number(seconds);
  return Math.floor(value / 60) + "m " + Math.round(value % 60) + "s";
}

function renderItemAnalytics(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">ANALYTICS / ITEM INTELLIGENCE</span><h2>Item Intelligence</h2><p>Purchase performance, permutations and phase-to-phase build flow from the documented Deadlock analytics API.</p></section>' +
    '<section class="panel analytics-filter-panel"><div class="section-head"><div><span class="eyebrow">SCOPE</span><h2>Item analytics filters</h2></div><b id="item-analytics-status">LOADING</b></div><form id="item-analytics-filters" class="analytics-filters">' +
    '<label class="field"><span>Game mode</span><select name="game_mode"><option value="normal" selected>Normal</option><option value="street_brawl">Street Brawl</option></select></label>' +
    '<label class="field"><span>Match mode</span><select name="match_mode"><option value="ranked,unranked" selected>Ranked + Unranked</option><option value="ranked">Ranked</option><option value="unranked">Unranked</option></select></label>' +
    '<label class="field"><span>From</span><input name="min_unix_timestamp" type="date"></label><label class="field"><span>To</span><input name="max_unix_timestamp" type="date"></label>' +
    '<label class="field"><span>Hero IDs</span><input name="hero_ids" type="text" inputmode="numeric" placeholder="1, 2, 3"></label>' +
    '<label class="field"><span>Enemy Hero IDs</span><input name="enemy_hero_ids" type="text" inputmode="numeric" placeholder="1, 2"></label>' +
    '<label class="field"><span>Min matches</span><input name="min_matches" type="number" min="1" value="20"></label>' +
    '<label class="field"><span>Item bucket</span><select name="bucket"><option value="no_bucket" selected>Overall</option><option value="hero">Hero</option><option value="team">Team</option><option value="game_time_min">Game minute</option><option value="game_time_normalized_percentage">Game time %</option><option value="net_worth_by_1000">Net worth / 1000</option><option value="net_worth_by_5000">Net worth / 5000</option></select></label>' +
    '<label class="field"><span>Corrupted items</span><select name="corrupted_items"><option value="exclude" selected>Exclude</option><option value="include">Include</option><option value="only">Only</option></select></label>' +
    '<label class="field"><span>Permutation size</span><input name="comb_size" type="number" min="2" max="12" value="2"></label><label class="field"><span>Locked item IDs</span><input name="locked_item_ids" type="text" inputmode="numeric" placeholder="item IDs"></label><label class="field"><span>Locked columns</span><input name="locked_columns" type="text" inputmode="numeric" placeholder="0, 1"></label>' +
    '<button class="primary-button" type="submit">Apply filters</button></form></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">ITEM STATS</span><h2>Purchase performance</h2></div></div><div id="item-stats-list" class="analytics-item-grid"><p class="muted">Loading item statistics.</p></div></article>' +
    '<article class="panel"><div class="section-head"><div><span class="eyebrow">PERMUTATIONS</span><h2>Item combinations</h2></div></div><div id="item-permutation-list" class="analytics-table"><p class="muted">Loading item combinations.</p></div></article></section>' +
    '<section class="panel item-flow-panel"><div class="section-head"><div><span class="eyebrow">ITEM FLOW</span><h2>Build progression</h2></div><span class="muted">PHASE NODES + TRANSITIONS</span></div><div id="item-flow-summary" class="analytics-grid"></div><div id="item-flow-list" class="item-flow-grid"><p class="muted">Loading item flow.</p></div><div class="section-head item-flow-transitions-head"><div><span class="eyebrow">TRANSITIONS</span><h3>Next-stage purchases</h3></div></div><div id="item-flow-edges" class="analytics-table"><p class="muted">Loading transitions.</p></div></section>';

  const form = $("#item-analytics-filters");
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  form.elements.min_unix_timestamp.value = from;
  form.elements.max_unix_timestamp.value = new Date().toISOString().slice(0, 10);

  const normalize = values => {
    const result = { ...values };
    for (const key of ["min_unix_timestamp", "max_unix_timestamp"]) {
      if (result[key]) result[key] = Math.floor(new Date(result[key] + "T00:00:00Z").getTime() / 1000);
      else delete result[key];
    }
    for (const key of ["hero_ids", "enemy_hero_ids"]) {
      if (result[key]) result[key] = String(result[key]).split(",").map(value => Number(value.trim())).filter(Number.isInteger);
      else delete result[key];
    }
    for (const key of ["locked_item_ids", "locked_columns"]) {
      if (result[key]) result[key] = String(result[key]).split(",").map(value => Number(value.trim())).filter(Number.isInteger);
      else delete result[key];
    }
    if (result.locked_item_ids?.length || result.locked_columns?.length) {
      if ((result.locked_item_ids?.length ?? 0) !== (result.locked_columns?.length ?? 0)) {
        throw new TypeError("Locked item IDs and locked columns must have the same length.");
      }
    }
    for (const key of ["min_matches", "comb_size"]) {
      if (result[key] !== "") result[key] = Number(result[key]);
      else delete result[key];
    }
    return result;
  };

  const itemName = new Map();
  const itemImage = new Map();

  const load = async filters => {
    $("#item-analytics-status").textContent = "LOADING";
    try {
      const [items, stats, permutations, flow] = await Promise.all([
        listItems({ ...assetVersion.options(), signal }),
        getItemStatsSnapshot({ ...assetVersion.options(), ...filters, signal }),
        getItemPermutationSnapshot({ ...assetVersion.options(), ...filters, signal }),
        getItemFlowSnapshot({ ...assetVersion.options(), ...filters, signal }),
      ]);
      if (signal.aborted) return;
      for (const item of items.data ?? []) {
        const id = Number(item.id);
        if (Number.isFinite(id)) {
          itemName.set(id, item.name ?? "Item " + id);
          const image = resolveAssetImage(item);
          if (image) itemImage.set(id, image);
        }
      }

      const statsList = $("#item-stats-list");
      statsList.innerHTML = stats.slice().sort((a,b) => Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 24).map(item => {
        const winRate = Number(item.matches) > 0 ? Number(item.wins) / Number(item.matches) * 100 : null;
        const image = itemImage.get(Number(item.itemId));
        return '<article class="item-analytics-card">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '<div class="asset-placeholder">ITEM</div>') +
          '<div><strong>' + esc(itemName.get(Number(item.itemId)) ?? "Item " + item.itemId) + '</strong><small>ID ' + esc(item.itemId) + '</small><span>' + (winRate == null ? "—" : winRate.toFixed(1) + "% WR") + ' · ' + esc(Number(item.matches ?? 0).toLocaleString()) + ' matches</span><span>BUY ' + esc(formatDuration(item.avgBuyTimeS)) + ' · SELL ' + esc(formatDuration(item.avgSellTimeS)) + '</span></div></article>';
      }).join("") || '<p class="muted">No item statistics returned.</p>';

      $("#item-permutation-list").innerHTML = permutations.slice(0, 30).map(item => {
        const names = item.itemIds.map(id => itemName.get(Number(id)) ?? "Item " + id);
        const rate = Number(item.matches) > 0 ? Number(item.wins) / Number(item.matches) * 100 : null;
        return '<div class="analytics-table-row"><span>' + esc(names.join(" + ")) + '<small class="matchup-meta">' + esc(item.itemIds.join(", ")) + '</small></span><strong>' + (rate == null ? "—" : rate.toFixed(1) + "%") + ' · ' + esc(item.matches ?? 0) + '</strong></div>';
      }).join("") || '<p class="muted">No item combinations returned.</p>';

      const flow = $("#item-flow-list");
      const nodes = flowData => flowData.nodes.slice().sort((a,b) => Number(a.column ?? 0) - Number(b.column ?? 0) || Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 48);
      const flowNodes = nodes(flow);
      const columns = [...new Set(flowNodes.map(node => Number(node.column ?? 0)))];
      flow.innerHTML = columns.map(column => {
        const entries = flowNodes.filter(node => Number(node.column ?? 0) === column).slice(0, 8);
        return '<section class="item-flow-column"><span class="eyebrow">PHASE ' + esc(column + 1) + '</span>' + entries.map(node => {
          const rate = Number(node.matches) > 0 ? Number(node.wins) / Number(node.matches) * 100 : null;
          return '<div class="item-flow-node">' + (itemImage.get(Number(node.itemId)) ? '<img src="' + esc(itemImage.get(Number(node.itemId))) + '" alt="" loading="lazy" decoding="async">' : '') + '<div><strong>' + esc(itemName.get(Number(node.itemId)) ?? "Item " + node.itemId) + '</strong><small>' + (rate == null ? "—" : rate.toFixed(1) + "% WR") + ' · ' + esc(node.matches ?? 0) + ' matches</small>' + (node.adjustedWinRate == null ? '' : '<small>ADJ ' + (Number(node.adjustedWinRate) * 100).toFixed(1) + '%</small>') + '</div></div>';
        }).join("") + '</section>';
      }).join("") || '<p class="muted">No flow nodes returned.</p>';

      $("#item-flow-edges").innerHTML = (flow.edges ?? []).slice().sort((a,b) => Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 40).map(edge => {
        const from = itemName.get(Number(edge.fromItemId)) ?? "Item " + edge.fromItemId;
        const to = itemName.get(Number(edge.toItemId)) ?? "Item " + edge.toItemId;
        return '<div class="analytics-table-row"><span>' + esc(from) + ' → ' + esc(to) + '<small class="matchup-meta">PHASE ' + esc(Number(edge.fromColumn ?? 0) + 1) + ' → NEXT</small></span><strong>' + esc(edge.matches ?? 0) + ' matches</strong></div>';
      }).join("") || '<p class="muted">No item transitions returned.</p>';

      const summary = flow.summary ?? {};
      $("#item-flow-summary").innerHTML = [
        ["BASELINE MATCHES", summary.matches], ["BASELINE PLAYERS", summary.players],
        ["REACHED COLUMNS", flow.reachedPerColumn?.length ?? 0], ["EDGES", flow.edges?.length ?? 0],
      ].map(([label,value]) => '<article class="metric-card"><span>' + label + '</span><strong>' + esc(value ?? "—") + '</strong><small>item flow</small></article>').join("");
      $("#item-analytics-status").textContent = "ONLINE";
    } catch (error) {
      if (isAborted(error)) return;
      $("#item-analytics-status").textContent = "ERROR";
      $("#item-stats-list").innerHTML = '<p class="error-text">' + esc(error.message) + '</p>';
    }
  };

  form.addEventListener("submit", event => { event.preventDefault(); load(normalize(Object.fromEntries(new FormData(form).entries()))); });
  load(normalize(Object.fromEntries(new FormData(form).entries())));
}

function renderAnalytics(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">ANALYTICS / MATCH INTELLIGENCE</span><h2>Analytics</h2><p>Aggregate match and hero-ban statistics from the documented analytics API.</p></section>' +
    '<section class="panel analytics-filter-panel"><div class="section-head"><div><span class="eyebrow">FILTERS</span><h2>Analytics scope</h2></div><button id="analytics-reset" class="secondary-button" type="button">Reset</button></div><form id="analytics-filters" class="analytics-filters"><label class="field"><span>Game mode</span><select name="game_mode"><option value="normal" selected>Normal</option><option value="street_brawl">Street Brawl</option></select></label><label class="field"><span>Match mode</span><select name="match_mode"><option value="ranked,unranked" selected>Ranked + Unranked</option><option value="ranked">Ranked</option><option value="unranked">Unranked</option><option value="private_lobby">Private Lobby</option><option value="hero_labs">Hero Labs</option></select></label><label class="field"><span>From</span><input name="min_unix_timestamp" type="date"></label><label class="field"><span>To</span><input name="max_unix_timestamp" type="date"></label><label class="field"><span>Min badge</span><input name="min_average_badge" type="number" min="0" max="116" placeholder="0"></label><label class="field"><span>Max badge</span><input name="max_average_badge" type="number" min="0" max="116" placeholder="116"></label><label class="field"><span>Min duration</span><input name="min_duration_s" type="number" min="0" max="7000" placeholder="seconds"></label><label class="field"><span>Max duration</span><input name="max_duration_s" type="number" min="0" max="7000" placeholder="seconds"></label><label class="field"><span>Min net worth</span><input name="min_networth" type="number" min="0" placeholder="gold"></label><label class="field"><span>Max net worth</span><input name="max_networth" type="number" min="0" placeholder="gold"></label><label class="field"><span>High skill parties</span><select name="is_high_skill_range_parties"><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label><label class="field"><span>Low priority pool</span><select name="is_low_pri_pool"><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label><label class="field"><span>New player pool</span><select name="is_new_player_pool"><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label><label class="field"><span>Hero IDs</span><input name="hero_ids" type="text" inputmode="numeric" placeholder="1, 2, 3"></label><label class="field"><span>Account IDs</span><input name="account_ids" type="text" inputmode="numeric" placeholder="123, 456"></label><label class="field"><span>Include items</span><input name="include_item_ids" type="text" inputmode="numeric" placeholder="item IDs"></label><label class="field"><span>Exclude items</span><input name="exclude_item_ids" type="text" inputmode="numeric" placeholder="item IDs"></label><label class="field"><span>Ability order prefix</span><input name="ability_order_prefix" type="text" inputmode="numeric" placeholder="ability IDs"></label><label class="field"><span>Unlock prefix</span><input name="ability_unlock_order_prefix" type="text" inputmode="numeric" placeholder="ability IDs"></label><label class="field"><span>Combo size</span><select name="comb_size"><option value="2">2 heroes</option><option value="3">3 heroes</option><option value="4">4 heroes</option><option value="5">5 heroes</option><option value="6" selected>6 heroes</option></select></label><button class="primary-button" type="submit">Apply filters</button></form></section>' +
    '<section class="analytics-grid" id="analytics-summary"><article class="metric-card"><span>MATCHES</span><strong>—</strong><small>loading</small></article><article class="metric-card"><span>PLAYERS</span><strong>—</strong><small>loading</small></article><article class="metric-card"><span>AVG DURATION</span><strong>—</strong><small>loading</small></article><article class="metric-card"><span>AVG KILLS</span><strong>—</strong><small>loading</small></article></section>' +
    '<section class="panel analytics-hero-panel"><div class="section-head"><div><span class="eyebrow">HERO STATS</span><h2>Performance by hero</h2></div><span class="muted">TOP 16 BY MATCHES</span></div><div class="hero-stats-table"><div class="hero-stat-head"><span>HERO</span><span>MATCHES</span><span>WIN RATE</span><span>K / D / A</span><span>TOTAL DAMAGE</span><span>TOTAL NET WORTH</span></div><div id="hero-stats-list"></div></div></section>' +
    '<section class="panel analytics-matchup-panel"><div class="section-head"><div><span class="eyebrow">HERO MATCHUPS</span><h2>Counter intelligence</h2></div><select id="matchup-hero-select" class="explorer-select" aria-label="Select hero for matchup analysis"></select></div><div id="hero-matchup-list" class="analytics-matchups"><p class="muted">Loading matchup data.</p></div></section><section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">GAME STATS</span><h2>Daily activity</h2></div><b id="analytics-status">LOADING</b></div><div id="game-stats-list" class="analytics-bars"></div></article>' +
    '<article class="panel"><div class="section-head"><div><span class="eyebrow">HERO BANS</span><h2>Ban activity</h2></div></div><div id="hero-ban-list" class="analytics-table"></div></article></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">RANK DISTRIBUTION</span><h2>Badge distribution</h2></div><span class="muted">FILTERED MATCHES</span></div><div id="badge-distribution-list" class="analytics-bars"></div></article><article class="panel quote"><span>i</span><p>Match counts use average badge; unique players reflect Valve\'s latest ranked badge within the filtered range.</p><small>DEADLOCK API / BADGE DISTRIBUTION</small></article></section>' +
    '<section class="dashboard-grid"><article class="panel analytics-builds"><div class="section-head"><div><span class="eyebrow">HERO BUILDS</span><h2>Build & ability intelligence</h2></div><select id="build-hero-select" class="explorer-select" aria-label="Select hero for build analysis"></select></div><div id="hero-build-list"><p class="muted">Loading build data.</p></div><div class="analytics-table"><div class="section-head"><div><span class="eyebrow">BUILD ITEMS</span><h3>Items used in builds</h3></div></div><div id="build-item-list"><p class="muted">Loading item data.</p></div></div></article>' +
    '<article class="panel"><div class="section-head"><div><span class="eyebrow">HERO COMBINATIONS</span><h2>Team combinations</h2></div></div><div id="hero-combo-list" class="analytics-table"><p class="muted">Loading combinations.</p></div><div class="section-head"><div><span class="eyebrow">BUFF STATS</span><h2>Power-up pickups</h2></div></div><div id="buff-stats-list" class="analytics-table"><p class="muted">Loading buffs.</p></div></article></section>';
  const form = $("#analytics-filters");
  const defaults = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  form.elements.min_unix_timestamp.value = defaults;
  form.elements.max_unix_timestamp.value = new Date().toISOString().slice(0, 10);
  form.addEventListener("submit", event => {
    event.preventDefault();
    loadAnalytics(signal, Object.fromEntries(new FormData(form).entries()));
  });
  $("#analytics-reset").addEventListener("click", () => {
    form.reset();
    form.elements.min_unix_timestamp.value = defaults;
    form.elements.max_unix_timestamp.value = new Date().toISOString().slice(0, 10);
    loadAnalytics(signal, {});
  });
  loadAnalytics(signal, {
    game_mode: "normal",
    match_mode: "ranked,unranked",
    min_unix_timestamp: Math.floor(Date.now() / 1000) - 30 * 86400,
    max_unix_timestamp: Math.floor(Date.now() / 1000),
    comb_size: 6,
  });
}

async function loadAnalytics(signal, filters = {}) {
  try {
    const [snapshotResult, heroStats, matchup, comboStats, buffStats, badgeDistribution] = await Promise.all([
      getAnalyticsSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), bucket: "start_time_day", signal }),
      getHeroStatsSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), signal }),
      getHeroMatchupSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), min_matches: 20, signal }),
      getHeroComboSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), min_matches: 20, comb_size: Number(filters.comb_size) || 6, signal }),
      getBuffSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), signal }),
      getBadgeDistributionSnapshot({ ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), signal }),
    ]);
    const result = snapshotResult;
    if (signal.aborted) return;

    const game = normalizeGameStats(result.gameStats);
    const bans = normalizeHeroBanStats(result.heroBanStats);
    const latest = game.at(-1);
    const summary = $("#analytics-summary");
    const values = [
      [latest?.totalMatches, "matches"],
      [latest?.totalPlayers, "players"],
      [formatDuration(latest?.avgDurationS), "per player"],
      [latest?.avgKills, "per player"],
    ];
    summary.innerHTML = values.map(([value, label], index) =>
      '<article class="metric-card"><span>' + ["MATCHES","PLAYERS","AVG DURATION","AVG KILLS"][index] + '</span><strong>' +
      esc(Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : value) +
      '</strong><small>' + esc(label) + '</small></article>'
    ).join("");

    const maxMatches = Math.max(1, ...game.map(item => Number(item.totalMatches) || 0));
    $("#game-stats-list").innerHTML = game.slice(-14).map(item =>
      '<div class="analytics-bar-row"><span>' + esc(item.bucket ?? "—") + '</span><div><i style="width:' +
      Math.min(100, ((Number(item.totalMatches) || 0) / maxMatches) * 100) + '%"></i></div><strong>' +
      esc(Number(item.totalMatches ?? 0).toLocaleString()) + '</strong></div>'
    ).join("") || '<p class="muted">No game statistics returned.</p>';

    const badgeRows = [...badgeDistribution].sort((a, b) => Number(a.badgeLevel ?? 0) - Number(b.badgeLevel ?? 0));
    const maxBadgeMatches = Math.max(1, ...badgeRows.map(item => Number(item.totalMatches) || 0));
    $("#badge-distribution-list").innerHTML = badgeRows.length
      ? badgeRows.map(item =>
          '<div class="analytics-bar-row"><span>Badge ' + esc(item.badgeLevel ?? "—") + '<small class="matchup-meta">' +
          esc(Number(item.uniquePlayers ?? 0).toLocaleString()) + ' players</small></span><div><i style="width:' +
          Math.min(100, ((Number(item.totalMatches) || 0) / maxBadgeMatches) * 100) + '%"></i></div><strong>' +
          esc(Number(item.totalMatches ?? 0).toLocaleString()) + '</strong></div>'
        ).join("")
      : '<p class="muted">No badge distribution returned.</p>';

    const sortedBans = [...bans].sort((a, b) => Number(b.bans ?? 0) - Number(a.bans ?? 0)).slice(0, 12);
    $("#hero-ban-list").innerHTML = sortedBans.length
      ? '<div class="analytics-table-head"><span>HERO ID</span><span>BANS</span></div>' +
        sortedBans.map(item => '<div class="analytics-table-row"><span>Hero ' + esc(item.heroId) + '</span><strong>' + esc(Number(item.bans ?? 0).toLocaleString()) + '</strong></div>').join("")
      : '<p class="muted">No hero ban statistics returned.</p>';

    const [heroCatalog, itemCatalog, miscCatalog] = await Promise.all([
      listHeroes({ ...assetVersion.options(), signal }),
      listItems({ ...assetVersion.options(), signal }),
      listMiscEntities({ ...assetVersion.options(), signal }),
    ]);
    if (signal.aborted) return;
    const heroesById = new Map(heroCatalog.data.map(hero => [String(idOf(hero)), hero]));
    const itemsById = new Map(itemCatalog.data.map(item => [String(item.id), item]));
    const buffsByType = new Map(
      miscCatalog.data
        .filter(entity => entity?.raw?.buff_type_name || entity?.raw?.buff_type_loc_string)
        .map(entity => [String(entity.raw.buff_type_loc_string ?? entity.raw.class_name), entity])
    );
    const heroRows = heroStats
      .filter(item => item?.heroId != null)
      .sort((a, b) => Number(b.matches ?? 0) - Number(a.matches ?? 0))
      .slice(0, 16);
    $("#hero-stats-list").innerHTML = heroRows.length
      ? heroRows.map(item => {
          const hero = heroesById.get(String(item.heroId));
          const name = hero ? nameOf(hero) : "Hero " + item.heroId;
          const image = hero ? resolveAssetImage(hero, ["icon_hero_card_webp", "icon_hero_card", "hero_card_critical_webp", "hero_card_critical"]) : null;
          const matches = Number(item.matches);
          const wins = Number(item.wins);
          const winRate = Number.isFinite(matches) && matches > 0 && Number.isFinite(wins) ? ((wins / matches) * 100).toFixed(1) + "%" : "—";
          const kda = [item.totalKills, item.totalDeaths, item.totalAssists].map(Number);
          const kdaText = kda.every(Number.isFinite) ? kda.join(" / ") : "—";
          return '<div class="hero-stat-row"><div class="hero-stat-identity">' +
            (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '<div class="asset-placeholder">?</div>') +
            '<span><strong>' + esc(name) + '</strong><small>ID ' + esc(item.heroId) + '</small></span></div>' +
            '<span>' + esc(Number.isFinite(matches) ? matches.toLocaleString() : "—") + '</span><span>' + esc(winRate) + '</span><span>' + esc(kdaText) + '</span><span>' + esc(Number.isFinite(Number(item.totalPlayerDamage)) ? Number(item.totalPlayerDamage).toLocaleString() : "—") + '</span><span>' + esc(Number.isFinite(Number(item.totalNetWorth)) ? Number(item.totalNetWorth).toLocaleString() : "—") + '</span></div>';
        }).join("")
      : '<p class="muted">No hero statistics returned.</p>';

    const heroOptions = heroRows
      .map(item => {
        const hero = heroesById.get(String(item.heroId));
        return '<option value="' + esc(item.heroId) + '">' + esc(hero ? nameOf(hero) : "Hero " + item.heroId) + '</option>';
      }).join("");
    const matchupSelect = $("#matchup-hero-select");
    matchupSelect.innerHTML = heroOptions;
    const renderMatchups = heroId => {
      const selectedId = String(heroId);
      const counters = matchup.counters
        .filter(item => String(item.heroId) === selectedId)
        .sort((a, b) => Number(a.wins ?? 0) / Math.max(1, Number(a.matchesPlayed ?? 0)) - Number(b.wins ?? 0) / Math.max(1, Number(b.matchesPlayed ?? 0)))
        .slice(0, 10);
      const synergies = matchup.synergies
        .filter(item => String(item.heroId1) === selectedId || String(item.heroId2) === selectedId)
        .sort((a, b) => (Number(b.wins ?? 0) / Math.max(1, Number(b.matchesPlayed ?? 0))) - (Number(a.wins ?? 0) / Math.max(1, Number(a.matchesPlayed ?? 0)))
        .slice(0, 6);
      const heroName = id => {
        const hero = heroesById.get(String(id));
        return hero ? nameOf(hero) : "Hero " + id;
      };
      $("#hero-matchup-list").innerHTML =
        '<div class="matchup-columns"><div><div class="analytics-table-head"><span>COUNTER</span><span>WIN RATE</span></div>' +
        (counters.length ? counters.map(item => '<div class="analytics-table-row"><span>' + esc(heroName(item.enemyHeroId)) + '<small class="matchup-meta">' + esc(item.matchesPlayed ?? "—") + ' matches</small></span><strong>' + esc(Number.isFinite(Number(item.wins)) && Number(item.matchesPlayed) > 0 ? ((Number(item.wins) / Number(item.matchesPlayed)) * 100).toFixed(1) + "%" : "—") + '</strong></div>').join("") : '<p class="muted">No counter data returned.</p>') +
        '</div><div><div class="analytics-table-head"><span>SYNERGY</span><span>WIN RATE</span></div>' +
        (synergies.length ? synergies.map(item => { const other = String(item.heroId1) === selectedId ? item.heroId2 : item.heroId1; return '<div class="analytics-table-row"><span>' + esc(heroName(other)) + '<small class="matchup-meta">' + esc(item.matchesPlayed ?? "—") + ' matches</small></span><strong>' + esc(Number.isFinite(Number(item.wins)) && Number(item.matchesPlayed) > 0 ? ((Number(item.wins) / Number(item.matchesPlayed)) * 100).toFixed(1) + "%" : "—") + '</strong></div>'; }).join("") : '<p class="muted">No synergy data returned.</p>') +
        '</div></div>';
    };
    matchupSelect.addEventListener("change", event => renderMatchups(event.target.value));
    if (heroRows.length) renderMatchups(heroRows[0].heroId);
    const comboRows = [...comboStats].sort((a,b) => Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 8);
    const heroNameById = id => {
      const hero = heroesById.get(String(id));
      return hero ? nameOf(hero) : "Hero " + id;
    };
    $("#hero-combo-list").innerHTML = comboRows.length
      ? '<div class="analytics-table-head"><span>HERO COMBINATION</span><span>WIN RATE</span></div>' +
        comboRows.map(item => '<div class="analytics-table-row"><span>' + esc(item.heroIds.map(heroNameById).join(" · ")) + '<small class="matchup-meta">' + esc(item.matches ?? "—") + ' matches</small></span><strong>' + esc(Number(item.matches) > 0 && Number.isFinite(Number(item.wins)) ? ((Number(item.wins)/Number(item.matches))*100).toFixed(1)+"%" : "—") + '</strong></div>').join("")
      : '<p class="muted">No combination statistics returned.</p>';
    const buffRows = [...buffStats].sort((a,b) => Number(b.pickups ?? 0) - Number(a.pickups ?? 0)).slice(0, 10);
    $("#buff-stats-list").innerHTML = buffRows.length
      ? '<div class="analytics-table-head"><span>BUFF</span><span>PICKUPS</span></div>' +
        buffRows.map(item => {
          const metadata = buffsByType.get(String(item.buffType));
          const raw = metadata?.raw ?? {};
          const label = raw.buff_type_name ?? metadata?.name ?? item.buffType ?? "—";
          const unit = raw.buff_type_value_unit ? " · " + raw.buff_type_value_unit : "";
          return '<div class="analytics-table-row"><span>' + esc(label) + '<small class="matchup-meta">' + esc(item.buffType ?? "—") + ' · ' + esc(item.matchesWithPickup ?? "—") + ' matches with pickup' + esc(unit) + '</small></span><strong>' + esc(Number(item.pickups ?? 0).toLocaleString()) + '</strong></div>';
        }).join("")
      : '<p class="muted">No buff statistics returned.</p>';
    const buildSelect = $("#build-hero-select");
    buildSelect.innerHTML = heroOptions;
    let buildRequestId = 0;
    const loadHeroBuilds = async heroId => {
      const requestId = ++buildRequestId;
      const panel = $("#hero-build-list");
      panel.innerHTML = '<p class="muted">Loading builds and ability orders…</p>';
      try {
        const [builds, abilities] = await Promise.all([
          getHeroBuildStatsSnapshot(heroId, { ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), min_matches: 20, signal }),
          getAbilityOrderStatsSnapshot(heroId, { ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), min_matches: 20, signal }),
        ]);
        if (signal.aborted || requestId !== buildRequestId) return;
        const buildRows = [...builds].sort((a,b) => Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 8);
        const abilityRows = [...abilities].sort((a,b) => Number(b.matches ?? 0) - Number(a.matches ?? 0)).slice(0, 6);
        const rate = (wins, matches) => Number.isFinite(Number(wins)) && Number(matches) > 0 ? ((Number(wins) / Number(matches))*100).toFixed(1) + "%" : "—";
        const itemRows = await getBuildItemSnapshot(heroId, { ...assetVersion.options(), ...normalizeAnalyticsFilters(filters), signal });
        if (signal.aborted || requestId !== buildRequestId) return;
        const items = [...itemRows].sort((a,b) => Number(b.builds ?? 0) - Number(a.builds ?? 0)).slice(0, 8);
        $("#build-item-list").innerHTML = items.length
          ? '<div class="analytics-table-head"><span>ITEM</span><span>BUILDS</span></div>' +
            items.map(item => {
              const asset = itemsById.get(String(item.itemId));
              const image = asset ? resolveAssetImage(asset, ["image_webp", "image", "icon_webp", "icon"]) : "";
              const label = asset?.name ?? asset?.className ?? ("Item " + (item.itemId ?? "—"));
              return '<div class="analytics-table-row"><span class="hero-stat-identity">' +
                (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '') +
                '<span><strong>' + esc(label) + '</strong><small class="matchup-meta">ID ' + esc(item.itemId ?? "—") + '</small></span></span><strong>' + esc(Number(item.builds ?? 0).toLocaleString()) + '</strong></div>';
            }).join("")
          : '<p class="muted">No build-item statistics returned.</p>';
        panel.innerHTML =
          '<div class="matchup-columns"><div><div class="analytics-table-head"><span>BUILD ID</span><span>WIN RATE</span></div>' +
          (buildRows.length ? buildRows.map(item => '<div class="analytics-table-row"><span>Build ' + esc(item.heroBuildId ?? "—") + '<small class="matchup-meta">' + esc(item.matches ?? "—") + ' matches · ' + esc(item.players ?? "—") + ' players</small></span><strong>' + esc(rate(item.wins,item.matches)) + '</strong></div>').join("") : '<p class="muted">No build statistics returned.</p>') +
          '</div><div><div class="analytics-table-head"><span>ABILITY ORDER</span><span>WIN RATE</span></div>' +
          (abilityRows.length ? abilityRows.map(item => '<div class="analytics-table-row"><span>' + esc(item.abilities.join(" → ") || "—") + '<small class="matchup-meta">' + esc(item.matches ?? "—") + ' matches · K/D/A ' + esc([item.totalKills,item.totalDeaths,item.totalAssists].join(" / ")) + '</small></span><strong>' + esc(rate(item.wins,item.matches)) + '</strong></div>').join("") : '<p class="muted">No ability-order statistics returned.</p>') +
          '</div></div>';
      } catch (error) {
        if (isAborted(error)) return;
        panel.innerHTML = '<p class="muted">Build analytics unavailable.</p>';
        console.error("Deadlock hero build analytics failed", error);
      }
    };
    buildSelect.addEventListener("change", event => loadHeroBuilds(event.target.value));
    if (heroRows.length) loadHeroBuilds(heroRows[0].heroId);
    $("#analytics-status").textContent = "LIVE";
    $("#analytics-status").classList.add("online");
    setConnection(true, "API connected");
  } catch (error) {
    if (isAborted(error)) return;
    $("#analytics-status").textContent = "ERROR";
    setConnection(false, "API unavailable");
    console.error("Deadlock analytics request failed", error);
  }
}

function renderApiStatus(signal) {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">SYSTEM / API</span><h2>API Status</h2><p>Live health probe for the documented Deadlock API infrastructure.</p></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">HEALTH</span><h2 id="status-title">Checking…</h2></div><b id="status-badge">CHECKING</b></div><div id="status-metrics"></div></article><article class="panel"><span class="eyebrow">SERVICES</span><h2>Infrastructure</h2><div id="service-list"></div></article></section>';
  loadApiStatus(signal);
}

async function loadApiStatus(signal) {
  try {
    const result = await probeApiStatus({ signal });
    if (signal.aborted) return;
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
  } catch (error) {
    if (isAborted(error)) return;
    setConnection(false, "API unavailable");
    const badge = $("#status-badge");
    if (badge) badge.textContent = "OFFLINE";
    const title = $("#status-title");
    if (title) title.textContent = "API status check failed";
  }
}

function renderBuilds(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">GAME / BUILDS</span><h2>Builds</h2><p>Search the live build catalog using filters documented by the current Deadlock API.</p></section>' +
    '<section class="panel analytics-filter-panel"><form id="build-filters" class="analytics-filters">' +
    '<label class="field"><span>Name</span><input name="search_name" type="search" placeholder="Build name"></label>' +
    '<label class="field"><span>Hero ID</span><input name="hero_id" type="number" min="0" inputmode="numeric"></label>' +
    '<label class="field"><span>Author SteamID3</span><input name="author_id" type="number" min="0" inputmode="numeric"></label>' +
    '<label class="field"><span>Language</span><select name="build_language"><option value="">All</option><option>English</option><option>German</option><option>French</option><option>Italian</option><option>Korean</option><option>SpanishSpain</option><option>ChineseSimplified</option><option>Russian</option><option>Thai</option><option>Japanese</option><option>PortuguesePortugal</option><option>Polish</option><option>Czech</option><option>Turkish</option><option>PortugueseBrazil</option><option>Ukrainian</option><option>SpanishLatinAmerica</option><option>Vietnamese</option></select></label>' +
    '<label class="field"><span>Sort by</span><select name="sort_by"><option value="weekly_favorites">Weekly favorites</option><option value="favorites" selected>Favorites</option><option value="updated_at">Updated</option><option value="published_at">Published</option><option value="version">Version</option><option value="ignores">Ignores</option><option value="reports">Reports</option></select></label>' +
    '<label class="field"><span>Direction</span><select name="sort_direction"><option value="desc" selected>Descending</option><option value="asc">Ascending</option></select></label>' +
    '<label class="field"><span>Latest only</span><select name="only_latest"><option value="true" selected>Yes</option><option value="false">No</option></select></label>' +
    '<label class="field"><span>Limit</span><input name="limit" type="number" min="0" max="100" value="50"></label>' +
    '<button class="primary-button" type="submit">Search builds</button></form></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">CATALOG</span><h2>Published builds</h2></div><b id="build-status">LOADING</b></div><div id="build-list" class="analytics-table"><p class="muted">Loading builds.</p></div></section>';

  const form = $("#build-filters");
  const list = $("#build-list");
  const load = async values => {
    $("#build-status").textContent = "LOADING";
    list.innerHTML = '<p class="muted">Loading builds…</p>';
    try {
      const filters = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
      if (filters.hero_id !== undefined) filters.hero_id = Number(filters.hero_id);
      if (filters.author_id !== undefined) filters.author_id = Number(filters.author_id);
      if (filters.limit !== undefined) filters.limit = Number(filters.limit);
      if (filters.only_latest !== undefined) filters.only_latest = filters.only_latest === "true";
      const result = await listBuilds({ ...assetVersion.options(), ...filters, signal });
      if (signal.aborted) return;
      const builds = result.data ?? [];
      $("#build-status").textContent = builds.length + " FOUND";
      list.innerHTML = builds.map(build => {
        const hero = build.hero_build ?? {};
        const details = hero.details ?? {};
        const categories = Array.isArray(details.mod_categories) ? details.mod_categories.length : 0;
        const tags = Array.isArray(hero.tags) ? hero.tags.length : 0;
        return '<article class="analytics-table-row">' +
          '<span><strong>' + esc(hero.name ?? "Unnamed build") + '</strong><small>Build #' + esc(hero.hero_build_id ?? build.build_id ?? "—") + ' · Hero ' + esc(hero.hero_id ?? "—") + '</small></span>' +
          '<span><strong>v' + esc(hero.version ?? "—") + '</strong><small>Author ' + esc(hero.author_account_id ?? "—") + ' · ' + esc(categories) + ' categories · ' + esc(tags) + ' tags</small></span>' +
          '<span><small>Favorites ' + esc(build.num_favorites ?? 0) + '</small><small>Weekly ' + esc(build.num_weekly_favorites ?? 0) + '</small></span>' +
          '</article>';
      }).join("") || '<p class="muted">No builds matched the current filters.</p>';
    } catch (error) {
      if (isAborted(error)) return;
      $("#build-status").textContent = "ERROR";
      list.innerHTML = '<p class="error-text">' + esc(error.message) + '</p>';
    }
  };
  form.addEventListener("submit", event => {
    event.preventDefault();
    load(Object.fromEntries(new FormData(form).entries()));
  });
  load(Object.fromEntries(new FormData(form).entries()));
}

function renderMatches(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">MATCH INTELLIGENCE</span><h2>Matches</h2><p>Live and recently fetched match intelligence from the current Deadlock API.</p></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">ACTIVE</span><h2>Live matches</h2></div><b id="active-match-status">LOADING</b></div><div id="active-match-list" class="analytics-table"><p class="muted">Loading active matches.</p></div></article>' +
    '<article class="panel"><div class="section-head"><div><span class="eyebrow">RECENTLY FETCHED</span><h2>Recent matches</h2></div><b id="recent-match-status">LOADING</b></div><div id="recent-match-list" class="analytics-table"><p class="muted">Loading recent matches.</p></div></article></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">MATCH LOOKUP</span><h2>Inspect metadata</h2></div></div><form id="match-lookup" class="inline-form"><label class="sr-only" for="match-id-input">Match ID</label><input id="match-id-input" name="match_id" type="number" min="0" placeholder="Match ID" required><button class="primary-button" type="submit">Load metadata</button></form><div id="match-detail" class="match-detail result-box"><span class="eyebrow">RESPONSE</span><p class="muted">Enter a match ID to inspect its API metadata.</p></div></section>';

  const renderList = (target, matches) => {
    $(target).innerHTML = matches.slice(0, 50).map(match =>
      '<button class="analytics-table-row match-row" data-match-id="' + esc(match.matchId) + '"><span><strong>#' + esc(match.matchId) + '</strong><small class="matchup-meta">' + esc(match.startTime ? new Date(Number(match.startTime) * 1000).toLocaleString() : "Unknown start") + ' · ' + esc(match.durationS ?? "—") + 's</small></span><strong>' + esc(match.players.length) + ' players</strong></button>'
    ).join("") || '<p class="muted">No matches returned.</p>';
    document.querySelectorAll(target + " .match-row").forEach(button => button.addEventListener("click", () => {
      $("#match-lookup [name=match_id]").value = button.dataset.matchId;
      loadDetail(button.dataset.matchId);
    }));
  };

  const renderDetail = (data, catalogs = {}) => {
    const heroes = catalogs.heroes ?? new Map();
    const items = catalogs.items ?? new Map();
    const object = data && typeof data === "object" ? data : {};
    const entries = Object.entries(object).filter(([, value]) => value == null || ["string","number","boolean"].includes(typeof value));
    const players = Array.isArray(object.players) ? object.players : [];
    const summary = entries.slice(0, 18).map(([key, value]) =>
      '<div class="metric"><span>' + esc(key) + '</span><strong>' + esc(value ?? "—") + '</strong></div>'
    ).join("");
    const playerRows = players.map((player, index) => {
      const kda = ["kills","deaths","assists"].every(key => player?.[key] != null)
        ? esc(player.kills) + '/' + esc(player.deaths) + '/' + esc(player.assists)
        : "—";
      const playerItems = Array.isArray(player?.items) ? player.items : [];
      const itemLabels = playerItems.slice(0, 8).map(item => {
        const id = Number(item?.item_id ?? item?.id ?? item);
        return items.get(id)?.name ?? ("Item " + (Number.isFinite(id) ? id : "—"));
      });
      const heroId = Number(player?.hero_id);
      const hero = heroes.get(heroId);
      const finalStats = player?.final_stats && typeof player.final_stats === "object"
        ? Object.entries(player.final_stats).filter(([, value]) => ["string","number","boolean"].includes(typeof value)).slice(0, 8)
        : [];
      const finalStatsText = finalStats.map(([key, value]) => key + ": " + value).join(" · ");
      const heroImage = hero ? resolveAssetImage(hero, ["icon_image_small_webp", "icon_image_small", "hero_card_critical_webp", "hero_card_critical"]) : "";
      return '<div class="match-player-card">' +
        (heroImage ? '<img class="match-player-hero" src="' + esc(heroImage) + '" alt="" loading="lazy" decoding="async">' : "") +
        '<span class="eyebrow">PLAYER ' + (index + 1) + '</span><strong>Account ' + esc(player?.account_id ?? "—") + '</strong><small>Hero ' + esc(hero?.name ?? player?.hero_id ?? "—") + ' · Team ' + esc(player?.team ?? "—") + '</small><small>K/D/A ' + kda + ' · ' + esc(playerItems.length) + ' items</small>' +
        (player?.hero_build_id != null ? '<small>Build ' + esc(player.hero_build_id) + '</small>' : "") +
        (player?.pregame_hero_id != null ? '<small>Pregame hero ' + esc(player.pregame_hero_id) + '</small>' : "") +
        (itemLabels.length ? '<small>Items: ' + esc(itemLabels.join(", ")) + '</small>' : "") +
        (finalStatsText ? '<small>Final: ' + esc(finalStatsText) + '</small>' : "") +
        (Array.isArray(player?.death_details) ? '<small>Deaths: ' + esc(player.death_details.length) + '</small>' : "") +
        '</div>';
    }).join("");
    const arraySummary = Object.entries(object).filter(([, value]) => Array.isArray(value)).map(([key, value]) =>
      '<div class="metric"><span>' + esc(key) + '</span><strong>' + value.length + ' entries</strong></div>'
    ).join("");
    $("#match-detail").innerHTML =
      '<div class="match-detail-summary">' + summary + arraySummary + '</div>' +
      (players.length ? '<div class="match-player-grid">' + playerRows + '</div>' : '<p class="muted">No player array was returned by this metadata response.</p>') +
      '<details class="match-raw"><summary>Raw API response</summary><pre>' + esc(JSON.stringify(data, null, 2)) + '</pre></details>';
  };

  const loadDetail = async matchId => {
    const numericMatchId = Number(matchId);
    if (!Number.isInteger(numericMatchId) || numericMatchId < 0) {
      $("#match-detail").innerHTML = '<span class="eyebrow">INVALID ID</span><p class="muted">Match ID must be a non-negative integer.</p>';
      return;
    }
    $("#match-detail").innerHTML = '<span class="eyebrow">RESPONSE</span><p class="muted">Loading metadata…</p>';
    try {
      const [data, heroCatalog, itemCatalog] = await Promise.all([
        getBulkMatchMetadataSnapshot({
        match_ids: [numericMatchId],
        include_info: true,
        include_more_info: true,
        include_objectives: true,
        include_mid_boss: true,
        include_player_info: true,
        include_player_kda: true,
        include_player_items: true,
        include_player_final_stats: true,
        include_player_death_details: true,
        limit: 1,
        signal,
      }),
        listHeroes({ ...assetVersion.options(), signal }),
        listItems({ ...assetVersion.options(), signal }),
      ]);
      if (signal.aborted) return;
      const detail = Array.isArray(data) ? data[0] : data;
      const heroes = new Map((heroCatalog.data ?? []).map(hero => [Number(hero.id), hero]));
      const items = new Map((itemCatalog.data ?? []).map(item => [Number(item.id), item]));
      if (!detail) {
        $("#match-detail").innerHTML = '<span class="eyebrow">NOT FOUND</span><p class="muted">No metadata matched this match ID.</p>';
        return;
      }
      renderDetail(detail, { heroes, items });
    } catch (error) {
      if (isAborted(error)) return;
      $("#match-detail").innerHTML = '<span class="eyebrow">ERROR</span><pre>' + esc(JSON.stringify({ error: error.message, status: error.status ?? null }, null, 2)) + '</pre>';
    }
  };

  try {
    const [active, recent] = await Promise.all([
      getActiveMatchesSnapshot({ signal }),
      getRecentlyFetchedMatchesSnapshot({ signal }),
    ]);
    if (signal.aborted) return;
    renderList("#active-match-list", active);
    renderList("#recent-match-list", recent);
    $("#active-match-status").textContent = active.length + " LIVE";
    $("#recent-match-status").textContent = recent.length + " FOUND";
  } catch (error) {
    if (isAborted(error)) return;
    $("#active-match-status").textContent = "ERROR";
    $("#recent-match-status").textContent = "ERROR";
  }

  $("#match-lookup").addEventListener("submit", event => {
    event.preventDefault();
    loadDetail(new FormData(event.currentTarget).get("match_id"));
  });
}

function renderDataExplorer(signal) {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">TOOLS / OPENAPI</span><h2>Data Explorer</h2><p>Inspect and execute documented API operations from the live OpenAPI contract.</p></section>' +
    '<section class="explorer"><aside class="explorer-list"><input id="operation-filter" class="explorer-search" type="search" aria-label="Filter API operations" placeholder="Filter operations…"><div id="operation-list"></div></aside><article class="panel explorer-main"><div id="explorer-empty"><span class="eyebrow">CONTRACT</span><h3>Select an operation</h3><p>The explorer is populated from the live OpenAPI contract.</p></div><div id="operation-detail" hidden></div></article></section>';
  loadExplorer(signal);
}

async function loadExplorer(signal) {
  try {
    const contractResult = await getOpenApiContract({ cacheTtlMs: 5 * 60_000, signal });
    if (signal.aborted) return;
    const operations = listApiOperations(contractResult.data);
    const list = $("#operation-list");
    const filter = $("#operation-filter");
    const renderList = () => {
      const query = filter.value.trim().toLowerCase();
      const filtered = operations.filter(operation => !query || [operation.operationId, operation.path, operation.summary, ...operation.tags].join(" ").toLowerCase().includes(query));
      list.innerHTML = filtered.map(operation => '<button class="operation-row" data-operation-id="' + esc(operation.operationId) + '"><span class="method ' + operation.method.toLowerCase() + '">' + operation.method + '</span><span><b>' + esc(operation.operationId) + '</b><small>' + esc(operation.path) + '</small></span>' + (operation.deprecated ? "<em>deprecated</em>" : "") + "</button>").join("") || '<p class="muted">No operations match.</p>';
      list.querySelectorAll(".operation-row").forEach(button => button.addEventListener("click", () => renderOperation(operations.find(operation => operation.operationId === button.dataset.operationId), signal)));
    };
    filter.addEventListener("input", renderList);
    renderList();
    setConnection(true, "API connected");
  } catch (error) {
    if (isAborted(error)) return;
    const list = $("#operation-list");
    if (!list) return;
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

function renderOperation(operation, signal) {
  const detail = describeOperation(operation);
  $("#explorer-empty").hidden = true;
  const target = $("#operation-detail");
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
      const result = await executeOperation(operation, values, { signal });
      resultBox.querySelector("pre").textContent = JSON.stringify({
        status: result.status,
        latencyMs: result.latencyMs,
        url: result.url,
        contentType: result.contentType,
        request: result.request,
        data: result.data,
      }, null, 2);
    } catch (error) {
      if (isAborted(error)) return;
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

function renderNotFound(routeName) {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">NAVIGATION / 404</span><h2>Route not found</h2><p>The route <code>' +
    esc('#/' + routeName) +
    '</code> is not implemented in this build.</p><p><a class="primary-button" href="#/">Return to dashboard</a></p></section>';
}

function route() {
  const signal = beginRoute();
  const routeName = location.hash.replace(/^#\/?/, "").split("/")[0] || "dashboard";
  if (routeName === "api") renderApiStatus(signal);
  else if (routeName === "analytics") renderAnalytics(signal);
  else if (routeName === "matches") renderMatches(signal);
  else if (routeName === "builds") renderBuilds(signal);
  else if (routeName === "item-analytics") renderItemAnalytics(signal);
  else if (routeName === "data") renderDataExplorer(signal);
  else if (routeName === "heroes" || routeName === "items" || routeName === "ranks") renderAssetCatalog(routeName, signal);
  else renderNotFound(routeName);
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.getAttribute("href") === "#/" + (routeName === "dashboard" ? "" : routeName)));
  bindVersionControl();
}

function refreshVersionControlOptions() {
  const select = $("#client-version");
  if (!select) return;

  const selected = assetVersion.get();
  select.innerHTML =
    '<option value="">LATEST</option>' +
    assetVersion.list().slice().reverse().map(version =>
      '<option value="' + esc(version) + '"' +
      (selected === version ? ' selected' : '') +
      '>BUILD ' + esc(version) + '</option>'
    ).join("");
  select.value = selected == null ? "" : String(selected);
}

window.addEventListener("hashchange", route);
route();

const initialSelectedVersion = assetVersion.get();
loadAssetVersionContext().then(() => {
  refreshVersionControlOptions();
  if (assetVersion.get() !== initialSelectedVersion) route();
}).catch(() => {});
