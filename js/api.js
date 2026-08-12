const API_BASE = "https://api.deadlock-api.com/v1";

async function fetchJson(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(id);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Request failed: ${res.status} ${res.statusText} ${text}`,
      );
    }
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
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
async function getLastUpdated() {
  const url = `${API_BASE}/matches/recently-fetched`;
  const matches = await fetchJson(url);
  validateArray(matches, "recently-fetched");
  const latestTimestamp = Number(matches[0]?.start_time) || 0;
  const date = new Date(latestTimestamp * 1000);
  return date;
}

// Heroes requests (return normalized shapes)
async function getHeroStats() {
  const url = `${API_BASE}/analytics/hero-stats`;
  const raw = await fetchJson(url);
  return normalizeHeroStats(raw);
}

async function getHeroesById() {
  const url = `${API_BASE}/assets/heroes`;
  const raw = await fetchJson(url);
  return normalizeEntitiesById(raw, "hero");
}

// Items requests
async function getItemStats() {
  const url = `${API_BASE}/analytics/item-stats`;
  const raw = await fetchJson(url);
  return normalizeItemStats(raw);
}

async function getItemsById() {
  const url = `${API_BASE}/assets/items`;
  const raw = await fetchJson(url);
  return normalizeEntitiesById(raw, "item");
}

// Game stats request
async function getGameStats() {
  const url = `${API_BASE}/analytics/game-stats`;
  const raw = await fetchJson(url);
  const arr = validateArray(raw, "gameStats");
  return arr;
}

async function getHeroBuildStats(heroId, minMatches = 1) {
  const url = `${API_BASE}/analytics/hero-build-stats/${heroId}?min_matches=${minMatches}`;

  try {
    const raw = await fetchJson(url);
    return normalizeHeroBuildStats(raw);
  } catch (err) {
    console.warn(`No build data available for hero ${heroId}:`, err);
    return [];
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
