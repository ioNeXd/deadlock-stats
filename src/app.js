import { getActiveMatchesSnapshot, getRecentlyFetchedMatchesSnapshot, getBulkMatchMetadataSnapshot } from "./services/matches.js";
import { listHeroes, listItems, listRanks, listMiscEntities } from "./services/assets.js";
import { getOpenApiContract } from "./services/versioning.js";
import { probeApiStatus } from "./services/api-status.js";
import { buildRequestExamples, buildSchemaFormModel, buildSchemaViewModel, describeOperation, executeOperation, listApiOperations, parseSchemaFormValue } from "./services/data-explorer.js";
import { renderSchemaViewer } from "./ui/schema-viewer.js";
import { API_BASE_URL } from "./api/client.js";
import { loadGraphqlPlayground } from "./services/graphql.js";
import { resolveAssetImage } from "./adapters/assets.js";
import { colorToCss, createAssetVersionContext } from "./services/asset-version.js";
import { getDashboardSnapshot } from "./services/dashboard.js";
import { listBuilds } from "./services/builds.js";
import { fetchMap } from "./services/assets.js";
import { loadLeaderboard } from "./services/leaderboard.js";
import { searchPlayers, loadPlayerRank, loadPlayerHeroStats, loadPlayerMatchHistory } from "./services/players.js";
import { safeExternalUrl } from "./ui/security.js";
import { listUserRequestPresets, saveUserRequestPreset, deleteUserRequestPreset } from "./services/data-explorer-presets.js";
import { getAnalyticsSnapshot, getHeroStatsSnapshot, getHeroMatchupSnapshot, getHeroDetailSnapshot, getHeroBuildStatsSnapshot, getAbilityOrderStatsSnapshot, getHeroComboSnapshot, getBuildItemSnapshot, getBuffSnapshot, getBadgeDistributionSnapshot, getItemStatsSnapshot, getItemPermutationSnapshot, getItemFlowSnapshot, normalizeGameStats, normalizeHeroBanStats, buildHeroDetailViewModel } from "./services/analytics.js";

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

function renderGraphql(signal) {
  const playgroundUrl = API_BASE_URL + "/v1/graphql";
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">TOOLS / GRAPHQL</span><h2>GraphQL Explorer</h2><p>The current API exposes an official GraphiQL playground at <code>/v1/graphql</code>. This view verifies the endpoint and opens the API-hosted playground without embedding or rewriting its content.</p></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">OFFICIAL ENDPOINT</span><h2>GraphiQL</h2></div><b id="graphql-status">CHECKING</b></div><div class="metric"><span>Endpoint</span><strong>' + esc(playgroundUrl) + '</strong></div><p class="panel-actions"><a class="button" href="' + esc(playgroundUrl) + '" target="_blank" rel="noopener noreferrer">Open official playground ↗</a></p><iframe class="graphql-frame" title="Deadlock API GraphQL Playground" src="' + esc(playgroundUrl) + '"></iframe></article></section>';
  loadGraphqlPlayground({ signal }).then(() => {
    if (signal.aborted) return;
    const status = $("#graphql-status");
    if (status) { status.textContent = "ONLINE"; status.classList.add("online"); }
  }).catch(error => {
    if (isAborted(error)) return;
    const status = $("#graphql-status");
    if (status) { status.textContent = "UNAVAILABLE"; status.classList.add("offline"); }
    console.error("GraphQL playground probe failed", error);
  });
}

