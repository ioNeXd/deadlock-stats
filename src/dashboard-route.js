import { API_BASE_URL } from "./api/client.js";
import { resolveHeroCardImage } from "./adapters/assets.js";
import { colorToCss, createAssetVersionContext } from "./services/asset-version.js";

const assetVersion = createAssetVersionContext();
let dashboardRuntimePromise = null;
let assetsRuntimePromise = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const $ = selector => document.querySelector(selector);
const isAborted = error => error?.code === "ABORTED" || error?.name === "AbortError";

function loadDashboardRuntime() {
  if (!dashboardRuntimePromise) dashboardRuntimePromise = import("./services/dashboard.js");
  return dashboardRuntimePromise;
}

function loadAssetsRuntime() {
  if (!assetsRuntimePromise) assetsRuntimePromise = import("./services/assets.js");
  return assetsRuntimePromise;
}

function setConnection(online, label) {
  const dot = $("#api-dot");
  const status = $("#api-status");
  dot?.classList.toggle("online", online);
  dot?.classList.toggle("offline", !online);
  if (status) status.textContent = label;
}

function renderHeroGrid(data) {
  const heroes = Array.isArray(data) ? data : (data?.data ?? []);
  const grid = $("#hero-grid");
  grid.innerHTML = heroes.slice(0, 8).map((hero, index) => {
    const portrait = resolveHeroCardImage(hero);
    const heroColor = colorToCss(hero?.colors?.ui);
    const accent = heroColor || ["#5da9e9", "#9d83e6", "#68c38a", "#d86b6b"][index % 4];
    const description = hero?.description ?? hero?.role ?? hero?.playstyle ?? "Deadlock hero";
    return '<a class="hero-card hero-card-editorial" href="#/heroes" style="--hero-accent:' + esc(accent) + '">' +
      '<div class="hero-card-art" aria-hidden="true">' +
      (portrait ? '<img class="hero-card-portrait" src="' + esc(portrait) + '" alt="" loading="lazy" decoding="async">' : '') +
      '</div>' +
      '<div class="hero-color-wash" aria-hidden="true"></div>' +
      '<div class="hero-info"><small>HERO / ' + esc(hero?.role ?? "ROSTER") + '</small><h3>' + esc(hero?.name ?? hero?.display_name ?? hero?.hero_name ?? ("Hero " + (hero?.id ?? "?"))) + '</h3><p>' + esc(description) + '</p><span class="hero-card-index">' + String(index + 1).padStart(2, "0") + '</span></div></a>';
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

async function renderDashboard({ content, signal }) {
  content.innerHTML = '<section class="dashboard-mosaic command-center-mosaic">' +
      '<div class="hero-banner command-center-hero"><div><div class="dashboard-controls">' + renderVersionControl() + '</div><span class="eyebrow">LIVE DATA / CITY NEVER SLEEPS</span><div id="dashboard-patch-copy"><span class="dashboard-patch-loading">LOADING LATEST MAJOR UPDATE…</span></div><div class="pills"><span>API-FIRST</span><span>OPENAPI</span><span>LIVE CONTRACT</span></div></div></div>' +
      '<article class="metric-card command-metric command-blue"><span>FETCHED MATCHES / 24H</span><strong id="matches-per-day">—</strong><small>API info</small></article>' +
    '</section>' +
    '<section class="section"><div class="section-head"><div><span class="eyebrow">ROSTER</span><h2>Heroes in the city</h2></div><a href="#/heroes">View all →</a></div><div id="hero-grid" class="hero-grid" aria-live="polite"></div></section>' +
    '<section class="dashboard-grid"><article class="panel"><div class="section-head"><div><span class="eyebrow">SYSTEM</span><h2>API connection</h2></div><b id="api-badge">CHECKING</b></div><div class="metric"><span>Endpoint</span><strong>' + esc(API_BASE_URL.replace("https://", "")) + '</strong></div><div class="metric"><span>Hero response</span><strong id="api-latency">—</strong></div><div class="metric"><span>Latest major update</span><strong id="latest-patch" class="patch-link">Loading…</strong></div></article><article class="panel quote"><span>“</span><p>Data should feel like it belongs to the world it describes.</p><small>DEADLOCK STATS / NEW SITE</small></article></section>' +
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">ACTIVITY</span><h2>Recent game activity</h2></div><b id="dashboard-activity-status">LOADING</b></div><div id="dashboard-activity" class="dashboard-activity"><p class="muted">Loading daily game statistics…</p></div></section>';
  loadDashboard(signal);
}

async function loadDashboard(signal) {
  const dashboardRuntime = await loadDashboardRuntime();
  const options = { ...assetVersion.options(), signal };

  const loadHeroes = async () => {
    try {
      const assetsRuntime = await loadAssetsRuntime();
      const result = await assetsRuntime.listHeroes(options);
      if (signal.aborted) return;
      $("#api-latency").textContent = result.latencyMs + " ms";
      renderHeroGrid(result.data);
      if ($("#api-badge").textContent === "CHECKING") {
        setConnection(true, "API connected");
        $("#api-badge").textContent = "ONLINE";
        $("#api-badge").classList.add("online");
      }
    } catch (error) {
      if (isAborted(error)) return;
      $("#api-latency").textContent = "—";
      renderHeroGrid([]);
      console.error("Deadlock API hero catalog request failed", error);
    }
  };

  const loadCore = async () => {
    try {
      const snapshot = await dashboardRuntime.getDashboardCoreSnapshot(options);
      if (signal.aborted) return;
      const info = snapshot?.info?.data ?? {};
      $("#matches-per-day").textContent = Number.isFinite(Number(info.fetched_matches_per_day))
        ? Number(info.fetched_matches_per_day).toLocaleString()
        : "—";
      $("#latest-patch").textContent = "Loading…";
      setConnection(true, "API connected");
      $("#api-badge").textContent = "ONLINE";
      $("#api-badge").classList.add("online");
    } catch (error) {
      if (isAborted(error)) return;
      $("#matches-per-day").textContent = "—";
      $("#latest-patch").textContent = "Patch feed unavailable.";
      setConnection(false, "API unavailable");
      $("#api-badge").textContent = "OFFLINE";
      $("#api-badge").classList.remove("online");
      console.error("Deadlock API dashboard core request failed", error);
    }
  };

  // Critical dashboard requests start together. The hero catalog no longer waits
  // for /v1/info, while activity and patch data remain independently degraded.
  loadCore();
  loadHeroes();

  dashboardRuntime.getDashboardActivitySnapshot(options).then(activityResult => {
    if (signal.aborted) return;
    const rows = Array.isArray(activityResult?.activity) ? activityResult.activity.slice(-7).reverse() : [];
    const status = $("#dashboard-activity-status");
    const panel = $("#dashboard-activity");
    if (status) status.textContent = rows.length ? "LIVE" : "NO DATA";
    if (panel) {
      panel.innerHTML = rows.length
        ? rows.map(row => {
            const matches = Number(row?.total_matches);
            const players = Number(row?.total_players);
            const bucket = row?.bucket ? new Date(row.bucket).toLocaleDateString() : "Unknown date";
            return '<div class="metric"><span>' + esc(bucket) + '</span><strong>' +
              (Number.isFinite(matches) ? matches.toLocaleString() + " matches" : "—") +
              '</strong><small>' + (Number.isFinite(players) ? players.toLocaleString() + " players" : "Player count unavailable") + '</small></div>';
          }).join("")
        : '<p class="muted">No daily game statistics returned.</p>';
    }
  }).catch(error => {
    if (isAborted(error)) return;
    const status = $("#dashboard-activity-status");
    const panel = $("#dashboard-activity");
    if (status) status.textContent = "UNAVAILABLE";
    if (panel) panel.innerHTML = '<p class="muted">Game activity unavailable.</p>';
    console.error("Deadlock API dashboard activity request failed", error);
  });

  dashboardRuntime.getDashboardPatchSnapshot(options).then(patchResult => {
    if (signal.aborted) return;
    const patch = patchResult?.latestMajorPatch;
    const patchCopy = $("#dashboard-patch-copy");
    if (patchCopy) {
      if (!patch) {
        patchCopy.innerHTML = '<span class="eyebrow">LATEST MAJOR UPDATE</span><h2>Major update unavailable.</h2><p>The current patch feed did not return a major update.</p>';
      } else {
        const title = esc(patch.title ?? "Latest update");
        const rawContent = String(patch.content ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const excerpt = esc(rawContent.slice(0, 280) + (rawContent.length > 280 ? "…" : ""));
        const date = patch.pub_date ? new Date(patch.pub_date).toLocaleDateString() : "";
        patchCopy.innerHTML = '<span class="eyebrow">LATEST MAJOR UPDATE / ' + esc(patch.source?.toUpperCase() ?? "PATCH FEED") + '</span><h2>' + title + '</h2><p>' + (excerpt || "The latest update is live in the official patch feed.") + '</p>' + (date ? '<small class="dashboard-patch-date">' + esc(date) + '</small>' : "");
      }
    }
  }).catch(error => {
    if (isAborted(error)) return;
    const patchElement = $("#latest-patch");
    if (patchElement) patchElement.textContent = "Patch feed unavailable.";
    console.error("Deadlock API patch feed request failed", error);
  });
}


export function getAssetVersion() {
  return assetVersion;
}

export function refreshVersionControlOptions() {
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

export function bindVersionControl(onChange) {
  const select = $("#client-version");
  if (!select || select.dataset.bound === "true") return;
  select.dataset.bound = "true";
  select.addEventListener("change", async event => {
    assetVersion.set(event.target.value);
    await applyAssetColors();
    onChange?.();
  });
}

export function loadDashboardVersionContext(onChanged) {
  const initial = assetVersion.get();
  loadAssetVersionContext().then(() => {
    refreshVersionControlOptions();
    if (assetVersion.get() !== initial) onChanged?.();
  }).catch(() => {});
}

export { assetVersion };
