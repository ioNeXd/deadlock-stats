const API_BASE = "https://api.deadlock-api.com/v1";

// Simple in-memory cache: URL -> { ts, data }
const _cache = new Map();
const DEFAULT_CACHE_TTL = 30 * 1000; // 30s

async function fetchJson(url, options = {}, timeout = 10000, retries = 2, cacheTtl = DEFAULT_CACHE_TTL) {
  // Read-through cache for GET requests without cache-busting
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? url : null;

  if (cacheKey) {
    const entry = _cache.get(cacheKey);
    if (entry && (Date.now() - entry.ts) < cacheTtl) {
      return entry.data;
    }
  }

  // Support external AbortSignal passed via options.signal
  const externalSignal = options.signal;

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    attempt += 1;
    let controller = null;
    let id = null;
    let signal;

    if (externalSignal) {
      signal = externalSignal;
    } else {
      controller = new AbortController();
      signal = controller.signal;
      id = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const fetchOptions = { ...options, signal };
      const res = await fetch(url, fetchOptions);
      if (id) clearTimeout(id);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status} ${res.statusText} ${text}`);
      }
      const json = await res.json();

      if (cacheKey) {
        try { _cache.set(cacheKey, { ts: Date.now(), data: json }); } catch (e) { /* ignore cache errors */ }
      }

      return json;
    } catch (err) {
      if (id) clearTimeout(id);
      lastErr = err;
      // If aborted via external signal, stop retrying
      if (externalSignal && externalSignal.aborted) break;
      // If aborted or last attempt, break/throw after loop
      if (attempt > retries) break;
      // Exponential backoff before retrying
      const backoff = 200 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw lastErr;
}

// Utility: ensure value is an array
function validateArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} expected to be an array`);
  }
  return value;
}

// Normalize hero/item stat shapes to predictable objects
function normalizeHeroStats(rawStats) {
  const stats = validateArray(rawStats, "heroStats");
  return stats.map((s) => ({
    hero_id: s.hero_id ?? s.id ?? null,
    wins: Number(s.wins) || 0,
    matches: Number(s.matches) || 0,
  }));
}

function normalizeItemStats(rawStats) {
  const stats = validateArray(rawStats, "itemStats");
  return stats.map((s) => ({
    item_id: s.item_id ?? s.id ?? null,
    wins: Number(s.wins) || 0,
    matches: Number(s.matches) || 0,
  }));
}

function normalizeEntitiesById(rawEntities, type = "entity") {
  const entities = validateArray(rawEntities, `${type}s`);
  const map = {};
  for (const e of entities) {
    if (!e || e.id == null) continue;
    map[e.id] = {
      id: e.id,
      name: e.name || e.display_name || `Unknown ${type}`,
      images: e.images || {},
      shop_image: e.shop_image || "",
      raw: e,
    };
  }
  return map;
}

// Updated request: last updated
async function getLastUpdated(opts = {}) {
  const url = `${API_BASE}/matches/recently-fetched`;
  try {
    const matches = await fetchJson(url, opts).catch((e) => { throw e; });
    if (!Array.isArray(matches) || matches.length === 0) return new Date(0);
    const latestTimestamp = Number(matches[0]?.start_time) || 0;
    return new Date(latestTimestamp * 1000);
  } catch (err) {
    console.warn('getLastUpdated failed:', err);
    return new Date(0);
  }
}

// Heroes requests (return normalized shapes)
async function getHeroStats(opts = {}) {
  const url = `${API_BASE}/analytics/hero-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeHeroStats(raw);
  } catch (err) {
    console.warn('getHeroStats failed:', err);
    return [];
  }
}

async function getHeroesById(opts = {}) {
  const url = `${API_BASE}/assets/heroes`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeEntitiesById(raw, "hero");
  } catch (err) {
    console.warn('getHeroesById failed:', err);
    return {};
  }
}

// Items requests
async function getItemStats(opts = {}) {
  const url = `${API_BASE}/analytics/item-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeItemStats(raw);
  } catch (err) {
    console.warn('getItemStats failed:', err);
    return [];
  }
}

async function getItemsById(opts = {}) {
  const url = `${API_BASE}/assets/items`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeEntitiesById(raw, "item");
  } catch (err) {
    console.warn('getItemsById failed:', err);
    return {};
  }
}