function renderHeroDetail(heroId, signal) {
  const numericHeroId = Number(heroId);
  if (!Number.isInteger(numericHeroId) || numericHeroId < 0) {
    renderNotFound("heroes/" + heroId);
    return;
  }

  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">HERO / DETAIL</span><h2 id="hero-detail-name">Hero #' + esc(numericHeroId) + '</h2><p>Performance, matchups, builds and ability orders from the Deadlock analytics API.</p></section>' +
    '<section class="panel"><div id="hero-detail-status" class="section-head"><span class="eyebrow">LOADING</span><span>Fetching hero intelligence…</span></div><div id="hero-detail-summary"></div></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">MATCHUPS</span><h2>Counters & synergies</h2></div></div><div id="hero-detail-matchups"></div></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">BUILDS</span><h2>Hero builds</h2></div></div><div id="hero-detail-builds"></div></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">ABILITIES</span><h2>Ability orders</h2></div></div><div id="hero-detail-abilities"></div></section>';

  const options = { ...assetVersion.options(), signal };
  Promise.all([
    getHeroDetailSnapshot(numericHeroId, options),
    listHeroes({ ...assetVersion.options(), signal }),
  ]).then(([snapshot, heroResult]) => {
    if (signal.aborted) return;
    const hero = (heroResult.data ?? []).find(item => String(idOf(item)) === String(numericHeroId)) ?? null;
    if (hero) $("#hero-detail-name").textContent = nameOf(hero);

    const model = buildHeroDetailViewModel(snapshot, hero);
    const summary = [
      ["MATCHES", model.overview.matches == null ? "—" : model.overview.matches.toLocaleString()],
      ["WIN RATE", model.overview.winRate == null ? "—" : model.overview.winRate.toFixed(1) + "%"],
      ["K / D / A", [model.overview.kills, model.overview.deaths, model.overview.assists].map(Number).every(Number.isFinite) ? [model.overview.kills, model.overview.deaths, model.overview.assists].join(" / ") : "—"],
      ["PLAYER DAMAGE", Number.isFinite(Number(model.overview.playerDamage)) ? Number(model.overview.playerDamage).toLocaleString() : "—"],
      ["LAST HITS", Number.isFinite(Number(model.overview.lastHits)) ? Number(model.overview.lastHits).toLocaleString() : "—"],
      ["DENIES", Number.isFinite(Number(model.overview.denies)) ? Number(model.overview.denies).toLocaleString() : "—"],
    ];
    $("#hero-detail-summary").innerHTML = summary.map(([label,value]) => '<span><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></span>').join("");

    const counterRows = model.counters
      .filter(row => Number(row.matchesPlayed) > 0)
      .sort((a,b) => Number(b.matchesPlayed) - Number(a.matchesPlayed))
      .slice(0, 20);
    const synergyRows = model.synergies
      .filter(row => Number(row.matchesPlayed) > 0)
      .sort((a,b) => Number(b.matchesPlayed) - Number(a.matchesPlayed))
      .slice(0, 20);
    const heroName = id => {
      const match = (heroResult.data ?? []).find(item => String(idOf(item)) === String(id));
      return match ? nameOf(match) : "Hero #" + id;
    };
    const percent = (wins, matches) => {
      const w = Number(wins);
      const m = Number(matches);
      return Number.isFinite(w) && Number.isFinite(m) && m > 0 ? (w / m * 100).toFixed(1) + "%" : "—";
    };
    $("#hero-detail-matchups").innerHTML =
      '<div class="data-table-wrap"><table><caption>' + counterRows.length + ' counters returned</caption><thead><tr><th>Hero</th><th>Matches</th><th>Win rate</th><th>K / D / A</th><th>Net worth</th></tr></thead><tbody>' +
      counterRows.map(row => '<tr><td><a href="#/heroes/' + esc(row.enemyHeroId) + '">' + esc(heroName(row.enemyHeroId)) + '</a></td><td>' + esc(row.matchesPlayed ?? "—") + '</td><td>' + esc(percent(row.wins, row.matchesPlayed)) + '</td><td>' + esc([row.kills, row.deaths, row.assists].map(value => value ?? "—").join(" / ")) + '</td><td>' + esc(row.networth ?? "—") + '</td></tr>').join("") +
      '</tbody></table></div>' +
      '<div class="data-table-wrap"><table><caption>' + synergyRows.length + ' synergies returned</caption><thead><tr><th>Partner</th><th>Matches</th><th>Win rate</th><th>K / D / A</th></tr></thead><tbody>' +
      synergyRows.map(row => { const partner = String(row.heroId1) === String(numericHeroId) ? row.heroId2 : row.heroId1; const kills = String(row.heroId1) === String(numericHeroId) ? row.kills1 : row.kills2; const deaths = String(row.heroId1) === String(numericHeroId) ? row.deaths1 : row.deaths2; const assists = String(row.heroId1) === String(numericHeroId) ? row.assists1 : row.assists2; return '<tr><td><a href="#/heroes/' + esc(partner) + '">' + esc(heroName(partner)) + '</a></td><td>' + esc(row.matchesPlayed ?? "—") + '</td><td>' + esc(percent(row.wins, row.matchesPlayed)) + '</td><td>' + esc([kills, deaths, assists].map(value => value ?? "—").join(" / ")) + '</td></tr>'; }).join("") +
      '</tbody></table></div>';

    const builds = model.builds.slice(0, 20);
    const buildDetailsById = new Map(model.buildDetails.map(detail => [String(detail.heroBuildId), detail]));
    const buildRows = builds.map(row => {
      const detail = buildDetailsById.get(String(row.heroBuildId));
      return '<tr><td>' + esc(row.heroBuildId ?? "—") + '</td><td>' + esc(detail?.name ?? "Unnamed build") + '</td><td>' + esc(row.matches ?? "—") + '</td><td>' + esc(percent(row.wins, row.matches)) + '</td><td>' + esc(row.players ?? "—") + '</td></tr>';
    }).join("");
    const detailBlocks = model.buildDetails.map(detail => {
      const categories = detail.categories.flatMap(category =>
        category.mods.map(mod => ({
          category: category.name ?? "Unnamed category",
          abilityId: mod.abilityId,
          annotation: mod.annotation,
        }))
      );
      return '<section class="panel"><div class="section-head"><div><span class="eyebrow">BUILD ' + esc(detail.heroBuildId) + '</span><h3>' + esc(detail.name ?? "Unnamed build") + '</h3></div><span class="muted">VERSION ' + esc(detail.version ?? "—") + '</span></div>' +
        (detail.description ? '<p>' + esc(detail.description) + '</p>' : '') +
        (categories.length
          ? '<div class="data-table-wrap"><table><thead><tr><th>Category</th><th>Ability / Mod ID</th><th>Annotation</th></tr></thead><tbody>' +
            categories.map(mod => '<tr><td>' + esc(mod.category) + '</td><td>' + esc(mod.abilityId ?? "—") + '</td><td>' + esc(mod.annotation ?? "—") + '</td></tr>').join("") +
            '</tbody></table></div>'
          : '<p class="muted">This build has no mod categories in the API response.</p>') +
        '</section>';
    }).join("");
    $("#hero-detail-builds").innerHTML = builds.length
      ? '<div class="data-table-wrap"><table><thead><tr><th>Build ID</th><th>Name</th><th>Matches</th><th>Win rate</th><th>Players</th></tr></thead><tbody>' + buildRows + '</tbody></table></div>' +
        (detailBlocks || '<p class="muted">Build detail records were not returned.</p>')
      : '<p class="muted">No hero build statistics returned for this filter.</p>';

    const abilities = model.abilityOrders.slice(0, 20);
    $("#hero-detail-abilities").innerHTML = abilities.length
      ? '<div class="data-table-wrap"><table><thead><tr><th>Ability order</th><th>Matches</th><th>Win rate</th><th>K / D / A</th></tr></thead><tbody>' +
        abilities.map(row => '<tr><td>' + esc(Array.isArray(row.abilities) ? row.abilities.join(" → ") : "—") + '</td><td>' + esc(row.matches ?? "—") + '</td><td>' + esc(percent(row.wins, row.matches)) + '</td><td>' + esc([row.totalKills, row.totalDeaths, row.totalAssists].map(value => value ?? "—").join(" / ")) + '</td></tr>').join("") +
        '</tbody></table></div>'
      : '<p class="muted">No ability order statistics returned for this filter.</p>';

    $("#hero-detail-status").innerHTML = '<span class="eyebrow">API CONNECTED</span><span>Hero analytics loaded</span>';
    setConnection(true, "API connected");
  }).catch(error => {
    if (isAborted(error)) return;
    $("#hero-detail-status").innerHTML = '<span class="eyebrow">ERROR</span><span class="error-text">' + esc(error.message) + '</span>';
    setConnection(false, "API unavailable");
  });

}

function renderHeroes(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">GAME / HERO INTELLIGENCE</span><h2>Heroes</h2><p>Hero roster, performance and combat statistics from the live Deadlock analytics API.</p></section>' +
    '<section class="panel analytics-filter-panel"><div class="section-head"><div><span class="eyebrow">SCOPE</span><h2>Hero statistics</h2></div><b id="heroes-status">LOADING</b></div>' +
    '<form id="heroes-filters" class="analytics-filters">' +
      '<label class="field"><span>Search hero</span><input name="search" type="search" placeholder="Abrams, Infernus…"></label>' +
      '<label class="field"><span>Game mode</span><select name="game_mode"><option value="normal" selected>Normal</option><option value="street_brawl">Street Brawl</option></select></label>' +
      '<label class="field"><span>Match mode</span><select name="match_mode"><option value="ranked,unranked" selected>Ranked + Unranked</option><option value="ranked">Ranked</option><option value="unranked">Unranked</option></select></label>' +
      '<label class="field"><span>From</span><input name="min_unix_timestamp" type="date"></label>' +
      '<label class="field"><span>To</span><input name="max_unix_timestamp" type="date"></label>' +
      '<label class="field"><span>Minimum hero matches</span><input name="min_hero_matches" type="number" min="0" placeholder="0"></label>' +
      '<button class="primary-button" type="submit">Apply filters</button></form></section>' +
    '<section class="analytics-grid" id="heroes-summary">' +
      '<article class="metric-card"><span>HEROES WITH DATA</span><strong>—</strong><small>filtered roster</small></article>' +
      '<article class="metric-card"><span>TOTAL HERO APPEARANCES</span><strong>—</strong><small>returned by API</small></article>' +
      '<article class="metric-card"><span>TOP WIN RATE</span><strong>—</strong><small>minimum sample respected</small></article>' +
      '<article class="metric-card"><span>DATA WINDOW</span><strong>30D</strong><small>API default scope</small></article>' +
    '</section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">ROSTER PERFORMANCE</span><h2>Hero statistics</h2></div><span class="muted">SORTED BY MATCHES</span></div><div id="heroes-list" class="hero-performance-grid"><p class="muted">Loading hero statistics.</p></div></section>';

  const form = $("#heroes-filters");
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  form.elements.min_unix_timestamp.value = defaultFrom;
  form.elements.max_unix_timestamp.value = defaultTo;

  let catalog = [];
  let stats = [];
  const renderRows = search => {
    const query = String(search ?? "").trim().toLocaleLowerCase();
    const heroesById = new Map(catalog.map(hero => [String(idOf(hero)), hero]));
    const rows = stats
      .filter(item => item?.heroId != null)
      .map(item => ({ item, hero: heroesById.get(String(item.heroId)) }))
      .filter(({ hero }) => !query || nameOf(hero).toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.item.matches ?? 0) - Number(a.item.matches ?? 0));

    const list = $("#heroes-list");
    list.innerHTML = rows.map(({ item, hero }) => {
      const matches = Number(item.matches);
      const wins = Number(item.wins);
      const winRate = Number.isFinite(matches) && matches > 0 && Number.isFinite(wins) ? (wins / matches) * 100 : null;
      const kda = [item.totalKills, item.totalDeaths, item.totalAssists].map(Number);
      const kdaText = kda.every(Number.isFinite) ? kda.join(" / ") : "—";
      const image = hero ? resolveAssetImage(hero, ["hero_card_critical_webp", "hero_card_critical", "icon_hero_card_webp", "icon_hero_card"]) : "";
      const accent = colorToCss(hero?.colors?.ui);
      return '<a class="hero-performance-card" href="#/heroes/' + encodeURIComponent(item.heroId) + '"' + (accent ? ' style="--hero-accent:' + esc(accent) + '"' : "") + '>' +
        '<div class="hero-performance-art">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '<div class="asset-placeholder">NO ART</div>') + '</div>' +
        '<div class="hero-performance-body"><div class="hero-performance-title"><div><small>HERO ' + esc(item.heroId) + '</small><h3>' + esc(nameOf(hero)) + '</h3></div><strong>' + esc(winRate == null ? "—" : winRate.toFixed(1) + "%") + '<small>WIN RATE</small></strong></div>' +
        '<div class="hero-performance-metrics"><span><small>MATCHES</small><b>' + esc(Number.isFinite(matches) ? matches.toLocaleString() : "—") + '</b></span><span><small>K / D / A</small><b>' + esc(kdaText) + '</b></span><span><small>DAMAGE</small><b>' + esc(Number.isFinite(Number(item.totalPlayerDamage)) ? Number(item.totalPlayerDamage).toLocaleString() : "—") + '</b></span><span><small>NET WORTH</small><b>' + esc(Number.isFinite(Number(item.totalNetWorth)) ? Number(item.totalNetWorth).toLocaleString() : "—") + '</b></span></div></div>' +
      '</a>';
    }).join("") || '<p class="muted">No heroes matched the current filters.</p>';

    $("#heroes-status").textContent = rows.length + " HEROES";
  };

  const load = async values => {
    $("#heroes-status").textContent = "LOADING";
    $("#heroes-list").innerHTML = '<p class="muted">Loading hero statistics…</p>';
    try {
      const filters = normalizeAnalyticsFilters(values);
      const [heroCatalog, heroStats] = await Promise.all([
        listHeroes({ ...assetVersion.options(), signal }),
        getHeroStatsSnapshot({ ...assetVersion.options(), ...filters, signal }),
      ]);
      if (signal.aborted) return;
      catalog = heroCatalog.data ?? [];
      stats = heroStats ?? [];
      const active = stats.filter(item => item?.heroId != null);
      const appearances = active.reduce((sum, item) => sum + (Number(item.matches) || 0), 0);
      const validRates = active
        .map(item => Number(item.matches) > 0 ? Number(item.wins) / Number(item.matches) * 100 : NaN)
        .filter(Number.isFinite);
      const topRate = validRates.length ? Math.max(...validRates) : null;
      $("#heroes-summary").innerHTML = [
        ["HEROES WITH DATA", active.length.toLocaleString(), "filtered roster"],
        ["TOTAL HERO APPEARANCES", appearances.toLocaleString(), "returned by API"],
        ["TOP WIN RATE", topRate == null ? "—" : topRate.toFixed(1) + "%", "minimum sample respected"],
        ["DATA WINDOW", values.min_unix_timestamp && values.max_unix_timestamp ? "CUSTOM" : "30D", "analytics scope"],
      ].map(([label, value, note]) => '<article class="metric-card"><span>' + label + '</span><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></article>').join("");
      renderRows(values.search);
      setConnection(true, "API connected");
    } catch (error) {
      if (isAborted(error)) return;
      $("#heroes-status").textContent = "ERROR";
      $("#heroes-list").innerHTML = '<p class="error-text">Hero statistics failed: ' + esc(error.message) + '</p>';
      setConnection(false, "API unavailable");
    }
  };

  form.addEventListener("input", event => {
    if (event.target.name === "search") renderRows(event.target.value);
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    load(Object.fromEntries(new FormData(form).entries()));
  });
  load(Object.fromEntries(new FormData(form).entries()));
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