// Game stats request
async function getGameStats(opts = {}) {
  const url = `${API_BASE}/analytics/game-stats`;
  try {
    const raw = await fetchJson(url, opts);
    const arr = Array.isArray(raw) ? raw : [];
    return arr;
  } catch (err) {
    console.warn('getGameStats failed:', err);
    return [{ total_matches: 0 }];
  }
}

async function getItemFlowStats(heroId, opts = {}) {
  const params = new URLSearchParams({
    hero_ids: String(heroId),
    phase_count: '4',
    phase_interval_s: '120',
    min_matches: '10',
  });
  const url = `${API_BASE}/analytics/item-flow-stats?${params.toString()}`;

  try {
    const raw = await fetchJson(url, opts);
    return raw && typeof raw === 'object' ? raw : { nodes: [], edges: [], summary: null };
  } catch (err) {
    console.warn(`No item flow data available for hero ${heroId}:`, err);
    return { nodes: [], edges: [], summary: null };
  }
}

async function getAbilityOrderStats(heroId, minMatches = 10, opts = {}) {
  const params = new URLSearchParams({
    hero_id: String(heroId),
    min_matches: String(minMatches),
  });
  const url = `${API_BASE}/analytics/ability-order-stats?${params.toString()}`;

  try {
    const raw = await fetchJson(url, opts);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn(`No ability order data available for hero ${heroId}:`, err);
    return [];
  }
}

async function getHeroBuildStats(heroId, minMatches = 1, opts = {}) {
  const url = `${API_BASE}/analytics/hero-build-stats/${heroId}?min_matches=${minMatches}`;

  try {
    const raw = await fetchJson(url, opts);
    return normalizeHeroBuildStats(raw);
  } catch (err) {
    console.warn(`No build data available for hero ${heroId}:`, err);
    return [];
  }
}

function normalizeBuildPayload(rawBuild) {
  if (!rawBuild || typeof rawBuild !== "object") return null;

  const candidate = rawBuild.hero_build || rawBuild.build || rawBuild;
  if (!candidate || typeof candidate !== "object") return null;

  const details = candidate.details || rawBuild.details || {};
  const modCategories = Array.isArray(details.mod_categories)
    ? details.mod_categories
    : Array.isArray(rawBuild.mod_categories)
      ? rawBuild.mod_categories
      : [];

  const skillChanges = details.ability_order && Array.isArray(details.ability_order.currency_changes)
    ? details.ability_order.currency_changes
    : Array.isArray(rawBuild.ability_order && rawBuild.ability_order.currency_changes)
      ? rawBuild.ability_order.currency_changes
      : [];

  return {
    hero_build: candidate,
    hero_build_id: candidate.hero_build_id ?? rawBuild.hero_build_id ?? rawBuild.id ?? null,
    name: candidate.name || rawBuild.name || "",
    version: candidate.version ?? rawBuild.version ?? null,
    tags: Array.isArray(candidate.tags) ? candidate.tags : Array.isArray(rawBuild.tags) ? rawBuild.tags : [],
    details: {
      mod_categories: modCategories,
      ability_order: {
        currency_changes: skillChanges,
      },
    },
    num_favorites: Number(rawBuild.num_favorites) || 0,
    num_ignores: Number(rawBuild.num_ignores) || 0,
    num_reports: Number(rawBuild.num_reports) || 0,
    raw: rawBuild,
  };
}

async function getMostPopularBuild(heroId, opts = {}) {
  const params = new URLSearchParams({
    hero_id: String(heroId),
    sort_by: "favorites",
    sort_direction: "desc",
    only_latest: "true",
    limit: "1",
  });
  const url = `${API_BASE}/builds?${params.toString()}`;

  try {
    const raw = await fetchJson(url, opts);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw && raw.value)
        ? raw.value
        : Array.isArray(raw && raw.data)
          ? raw.data
          : [];

    return list.length > 0 ? normalizeBuildPayload(list[0]) : null;
  } catch (err) {
    console.warn(`No published build available for hero ${heroId}:`, err);
    return null;
  }
}

function normalizeHeroBuildStats(rawStats) {
  if (!rawStats || !Array.isArray(rawStats)) {
    return [];
  }

  const stats = validateArray(rawStats, "heroBuildStats");
  return stats.map((s) => {
    const matches = Number(s.matches) || 0;
    const wins = Number(s.wins) || 0;
    return {
      buildId: s.hero_build_id ?? s.build_id ?? s.id ?? null,
      matches,
      wins,
      winRate: matches > 0 ? (wins / matches) * 100 : 0,
      raw: s,
    };
  });
}