function renderLeaderboard(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">GAME / LEADERBOARD</span><h2>Leaderboard</h2><p>Current regional leaderboard data returned by the Deadlock API. The API refreshes this data hourly.</p></section>' +
    '<section class="panel analytics-filter-panel"><form id="leaderboard-filters" class="analytics-filters">' +
    '<label class="field"><span>Region</span><select name="region"><option>Europe</option><option>Asia</option><option>NAmerica</option><option>SAmerica</option><option>Oceania</option></select></label>' +
    '<label class="field"><span>Leaderboard ID</span><input name="leaderboard_id" type="number" min="0" inputmode="numeric" placeholder="Current"></label>' +
    '<button class="primary-button" type="submit">Load leaderboard</button></form></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">REGIONAL DATA</span><h2>Players</h2></div><b id="leaderboard-status">LOADING</b></div><div id="leaderboard-list" class="analytics-table"><p class="muted">Loading leaderboard.</p></div></section>';

  const form = $("#leaderboard-filters");
  const list = $("#leaderboard-list");
  const load = async values => {
    $("#leaderboard-status").textContent = "LOADING";
    list.innerHTML = '<p class="muted">Loading leaderboard…</p>';
    try {
      const options = {};
      if (values.leaderboard_id !== "") options.leaderboard_id = Number(values.leaderboard_id);
      const result = await loadLeaderboard(values.region, { ...options, signal });
      if (signal.aborted) return;
      const entries = result.data ?? [];
      $("#leaderboard-status").textContent = entries.length + " PLAYERS";
      list.innerHTML = entries.map((entry, index) => {
        const heroes = Array.isArray(entry.top_hero_ids) ? entry.top_hero_ids.join(", ") : "—";
        return '<article class="analytics-table-row">' +
          '<span><strong>#' + esc(index + 1) + ' · ' + esc(entry.account_name ?? "Unknown account") + '</strong><small>Account IDs: ' + esc((entry.possible_account_ids ?? []).join(", ") || "—") + '</small></span>' +
          '<span><strong>Rank ' + esc(entry.rank ?? "—") + '</strong><small>Top hero IDs: ' + esc(heroes) + '</small></span>' +
          '</article>';
      }).join("") || '<p class="muted">No leaderboard entries returned.</p>';
    } catch (error) {
      if (isAborted(error)) return;
      $("#leaderboard-status").textContent = "ERROR";
      list.innerHTML = '<p class="error-text">' + esc(error.message) + '</p>';
    }
  };
  form.addEventListener("submit", event => {
    event.preventDefault();
    load(Object.fromEntries(new FormData(form).entries()));
  });
  load(Object.fromEntries(new FormData(form).entries()));
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
    '<label class="field"><span>Limit</span><input name="limit" type="number" min="0" value="50"></label>' +
    '<button class="primary-button" type="submit">Search builds</button></form></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">CATALOG</span><h2>Build catalog</h2></div><b id="build-status">LOADING</b></div><div id="build-list" class="analytics-table"><p class="muted">Loading builds.</p></div></section>';

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

function renderPlayers(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">GAME / PLAYERS</span><h2>Players</h2><p>Search Steam profiles and inspect public Deadlock player data from the current API contract.</p></section>' +
    '<section class="panel"><form id="player-search" class="analytics-filters">' +
      '<label class="field"><span>Player search</span><input name="query" type="search" required placeholder="Steam name or account ID"></label>' +
      '<label class="field"><span>Results</span><input name="limit" type="number" min="1" max="1000" value="25"></label>' +
      '<button class="primary-button" type="submit">Search players</button></form></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">PROFILES</span><h2>Steam profiles</h2></div><b id="player-search-status">READY</b></div><div id="player-results"><p class="muted">Search for a player to begin.</p></div></article>' +
      '<article class="panel"><div class="section-head"><div><span class="eyebrow">PLAYER DETAIL</span><h2 id="player-detail-title">Select a player</h2></div><b id="player-detail-status">IDLE</b></div><div id="player-detail"><p class="muted">Choose a result to load rank, hero stats and match history.</p></div></article></section>';

  const form = $("#player-search");
  const results = $("#player-results");
  const detail = $("#player-detail");

  const scalarEntries = object => Object.entries(object ?? {})
    .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 12);

  const renderProfiles = profiles => {
    results.innerHTML = profiles.map((profile, index) => {
      const accountId = profile?.account_id ?? profile?.accountid ?? profile?.steam_id3;
      const name = profile?.personaname ?? profile?.name ?? profile?.display_name ?? "Unknown profile";
      const avatar = profile?.avatarfull ?? profile?.avatar ?? profile?.avatar_url ?? "";
      return '<button type="button" class="match-row player-result" data-account-id="' + esc(accountId ?? "") + '">' +
        (avatar ? '<img class="match-player-hero" src="' + esc(avatar) + '" alt="" loading="lazy" decoding="async">' : "") +
        '<span><strong>' + esc(name) + '</strong><small>Account ' + esc(accountId ?? "—") + '</small></span>' +
        '<small>#' + (index + 1) + '</small></button>';
    }).join("") || '<p class="muted">No profiles found.</p>';

    results.querySelectorAll("[data-account-id]").forEach(button => {
      button.addEventListener("click", () => loadPlayer(button.dataset.accountId));
    });
  };

  const loadPlayer = async accountId => {
    if (!/^\d+$/.test(String(accountId ?? ""))) {
      detail.innerHTML = '<p class="error-text">The selected profile has no valid SteamID3.</p>';
      return;
    }
    $("#player-detail-title").textContent = "Account " + accountId;
    $("#player-detail-status").textContent = "LOADING";
    detail.innerHTML = '<p class="muted">Loading player data…</p>';

    try {
      const [rankResult, heroResult, historyResult] = await Promise.all([
        loadPlayerRank(accountId, { signal }),
        loadPlayerHeroStats({ account_ids: [Number(accountId)], signal }),
        loadPlayerMatchHistory(accountId, { signal }),
      ]);
      if (signal.aborted) return;

      const rank = rankResult.data ?? {};
      const heroStats = heroResult.data ?? [];
      const history = historyResult.data ?? [];
      const rankMetrics = scalarEntries(rank).map(([key, value]) =>
        '<div class="metric"><span>' + esc(key) + '</span><strong>' + esc(value ?? "—") + '</strong></div>'
      ).join("");
      const heroRows = heroStats.slice(0, 12).map(stat =>
        '<div class="metric"><span>Hero ' + esc(stat?.hero_id ?? "—") + '</span><strong>' +
        esc(stat?.matches_played ?? "—") + ' matches</strong><small>' +
        esc(stat?.wins ?? "—") + ' wins · ' + esc(stat?.kills ?? "—") + ' kills · ' +
        esc(stat?.deaths ?? "—") + ' deaths</small></div>'
      ).join("");
      const historyRows = history.slice(0, 10).map(match =>
        '<div class="metric"><span>Match ' + esc(match?.match_id ?? "—") + '</span><strong>' +
        esc(match?.hero_id ?? "Hero —") + '</strong><small>' +
        esc(match?.won != null ? (match.won ? "Win" : "Loss") : (match?.winning_team != null ? "Team " + match.winning_team : "Result unavailable")) +
        (match?.duration_s != null ? ' · ' + esc(formatDuration(match.duration_s)) : '') +
        '</small></div>'
      ).join("");

      detail.innerHTML =
        '<div class="match-detail-summary">' + (rankMetrics || '<p class="muted">No rank fields returned.</p>') + '</div>' +
        '<div class="section-head"><div><span class="eyebrow">HERO HISTORY</span><h3>Hero stats</h3></div><span class="muted">' + heroStats.length + ' returned</span></div>' +
        '<div class="analytics-grid">' + (heroRows || '<p class="muted">No hero stats returned.</p>') + '</div>' +
        '<div class="section-head"><div><span class="eyebrow">MATCH HISTORY</span><h3>Recent matches</h3></div><span class="muted">' + history.length + ' returned</span></div>' +
        '<div class="analytics-grid">' + (historyRows || '<p class="muted">No match history returned.</p>') + '</div>';
      $("#player-detail-status").textContent = "LOADED";
    } catch (error) {
      if (isAborted(error)) return;
      $("#player-detail-status").textContent = "ERROR";
      detail.innerHTML = '<p class="error-text">Player request failed: ' + esc(error.message) + '</p>';
    }
  };

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    $("#player-search-status").textContent = "LOADING";
    results.innerHTML = '<p class="muted">Searching profiles…</p>';
    try {
      const response = await searchPlayers(values.query.trim(), {
        limit: Number(values.limit),
        signal,
      });
      if (signal.aborted) return;
      renderProfiles(response.data);
      $("#player-search-status").textContent = response.data.length + " FOUND";
    } catch (error) {
      if (isAborted(error)) return;
      $("#player-search-status").textContent = "ERROR";
      results.innerHTML = '<p class="error-text">Player search failed: ' + esc(error.message) + '</p>';
    }
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
      list.innerHTML = filtered.map(operation => '<button class="operation-row" data-operation-key="' + esc(operation.operationKey) + '"><span class="method ' + operation.method.toLowerCase() + '">' + operation.method + '</span><span><b>' + esc(operation.operationId) + '</b><small>' + esc(operation.path) + '</small></span>' + (operation.deprecated ? "<em>deprecated</em>" : "") + "</button>").join("") || '<p class="muted">No operations match.</p>';
      list.querySelectorAll(".operation-row").forEach(button => button.addEventListener("click", () => renderOperation(operations.find(operation => operation.operationKey === button.dataset.operationKey), signal, contractResult.data)));
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

function formatExplorerValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function explorerResponseSize(data) {
  if (data == null) return null;
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof data === "string") return new TextEncoder().encode(data).byteLength;
  return new TextEncoder().encode(formatExplorerValue(data)).byteLength;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderExplorerHeaders(headers, emptyLabel) {
  const entries = Object.entries(headers ?? {});
  if (!entries.length) return '<p class="muted">' + esc(emptyLabel) + "</p>";
  return '<div class="explorer-headers">' + entries.map(([name, value]) =>
    '<div><code>' + esc(name) + '</code><span>' + esc(value) + "</span></div>"
  ).join("") + "</div>";
}

function renderExplorerResponseContent(result, target) {
  const data = result?.data;
  const contentType = String(result?.contentType ?? "").toLowerCase();

  if (data == null) {
    target.innerHTML = '<p class="muted">Empty response body.</p>';
    return;
  }

  if (typeof ReadableStream !== "undefined" && data instanceof ReadableStream) {
    target.innerHTML =
      '<div class="explorer-response-placeholder"><strong>STREAM</strong><p>The API returned a streaming response. The inspector does not consume the stream, so the live body remains untouched.</p></div>';
    return;
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    if (contentType.startsWith("image/") || data.type.startsWith("image/")) {
      const url = URL.createObjectURL(data);
      target.innerHTML =
        '<div class="explorer-image-preview"><img src="' + esc(url) + '" alt="API response preview"></div>' +
        '<p class="muted">' + esc(data.type || contentType || "image/*") + " · " + formatBytes(data.size) + "</p>";
      target.dataset.objectUrl = url;
      return;
    }
    target.innerHTML =
      '<div class="explorer-response-placeholder"><strong>BINARY</strong><p>' +
      esc(data.type || contentType || "application/octet-stream") + " · " + formatBytes(data.size) +
      "</p></div>";
    return;
  }

  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const preview = Array.from(bytes.slice(0, 128), byte => byte.toString(16).padStart(2, "0")).join(" ");
    target.innerHTML =
      '<div class="explorer-response-placeholder"><strong>BINARY</strong><p>' +
      esc(contentType || "application/octet-stream") + " · " + formatBytes(bytes.byteLength) +
      "</p><code class="explorer-hex">' + esc(preview || "empty") + (bytes.length > 128 ? " …" : "") + "</code></div>";
    return;
  }

  const text = typeof data === "string"
    ? data
    : formatExplorerValue(data);
  const language = contentType.includes("html") ? "HTML" : contentType.includes("event-stream") ? "SSE" : contentType.includes("json") || typeof data === "object" ? "JSON" : "TEXT";
  target.innerHTML =
    '<div class="explorer-response-toolbar"><span class="eyebrow">' + language + '</span><button type="button" class="secondary-button" data-copy-response>Copy response</button></div>' +
    '<pre class="explorer-response-body">' + esc(text) + "</pre>";

  const copyButton = target.querySelector("[data-copy-response]");
  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      setTimeout(() => { copyButton.textContent = "Copy response"; }, 1200);
    } catch {
      copyButton.textContent = "Copy unavailable";
    }
  });
}

async function renderExplorerResponse(result, target, signal) {
  if (!target) return;
  const previousUrl = target.dataset.objectUrl;
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    delete target.dataset.objectUrl;
  }

  const request = result?.request ?? {};
  const requestQuery = request.query && Object.keys(request.query).length ? request.query : {};
  const requestBody = request.body;
  const size = explorerResponseSize(result?.data);

  target.innerHTML =
    '<div class="explorer-response-meta">' +
      '<div><span>STATUS</span><strong class="' + (Number(result?.status) >= 400 ? "explorer-bad" : "explorer-good") + '">' + esc(result?.status ?? "—") + "</strong></div>" +
      '<div><span>LATENCY</span><strong>' + esc(result?.latencyMs != null ? result.latencyMs + " ms" : "—") + "</strong></div>" +
      '<div><span>TYPE</span><strong>' + esc(result?.contentType || "—") + "</strong></div>" +
      '<div><span>SIZE</span><strong>' + formatBytes(size) + "</strong></div>" +
    "</div>" +
    '<details class="explorer-details" open><summary>Request</summary>' +
      '<div class="explorer-request-grid">' +
        '<div><span>METHOD</span><code>' + esc(request.method ?? "—") + "</code></div>" +
        '<div><span>URL</span><code>' + esc(result?.url ?? "—") + "</code></div>" +
      "</div>" +
      '<div class="explorer-detail-section"><span class="eyebrow">QUERY</span><pre>' + esc(formatExplorerValue(requestQuery)) + "</pre></div>" +
      '<div class="explorer-detail-section"><span class="eyebrow">HEADERS</span>' + renderExplorerHeaders(request.headers, "No request headers.") + "</div>" +
      (requestBody !== undefined ? '<div class="explorer-detail-section"><span class="eyebrow">BODY</span><pre>' + esc(formatExplorerValue(requestBody)) + "</pre></div>" : "") +
    "</details>" +
    '<details class="explorer-details"><summary>Response headers</summary>' +
      renderExplorerHeaders(result?.headers, "No response headers returned.") +
    "</details>" +
    '<section class="explorer-response-content"><div class="section-head"><div><span class="eyebrow">RESPONSE BODY</span><h3>Payload</h3></div></div><div data-explorer-response-content><p class="muted">Rendering response…</p></div></section>';

  renderExplorerResponseContent(result, target.querySelector("[data-explorer-response-content]"));
  if (signal?.aborted) return;
}

function schemaFormNodes(node) {
  if (!node) return [];
  const children = node.type === "object" ? (node.properties ?? []).flatMap(schemaFormNodes) : [];
  return node.type === "array" || (node.type !== "object" && node.type !== "array") ? [node, ...children] : children;
}

function schemaFieldControl(node) {
  const required = node.required ? " required" : "";
  const nullable = node.nullable ? " · nullable" : "";
  const meta = (node.required ? "required" : "optional") + nullable;
  const constraints = [];
  if (node.minimum != null) constraints.push("min " + node.minimum);
  if (node.maximum != null) constraints.push("max " + node.maximum);
  if (node.minLength != null) constraints.push("min length " + node.minLength);
  if (node.maxLength != null) constraints.push("max length " + node.maxLength);
  if (node.minItems != null) constraints.push("min items " + node.minItems);
  if (node.maxItems != null) constraints.push("max items " + node.maxItems);

  if (node.type === "object") {
    return '<fieldset class="schema-object"><legend>' + esc(node.label) + ' <small>' + esc(meta) + '</small></legend>' +
      (node.description ? '<p class="muted">' + esc(node.description) + '</p>' : '') +
      (node.properties?.length ? node.properties.map(schemaFieldControl).join("") : '<p class="muted">No declared properties.</p>') +
      '</fieldset>';
  }

  if (node.type === "array") {
    const placeholder = node.items?.type === "object" || node.items?.type === "array" ? '[ ]' : '["value"]';
    return '<label class="field schema-field"><span>' + esc(node.label) + ' <small>array · ' + esc(meta) + '</small></span>' +
      (node.description ? '<small class="muted">' + esc(node.description) + '</small>' : '') +
      '<textarea data-body-field="' + esc(node.path) + '" rows="3" placeholder="' + esc(placeholder) + '"' + required + '>' +
      (node.default !== undefined ? esc(JSON.stringify(node.default)) : '') + '</textarea>' +
      (constraints.length ? '<small class="muted">' + esc(constraints.join(" · ")) + '</small>' : '') +
      '</label>';
  }

  const values = node.enum;
  let control;
  if (values.length || node.type === "boolean") {
    const options = [];
    if (!node.required || node.nullable) options.push('<option value="">—</option>');
    if (node.nullable) options.push('<option value="null">null</option>');
    if (node.type === "boolean" && !values.length) {
      options.push('<option value="true">true</option><option value="false">false</option>');
    } else {
      values.forEach(value => options.push('<option value="' + esc(typeof value === "object" ? JSON.stringify(value) : String(value)) + '">' + esc(typeof value === "object" ? JSON.stringify(value) : String(value)) + '</option>'));
    }
    control = '<select data-body-field="' + esc(node.path) + '"' + required + '>' + options.join("") + '</select>';
  } else {
    const inputType = node.type === "integer" || node.type === "number" ? "number" : "text";
    const step = node.type === "integer" ? "1" : node.type === "number" ? "any" : null;
    control = '<input data-body-field="' + esc(node.path) + '" type="' + inputType + '" placeholder="' + esc(node.default !== undefined ? String(node.default) : node.type) + '"' +
      (step ? ' step="' + step + '"' : '') + required +
      (node.default !== undefined ? ' value="' + esc(node.default) + '"' : '') + '>';
  }

  return '<label class="field schema-field"><span>' + esc(node.label) + ' <small>' + esc(node.type + ' · ' + meta) + '</small></span>' +
    (node.description ? '<small class="muted">' + esc(node.description) + '</small>' : '') +
    control +
    (constraints.length ? '<small class="muted">' + esc(constraints.join(" · ")) + '</small>' : '') +
    '</label>';
}

function setSchemaPath(root, path, value) {
  const parts = path.replace(/^__body\./, "").split(".").filter(Boolean);
  if (!parts.length) return value;
  let target = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!target[parts[index]] || typeof target[parts[index]] !== "object") target[parts[index]] = {};
    target = target[parts[index]];
  }
  target[parts[parts.length - 1]] = value;
  return root;
}

function buildStructuredBody(form, model) {
  if (!model) return undefined;
  if (model.type !== "object") {
    const field = form.querySelector('[data-body-field="' + CSS.escape(model.path) + '"]');
    if (!field) return undefined;
    return parseSchemaFormValue(field.value, model.schema, "$");
  }
  const body = {};
  for (const field of form.querySelectorAll("[data-body-field]")) {
    const path = field.dataset.bodyField;
    const node = schemaFormNodes(model).find(item => item.path === path);
    if (!node) continue;
    const value = parseSchemaFormValue(field.value, node.schema, "$." + path.replace(/^__body\./, ""));
    if (value !== undefined) setSchemaPath(body, path, value);
  }
  return Object.keys(body).length ? body : undefined;
}


function schemaExampleValue(value) {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formValueAtPath(value, path) {
  if (!path || path === "__body") return value;
  return path.replace(/^__body\./, "").split(".").reduce((current, key) => current?.[key], value);
}

function applySchemaExample(form, model, example) {
  if (!model) return;
  const fields = model.type === "object" ? schemaFormNodes(model) : [model];
  for (const node of fields) {
    const field = form.querySelector('[data-body-field="' + CSS.escape(node.path) + '"]');
    if (!field) continue;
    const value = formValueAtPath(example, node.path);
    if (value === undefined) continue;
    field.value = schemaExampleValue(value);
  }
}

function renderOperation(operation, signal, contract = null) {
  const detail = describeOperation(operation, contract);
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
  const initialBody = bodyTypes[0];
  const bodyModel = initialBody?.schema ? buildSchemaFormModel(initialBody.schema) : null;
  const initialExamples = buildRequestExamples(initialBody);
  const bodyField = bodyTypes.length
    ? '<section class="schema-body-editor"><div class="schema-body-head"><div><span class="eyebrow">REQUEST BODY</span><h3>Schema-driven payload</h3></div>' +
      '<span class="muted">' + esc(initialBody.required ? "required" : "optional") + '</span></div>' +
      '<label class="field"><span>Content type <small>OpenAPI</small></span><select name="__contentType" id="explorer-content-type">' +
      bodyTypes.map(item => '<option value="' + esc(item.mediaType) + '">' + esc(item.mediaType) + '</option>').join("") +
      '</select></label>' +
      '<label class="field"><span>Example / preset <small>contract + saved</small></span><select id="explorer-body-example"' + (initialExamples.length ? "" : " hidden") + '><option value="">— choose example —</option>' +
        initialExamples.map((example, index) => '<option value="contract:' + index + '">' + esc(example.name) + (example.source === "generated" ? " · generated" : "") + '</option>').join("") + '</select></label>' +
      '<div class="panel-actions explorer-preset-actions"><input id="explorer-preset-name" class="explorer-input" type="text" maxlength="80" placeholder="Saved preset name" aria-label="Saved preset name">' +
      '<button type="button" class="secondary-button" id="explorer-save-preset">Save current</button><button type="button" class="secondary-button" id="explorer-delete-preset" disabled>Delete saved</button></div>' +
      '<div id="schema-body-editor">' + (bodyModel ? schemaFieldControl(bodyModel) : '<label class="field"><span>Payload</span><textarea name="__body" rows="8" placeholder="Request payload"></textarea></label>') + '</div>' +
      '<p class="muted schema-body-note">Fields, defaults, constraints and examples are derived from the current OpenAPI contract. Arrays and free-form objects accept JSON.</p></section>'
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
    '<div id="operation-result" class="result-box explorer-result"><span class="eyebrow">RESPONSE INSPECTOR</span><p class="muted">Waiting for request.</p></div>' +
    '<div class="result-box"><span class="eyebrow">DOCUMENTED RESPONSES</span>' + responseSummary + "</div>";

  $("#operation-form").addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const activeBodyType = bodyTypes.find(item => item.mediaType === event.currentTarget.elements.__contentType?.value) ?? initialBody;
    const activeBodyModel = activeBodyType?.schema ? buildSchemaFormModel(activeBodyType.schema) : null;
    if (activeBodyModel) {
      const structuredBody = buildStructuredBody(event.currentTarget, activeBodyModel);
      if (structuredBody !== undefined) values.__body = structuredBody;
    }
    const resultBox = $("#operation-result");
    resultBox.innerHTML = '<span class="eyebrow">RESPONSE INSPECTOR</span><p class="muted">Executing request…</p>';
    try {
      const result = await executeOperation(operation, values, { signal });
      if (signal.aborted) return;
      await renderExplorerResponse(result, resultBox, signal);
    } catch (error) {
      if (isAborted(error)) return;
      resultBox.innerHTML =
        '<span class="eyebrow">REQUEST ERROR</span>' +
        '<div class="explorer-error-grid">' +
          '<div><span>STATUS</span><strong>' + esc(error.status ?? "—") + "</strong></div>" +
          '<div><span>CODE</span><strong>' + esc(error.code ?? error.name ?? "ERROR") + "</strong></div>" +
          '<div><span>RETRY-AFTER</span><strong>' + esc(error.retryAfterMs != null ? error.retryAfterMs + " ms" : "—") + "</strong></div>" +
        "</div>" +
        '<pre class="error-text">' + esc(error.message) + "</pre>";
    }
  });
  const contentTypeSelect = $("#explorer-content-type");
  const bodyEditor = $("#schema-body-editor");
  const presetState = { selectedId: null, presets: [] };
  const renderRequestPresets = selected => {
    const examples = buildRequestExamples(selected);
    const presets = listUserRequestPresets(operation.operationKey, selected?.mediaType);
    presetState.presets = presets;
    presetState.selectedId = null;
    const exampleSelect = $("#explorer-body-example");
    if (!exampleSelect) return;

    const options = examples.map((example, index) =>
      '<option value="contract:' + index + '">' + esc(example.name) +
      (example.source === "generated" ? " · generated" : "") + '</option>'
    );
    if (presets.length) {
      options.push('<optgroup label="Saved">' +
        presets.map(preset => '<option value="user:' + esc(preset.id) + '">' + esc(preset.name) + '</option>').join("") +
        '</optgroup>');
    }
    exampleSelect.innerHTML = '<option value="">— choose example —</option>' + options.join("");
    exampleSelect.hidden = !examples.length && !presets.length;
    exampleSelect.dataset.examples = JSON.stringify(examples);
  };

  const rebuildBodyEditor = selected => {
    const selectedModel = selected?.schema ? buildSchemaFormModel(selected.schema) : null;
    bodyEditor.innerHTML = selectedModel ? schemaFieldControl(selectedModel) : '<label class="field"><span>Payload</span><textarea data-body-field="__body" rows="8" placeholder="Request payload"></textarea></label>';
    renderRequestPresets(selected);
  };
  contentTypeSelect?.addEventListener("change", () => {
    rebuildBodyEditor(bodyTypes.find(item => item.mediaType === contentTypeSelect.value) ?? initialBody);
  });
  const exampleSelect = $("#explorer-body-example");
  const presetNameInput = $("#explorer-preset-name");
  const savePresetButton = $("#explorer-save-preset");
  const deletePresetButton = $("#explorer-delete-preset");

  const currentBodyValue = () => {
    const selected = bodyTypes.find(item => item.mediaType === contentTypeSelect?.value) ?? initialBody;
    const model = selected?.schema ? buildSchemaFormModel(selected.schema) : null;
    const form = $("#operation-form");
    if (!form) return undefined;
    if (model) return buildStructuredBody(form, model);
    const raw = form.elements.__body?.value ?? "";
    if (!raw.trim()) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  };

  exampleSelect?.addEventListener("change", () => {
    const selected = bodyTypes.find(item => item.mediaType === contentTypeSelect?.value) ?? initialBody;
    const model = selected?.schema ? buildSchemaFormModel(selected.schema) : null;
    const value = exampleSelect.value;
    if (value.startsWith("contract:")) {
      const index = Number(value.slice("contract:".length));
      const examples = JSON.parse(exampleSelect.dataset.examples || "[]");
      if (Number.isInteger(index) && examples[index]) applySchemaExample($("#operation-form"), model, examples[index].value);
      presetState.selectedId = null;
      if (deletePresetButton) deletePresetButton.disabled = true;
      return;
    }

    if (value.startsWith("user:")) {
      const preset = presetState.presets.find(item => item.id === value.slice("user:".length));
      if (!preset) return;
      applySchemaExample($("#operation-form"), model, preset.value);
      presetState.selectedId = preset.id;
      if (deletePresetButton) deletePresetButton.disabled = false;
      if (presetNameInput) presetNameInput.value = preset.name;
      return;
    }

    presetState.selectedId = null;
    if (deletePresetButton) deletePresetButton.disabled = true;
  });

  savePresetButton?.addEventListener("click", () => {
    const selected = bodyTypes.find(item => item.mediaType === contentTypeSelect?.value) ?? initialBody;
    const name = presetNameInput?.value.trim() ?? "";
    if (!name) {
      presetNameInput?.focus();
      return;
    }

    const value = currentBodyValue();
    if (value === undefined) return;

    try {
      const preset = saveUserRequestPreset({
        operationKey: operation.operationKey,
        mediaType: selected?.mediaType ?? "application/json",
        name,
        value,
      });
      if (!preset) return;
      renderRequestPresets(selected);
      exampleSelect.value = "user:" + preset.id;
      presetState.selectedId = preset.id;
      if (deletePresetButton) deletePresetButton.disabled = false;
    } catch (error) {
      console.warn("Deadlock request preset could not be saved", error);
    }
  });

  deletePresetButton?.addEventListener("click", () => {
    if (!presetState.selectedId) return;
    try {
      if (!deleteUserRequestPreset(presetState.selectedId)) return;
      const selected = bodyTypes.find(item => item.mediaType === contentTypeSelect?.value) ?? initialBody;
      renderRequestPresets(selected);
      if (presetNameInput) presetNameInput.value = "";
      presetState.selectedId = null;
      deletePresetButton.disabled = true;
      exampleSelect.value = "";
    } catch (error) {
      console.warn("Deadlock request preset could not be deleted", error);
    }
  });

  renderRequestPresets(initialBody);

  const requestSchemaHtml = bodyTypes.map(item => item.schema
    ? renderSchemaViewer(buildSchemaViewModel(item.schema), "Request · " + item.mediaType)
    : "").join("");
  const responseSchemaHtml = detail.responseInfo.flatMap(response =>
    (response.content ?? []).filter(content => content.schema).map(content =>
      renderSchemaViewer(buildSchemaViewModel(content.schema), "Response " + response.status + " · " + content.mediaType)
    )
  ).join("");
  const schemaContainer = document.createElement("div");
  schemaContainer.className = "explorer-schemas";
  schemaContainer.innerHTML = requestSchemaHtml + responseSchemaHtml;
  target.querySelector("#operation-result")?.after(schemaContainer);
;
}

function bindVersionControl() {
  const select = $("#client-version");
  if (!select || select.dataset.bound === "true") return;
  select.dataset.bound = "true";
  select.addEventListener("change", async event => {
    assetVersion.set(event.target.value);
    await applyAssetColors();
    route();
  });
}


function renderMaps(signal) {
  el.content.innerHTML =
    '<section class="page-head"><span class="eyebrow">GAME / MAP INTELLIGENCE</span><h2>Map Explorer</h2><p>Live map geometry and official map layers from the Deadlock asset contract. Coordinates and markers are rendered directly from the API response.</p></section>' +
    '<section class="map-toolbar panel"><div><span class="eyebrow">MAP DATA</span><strong id="map-build">LATEST BUILD</strong></div><div class="map-toggles" role="group" aria-label="Map layers">' +
    '<label><input type="checkbox" data-map-layer="objectives" checked> Objectives</label>' +
    '<label><input type="checkbox" data-map-layer="camps" checked> Neutral camps</label>' +
    '<label><input type="checkbox" data-map-layer="entities" checked> Entities</label>' +
    '<label><input type="checkbox" data-map-layer="ziplines" checked> Ziplines</label>' +
    '</div></section>' +
    '<section class="map-layout"><article class="panel map-panel"><div class="map-controls"><button type="button" id="map-zoom-out" aria-label="Zoom out">−</button><button type="button" id="map-zoom-reset">100%</button><button type="button" id="map-zoom-in" aria-label="Zoom in">+</button></div><div id="map-stage" class="map-stage" aria-live="polite"><div class="map-loading">Loading map data…</div></div></article>' +
    '<aside class="panel map-legend"><span class="eyebrow">MAP INDEX</span><h3>Live layers</h3><div id="map-summary" class="map-summary"></div><div id="map-details" class="map-details"></div><div id="map-selection" class="map-selection" aria-live="polite"><span class="eyebrow">SELECTION</span><p>Choose a marker to inspect its API data.</p></div></aside></section>';

  const stage = $("#map-stage");
  const options = { ...assetVersion.options(), signal };
  fetchMap(options).then(result => {
    if (signal.aborted) return;
    const map = result?.data ?? {};
    const images = map.images ?? {};
    const safe = url => safeExternalUrl(url);
    const base = safe(images.background) ?? safe(images.plain) ?? safe(images.minimap) ?? safe(images.mid);
    const layers = [
      ["mid", images.mid],
      ["mid_tunnels", images.mid_tunnels],
      ["rat_tunnels", images.rat_tunnels],
      ["frame", images.frame],
    ].map(([name, url]) => [name, safe(url)]).filter(([, url]) => url);

    const marker = (className, left, top, title, icon, extra = "") =>
      '<button type="button" class="map-marker ' + className + '" style="left:' + (Number(left) * 100) + '%;top:' + (Number(top) * 100) + '%" title="' + esc(title) + '" aria-label="' + esc(title) + '">' +
      (icon ? '<img src="' + esc(icon) + '" alt="" loading="lazy" decoding="async">' : '<span>' + esc(extra || "•") + '</span>') + '</button>';

    
    const camps = Array.isArray(map.neutralCamps) ? map.neutralCamps : [];
    const ziplinePaths = Array.isArray(map.ziplinePaths) ? map.ziplinePaths : [];
    const ziplineSvg = ziplinePaths.map((path, index) => {
      const segments = Array.isArray(path?.segments) ? path.segments : [];
      if (!segments.length) return "";
      const first = segments[0]?.start;
      if (!Array.isArray(first) || first.length < 2) return "";
      const commands = ["M " + Number(first[0]) + " " + Number(first[1])];
      for (const segment of segments) {
        const c1 = segment?.control1;
        const c2 = segment?.control2;
        const end = segment?.end;
        if (![c1, c2, end].every(point => Array.isArray(point) && point.length >= 2 && point.every(value => Number.isFinite(Number(value))))) continue;
        commands.push(
          "C " +
          Number(c1[0]) + " " + Number(c1[1]) + " " +
          Number(c2[0]) + " " + Number(c2[1]) + " " +
          Number(end[0]) + " " + Number(end[1])
        );
      }
      const color = colorToCss(path?.color_parsed ?? path?.color);
      return '<path class="map-zipline-path" data-zipline="' + index + '" d="' + esc(commands.join(" ")) + '"' +
        (color ? ' style="--zipline-color:' + esc(color) + '"' : "") +
        ' vector-effect="non-scaling-stroke"></path>';
    }).join("");
    const objectiveHtml = Object.entries(map.objectivePositions ?? {}).map(([name, position]) => {
      const normalizedName = name.replaceAll("_", " ");
      const isCore = /core|patron/i.test(name);
      return marker("objective-marker" + (isCore ? " objective-core" : ""), position?.left_relative, position?.top_relative, normalizedName, null, "◆");
    }).join("");

    const campsHtml = camps.map(camp =>
      marker("camp-marker camp-" + esc(camp.kind), camp.left_relative, camp.top_relative, camp.name + " · " + camp.kind, camp.icon)
    ).join("");

    const entities = map.entities && typeof map.entities === "object" ? map.entities : {};
    const entityGroups = Object.entries(entities).flatMap(([group, values]) =>
      Array.isArray(values) ? values.map((entity, index) => ({ group, entity, index })) : []
    );
    const entitiesHtml = entityGroups.map(({ group, entity, index }) =>
      marker("entity-marker", entity.left_relative, entity.top_relative, group.replaceAll("_", " ") + " #" + (index + 1), null, "•")
    ).join("");

    stage.innerHTML =
      '<div class="map-canvas">' +
      (base ? '<img class="map-layer map-base" src="' + esc(base) + '" alt="Deadlock map base layer" draggable="false">' : "") +
      layers.map(([name, url]) => '<img class="map-layer map-' + esc(name) + '" src="' + esc(url) + '" alt="" aria-hidden="true" draggable="false">').join("") +
      '<svg class="map-ziplines" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">' + ziplineSvg + '</svg>' +
      '<div class="map-markers map-objectives">' + objectiveHtml + '</div>' +
      '<div class="map-markers map-camps">' + campsHtml + '</div>' +
      '<div class="map-markers map-entities">' + entitiesHtml + '</div>' +
      '</div>';

    const setMarkerGroup = (name, visible) => {
      const node = name === "ziplines" ? stage.querySelector(".map-ziplines") : stage.querySelector(".map-markers.map-" + name);
      if (node) node.hidden = !visible;
    };
    document.querySelectorAll("[data-map-layer]").forEach(input => {
      input.addEventListener("change", event => setMarkerGroup(event.target.dataset.mapLayer, event.target.checked));
    });

    const selection = $("#map-selection");
    const showSelection = (type, title, data) => {
      selection.innerHTML = '<span class="eyebrow">' + esc(type) + '</span><h4>' + esc(title) + '</h4><pre>' + esc(JSON.stringify(data, null, 2)) + '</pre>';
    };
    const markerData = [
      ...Object.entries(map.objectivePositions ?? {}).map(([name, data]) => ({
        selector: ".objective-marker",
        type: "OBJECTIVE",
        title: name.replaceAll("_", " "),
        data,
      })),
      ...camps.map(camp => ({
        selector: ".camp-marker",
        type: "NEUTRAL CAMP",
        title: camp.name + " · " + camp.kind,
        data: camp,
      })),
      ...entityGroups.map(({ group, entity, index }) => ({
        selector: ".entity-marker",
        type: "ENTITY",
        title: group.replaceAll("_", " ") + " #" + (index + 1),
        data: entity,
      })),
    ];
    const markerButtons = stage.querySelectorAll(".map-marker");
    markerButtons.forEach((button, index) => {
      const item = markerData[index];
      if (item) {
        button.addEventListener("click", () => showSelection(item.type, item.title, item.data));
      }
    });
    const canvas = stage.querySelector(".map-canvas");
    let scale = 1, offsetX = 0, offsetY = 0, dragging = false, startX = 0, startY = 0;
    const applyTransform = () => {
      if (!canvas) return;
      canvas.style.transform = "translate(" + offsetX + "px," + offsetY + "px) scale(" + scale + ")";
      $("#map-zoom-reset").textContent = Math.round(scale * 100) + "%";
    };
    const changeZoom = delta => { scale = Math.min(2.5, Math.max(.75, scale + delta)); applyTransform(); };
    $("#map-zoom-in").addEventListener("click", () => changeZoom(.25));
    $("#map-zoom-out").addEventListener("click", () => changeZoom(-.25));
    $("#map-zoom-reset").addEventListener("click", () => { scale = 1; offsetX = offsetY = 0; applyTransform(); });
    stage.addEventListener("wheel", event => { event.preventDefault(); changeZoom(event.deltaY < 0 ? .1 : -.1); }, { passive: false });
    stage.addEventListener("pointerdown", event => { if (event.target.closest(".map-marker")) return; dragging = true; startX = event.clientX - offsetX; startY = event.clientY - offsetY; stage.setPointerCapture(event.pointerId); });
    stage.addEventListener("pointermove", event => { if (!dragging) return; offsetX = event.clientX - startX; offsetY = event.clientY - startY; applyTransform(); });
    stage.addEventListener("pointerup", event => { dragging = false; stage.releasePointerCapture?.(event.pointerId); });
    stage.addEventListener("pointercancel", event => { dragging = false; stage.releasePointerCapture?.(event.pointerId); });
    applyTransform();

    $("#map-build").textContent = options.clientVersion ? "BUILD " + options.clientVersion : "LATEST BUILD";
    $("#map-summary").innerHTML =
      '<div><span>RADIUS</span><strong>' + esc(map.radius ?? "—") + '</strong></div>' +
      '<div><span>OBJECTIVES</span><strong>' + Object.keys(map.objectivePositions ?? {}).length + '</strong></div>' +
      '<div><span>NEUTRAL CAMPS</span><strong>' + camps.length + '</strong></div>' +
      '<div><span>ENTITIES</span><strong>' + entityGroups.length + '</strong></div>' +
      '<div><span>ZIPLINES</span><strong>' + ziplinePaths.length + '</strong></div>';

    const entityNames = entityGroups.reduce((counts, item) => {
      counts[item.group] = (counts[item.group] ?? 0) + 1;
      return counts;
    }, {});
    $("#map-details").innerHTML =
      '<div class="map-detail"><span class="eyebrow">IMAGE LAYERS</span><p>' + layers.map(([name]) => esc(name)).join(" · ") + '</p></div>' +
      '<div class="map-detail"><span class="eyebrow">ENTITY GROUPS</span><p>' +
      (Object.entries(entityNames).map(([name, count]) => esc(name.replaceAll("_", " ")) + " × " + count).join(" · ") || "No extracted entities for this build.") +
      '</p></div>' +
      '<div class="map-detail"><span class="eyebrow">DATA AVAILABILITY</span><p>' +
      (map.neutralCamps == null ? "Neutral camps are not available for this asset build." : "Neutral camp positions are available.") +
      " " + (map.entities == null ? "Map entity extraction is not available." : "Map entity extraction is available.") +
      '</p></div>';

    setConnection(true, "API connected");
  }).catch(error => {
    if (isAborted(error)) return;
    stage.innerHTML = '<div class="map-loading error-text">Map request failed: ' + esc(error.message) + '</div>';
    setConnection(false, "API unavailable");
  });
}

function renderNotFound(routeName) {
  el.content.innerHTML = '<section class="page-head"><span class="eyebrow">NAVIGATION / 404</span><h2>Route not found</h2><p>The route <code>' +
    esc('#/' + routeName) +
    '</code> is not implemented in this build.</p><p><a class="primary-button" href="#/">Return to dashboard</a></p></section>';
}

function route() {
  const signal = beginRoute();
  const routeParts = location.hash.replace(/^#\/?/, "").split("/");
  const routeName = routeParts[0] || "dashboard";
  if (routeName === "api") renderApiStatus(signal);
  else if (routeName === "analytics") renderAnalytics(signal);
  else if (routeName === "matches") renderMatches(signal);
  else if (routeName === "players") renderPlayers(signal);
  else if (routeName === "builds") renderBuilds(signal);
  else if (routeName === "leaderboard") renderLeaderboard(signal);
  else if (routeName === "item-analytics") renderItemAnalytics(signal);
  else if (routeName === "maps") renderMaps(signal);
  else if (routeName === "data") renderDataExplorer(signal);
  else if (routeName === "graphql") renderGraphql(signal);
  else if (routeName === "heroes" && routeParts[1]) renderHeroDetail(routeParts[1], signal);
  else if (routeName === "heroes") renderHeroes(signal);
  else if (routeName === "items" || routeName === "ranks") renderAssetCatalog(routeName, signal);
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
