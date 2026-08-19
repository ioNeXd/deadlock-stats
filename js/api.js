// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

import { CONSTANTS } from "./constants.js";

const API_BASE = "https://api.deadlock-api.com/v1";

const CDN_BASE = "https://assets-bucket.deadlock-api.com/assets-api-res";
const CDN_ICONS = `${CDN_BASE}/icons`;

const _cache = new Map();
const DEFAULT_CACHE_TTL = CONSTANTS.API_CACHE_TTL_MS; // 30s

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Converts an asset URL returned by the API into a local project URL when it
 * points to a stat icon SVG, otherwise leaves the original CDN URL unchanged.
 * This directly influences which image resources the UI loads – local SVGs for
 * styling icons or remote CDN assets for larger images.
 *
 * @param {string} url - The original asset URL from the API.
 * @returns {string} The final URL to be used by the UI.
 */
export function localAssetUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith(`${CDN_ICONS}/`)) {
    return `assets/icons/stats/${url.slice(CDN_ICONS.length + 1)}`;
  }
  return url;
}

/**
 * Resolves the best available image URL for an entity, applying a single
 * fallback chain shared by the table and build-item rendering.
 *
 * @param {object} entity - The entity (may expose .raw / .images).
 * @param {string} [fallback=""] - URL returned when nothing is found.
 * @returns {string} The resolved image URL.
 */
export function resolveEntityImage(entity, fallback = "") {
  if (!entity) return fallback;
  const imgs = entity.images || (entity.raw && entity.raw.images) || {};
  const raw = entity.raw || {};
  return localAssetUrl(
    raw.shop_image_webp ||
      raw.shop_image ||
      imgs.icon_image_small ||
      imgs.icon ||
      imgs.icon_image ||
      entity.shop_image ||
      entity.icon_image_small ||
      entity.shop_image_small ||
      raw.icon_image_small ||
      raw.shop_image_small ||
      fallback,
  );
}

/**
 * Coerces an API response into an array, handling the common wrapper
 * shapes (plain array, { value: [...] }, { data: [...] }).
 *
 * @param {*} raw - The raw API response.
 * @returns {Array} The extracted array (empty when none found).
 */
export function extractList(raw) {
  return Array.isArray(raw)
    ? raw
    : Array.isArray(raw && raw.value)
      ? raw.value
      : Array.isArray(raw && raw.data)
        ? raw.data
        : [];
}

/**
 * Fetches JSON from the Deadlock API with retry logic and a local read-through
 * cache for GET requests. Supports external AbortSignal and exponential backoff.
 *
 * @param {string} url - The endpoint URL.
 * @param {object} options - Fetch options (method, headers, etc.).
 * @param {number} timeout - Request timeout in milliseconds.
 * @param {number} retries - Maximum number of retry attempts.
 * @param {number} cacheTtl - Cache time-to-live in milliseconds.
 * @returns {Promise<object>} The parsed JSON response.
 */
async function fetchJson(
  url,
  options = {},
  timeout = CONSTANTS.API_TIMEOUT_MS,
  retries = CONSTANTS.API_RETRIES,
  cacheTtl = DEFAULT_CACHE_TTL,
) {
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? url : null;

  if (cacheKey) {
    const entry = _cache.get(cacheKey);
    if (entry) {
      if (Date.now() - entry.ts < cacheTtl) {
        return entry.data;
      }
      _cache.delete(cacheKey);
    }
  }

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
        throw new Error(
          `Request failed: ${res.status} ${res.statusText} ${text}`,
        );
      }
      const json = await res.json();

      if (cacheKey) {
        try {
          _cache.set(cacheKey, { ts: Date.now(), data: json });
          // Keep the cache bounded: evict the oldest entry when over the limit.
          while (_cache.size > CONSTANTS.API_CACHE_MAX_ENTRIES) {
            const oldestKey = _cache.keys().next().value;
            if (oldestKey === undefined) break;
            _cache.delete(oldestKey);
          }
        } catch (e) {
          /* ignore cache errors */
        }
      }

      return json;
    } catch (err) {
      if (id) clearTimeout(id);
      lastErr = err;
      if (externalSignal && externalSignal.aborted) break;
      if (attempt > retries) break;
      const backoff = 200 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw lastErr;
}

/**
 * Validates that a given value is an array and throws a descriptive error if not.
 *
 * @param {*} value - The value to check.
 * @param {string} name - A descriptive name for the array (used in error message).
 * @returns {Array} The original array if validation passes.
 * @throws {Error} When the value is not an array.
 */
function validateArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} expected to be an array`);
  }
  return value;
}

// =============================================================================
// ERROR-HANDLING CONVENTION
// Functions that back a required page state (a table that must show something,
// e.g. getGameStats) rethrow on failure so callers can show an error banner.
// Functions that back optional/secondary data (entity metadata, ability
// details, favorites fallback) swallow the error, log a console.warn, and
// return an empty {} / [] so the UI can still render with partial data.
// =============================================================================

// =============================================================================
// NORMALIZATION UTILITIES
// =============================================================================

/**
 * Normalizes raw hero stats into a predictable array with wins and matches counts.
 *
 * @param {Array} rawStats - Raw hero stats from the API.
 * @returns {Array<{hero_id: *, wins: number, matches: number}>} Normalized list.
 */
function normalizeHeroStats(rawStats) {
  const stats = validateArray(rawStats, "heroStats");
  return stats.map((s) => ({
    hero_id: s.hero_id ?? s.id ?? null,
    wins: Number(s.wins) || 0,
    matches: Number(s.matches) || 0,
  }));
}

/**
 * Normalizes raw item stats into a consistent shape with id, wins, and matches.
 *
 * @param {Array} rawStats - Raw item stats from the API.
 * @returns {Array<{item_id: *, wins: number, matches: number}>} Normalized list.
 */
function normalizeItemStats(rawStats) {
  const stats = validateArray(rawStats, "itemStats");
  return stats.map((s) => ({
    item_id: s.item_id ?? s.id ?? null,
    wins: Number(s.wins) || 0,
    matches: Number(s.matches) || 0,
  }));
}

/**
 * Builds a map of entities keyed by ID, normalizing image URLs via localAssetUrl
 * and standardizing metadata.
 *
 * @param {Array} rawEntities - Raw entity list from the API.
 * @param {string} type - Entity type label (e.g., "hero", "item").
 * @returns {Object.<string|number, {id: *, name: string, images: object, shop_image: string, raw: object}>}
 */
function normalizeEntitiesById(rawEntities, type = "entity") {
  const entities = validateArray(rawEntities, `${type}s`);
  const map = {};
  for (const e of entities) {
    if (!e || e.id == null) continue;
    const rawImages = e.images || {};
    const images = {};
    for (const k of Object.keys(rawImages)) {
      images[k] = localAssetUrl(rawImages[k]);
    }
    map[e.id] = {
      id: e.id,
      name: e.name || e.display_name || `Unknown ${type}`,
      images,
      shop_image: localAssetUrl(e.shop_image || ""),
      raw: e,
    };
  }
  return map;
}

/**
 * Normalizes a raw build payload into a consistent structure with categories,
 * skill changes, and metadata.
 *
 * @param {object} rawBuild - Raw build object from the API.
 * @returns {object|null} Normalized build payload or null if invalid.
 */
export function normalizeBuildPayload(rawBuild) {
  if (!rawBuild || typeof rawBuild !== "object") return null;

  const candidate = rawBuild.hero_build || rawBuild.build || rawBuild;
  if (!candidate || typeof candidate !== "object") return null;

  const details = candidate.details || rawBuild.details || {};
  const modCategories = Array.isArray(details.mod_categories)
    ? details.mod_categories
    : Array.isArray(rawBuild.mod_categories)
      ? rawBuild.mod_categories
      : [];

  const skillChanges =
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
      ? details.ability_order.currency_changes
      : Array.isArray(
            rawBuild.ability_order && rawBuild.ability_order.currency_changes,
          )
        ? rawBuild.ability_order.currency_changes
        : [];

  return {
    hero_build: candidate,
    hero_build_id:
      candidate.hero_build_id ?? rawBuild.hero_build_id ?? rawBuild.id ?? null,
    name: candidate.name || rawBuild.name || "",
    version: candidate.version ?? rawBuild.version ?? null,
    tags: Array.isArray(candidate.tags)
      ? candidate.tags
      : Array.isArray(rawBuild.tags)
        ? rawBuild.tags
        : [],
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

/**
 * Normalizes raw hero build stats, computing win rate and standardizing fields.
 *
 * @param {Array} rawStats - Raw build stats from the API.
 * @returns {Array<{buildId: *, matches: number, wins: number, winRate: number, raw: object}>}
 */
export function normalizeHeroBuildStats(rawStats) {
  if (!rawStats || !Array.isArray(rawStats)) {
    return [];
  }

  const stats = validateArray(rawStats, "heroBuildStats");
  return stats.map((s) => {
    const matches = Number(s.matches) || 0;
    const wins = Number(s.wins) || 0;
    return {
      buildId: s.hero_build_id ?? s.build_id ?? s.id ?? null,
      name: s.name || null,
      matches,
      wins,
      winRate: matches > 0 ? (wins / matches) * 100 : 0,
      raw: s,
    };
  });
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetches the most recent match timestamp and returns it as a Date.
 *
 * @param {object} opts - Fetch options (e.g., signal).
 * @returns {Promise<Date>} The latest update time, or epoch if request fails.
 */
export async function getLastUpdated(opts = {}) {
  const url = `${API_BASE}/matches/recently-fetched`;
  try {
    const matches = await fetchJson(url, opts).catch((e) => {
      throw e;
    });
    if (!Array.isArray(matches) || matches.length === 0) return new Date(0);
    const latestTimestamp = Number(matches[0]?.start_time) || 0;
    return new Date(latestTimestamp * 1000);
  } catch (err) {
    console.warn("getLastUpdated failed:", err);
    return new Date(0);
  }
}

/**
 * Retrieves hero analytics stats and normalizes them.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Array>} Normalized hero stats list.
 */
export async function getHeroStats(opts = {}) {
  const url = `${API_BASE}/analytics/hero-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeHeroStats(raw);
  } catch (err) {
    console.warn("getHeroStats failed:", err);
    return [];
  }
}

/**
 * Fetches hero asset metadata and returns a map keyed by hero ID.
 * Assets change rarely, so a longer cache TTL is used.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Object>} Map of hero entities.
 */
export async function getHeroesById(opts = {}) {
  const url = `${API_BASE}/assets/heroes`;
  try {
    const raw = await fetchJson(
      url,
      opts,
      CONSTANTS.API_TIMEOUT_MS,
      CONSTANTS.API_RETRIES,
      CONSTANTS.API_ASSETS_CACHE_TTL_MS,
    );
    return normalizeEntitiesById(raw, "hero");
  } catch (err) {
    console.warn("getHeroesById failed:", err);
    return {};
  }
}

/**
 * Retrieves item analytics stats and normalizes them.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Array>} Normalized item stats list.
 */
export async function getItemStats(opts = {}) {
  const url = `${API_BASE}/analytics/item-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeItemStats(raw);
  } catch (err) {
    console.warn("getItemStats failed:", err);
    return [];
  }
}

/**
 * Fetches item asset metadata and returns a map keyed by item ID.
 * Assets change rarely, so a longer cache TTL is used.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Object>} Map of item entities.
 */
export async function getItemsById(opts = {}) {
  const url = `${API_BASE}/assets/items`;
  try {
    const raw = await fetchJson(
      url,
      opts,
      CONSTANTS.API_TIMEOUT_MS,
      CONSTANTS.API_RETRIES,
      CONSTANTS.API_ASSETS_CACHE_TTL_MS,
    );
    return normalizeEntitiesById(raw, "item");
  } catch (err) {
    console.warn("getItemsById failed:", err);
    return {};
  }
}

/**
 * Fetches global game stats from the analytics endpoint.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Array>} Array of game stats objects.
 */
export async function getGameStats(opts = {}) {
  const url = `${API_BASE}/analytics/game-stats`;
  try {
    const raw = await fetchJson(url, opts);
    const arr = extractList(raw);
    return arr;
  } catch (err) {
    console.warn("getGameStats failed:", err);
    throw err;
  }
}

// =============================================================================
// ABILITY HELPERS
// =============================================================================

const ABILITY_STAT_PRIORITY = [
  "cooldown",
  "tech_damage",
  "bullet_damage",
  "damage",
  "range",
  "duration",
  "slow",
  "cast",
  "healing",
  "move_speed",
  "charge_cooldown",
];

/**
 * Strips embedded SVGs, panels, and HTML tags from an ability description,
 * returning clean plain text for tooltips.
 *
 * @param {string} html - Raw HTML description from the API.
 * @returns {string} Sanitized plain text.
 */
export function sanitizeAbilityDescription(html) {
  if (!html) return "";
  let text = String(html);
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<Panel[\s\S]*?<\/Panel>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text;
}

/**
 * Extracts and sorts ability property stats (cooldown, damage, range, etc.)
 * from the raw properties object, filtering empty values and assigning display
 * priority based on cssClass.
 *
 * @param {object} properties - Raw ability properties from the API.
 * @returns {Array<{key: string, label: string, value: string, icon: string, cssClass: string, priority: number}>}
 */
export function extractAbilityStats(properties) {
  if (!properties || typeof properties !== "object") return [];
  const stats = [];
  for (const key of Object.keys(properties)) {
    const p = properties[key] || {};
    const label = String(p.label || "").trim();
    const rawValue = String(p.value ?? "").trim();
    if (!label || label === "None" || rawValue === "" || rawValue === "0") {
      continue;
    }
    const postfix = String(p.postfix || "").trim();
    const value =
      postfix && !rawValue.endsWith(postfix)
        ? `${rawValue}${postfix}`
        : rawValue;
    const cssClass = String(p.css_class || "").toLowerCase();
    const priority = ABILITY_STAT_PRIORITY.indexOf(cssClass);
    stats.push({
      key,
      label,
      value,
      icon: localAssetUrl(p.icon || ""),
      cssClass,
      priority: priority === -1 ? 99 : priority,
    });
  }
  stats.sort(
    (a, b) => a.priority - b.priority || a.label.localeCompare(b.label),
  );
  return stats;
}

/**
 * Fetches ability data by class name, normalizes descriptions and stats,
 * and returns a map keyed by ability class name.
 *
 * @param {object} opts - Fetch options.
 * @returns {Promise<Object>} Map of ability metadata.
 */
export async function getAbilitiesByClass(opts = {}) {
  const url = `${API_BASE}/assets/items/by-type/ability`;
  try {
    const raw = await fetchJson(
      url,
      opts,
      CONSTANTS.API_TIMEOUT_MS,
      CONSTANTS.API_RETRIES,
      CONSTANTS.API_ASSETS_CACHE_TTL_MS,
    );
    const list = extractList(raw);
    const byClass = {};
    for (const item of list) {
      if (item && item.class_name && item.id != null) {
        const descObj = item.description;
        byClass[item.class_name] = {
          id: item.id,
          name: item.name || item.class_name,
          image: localAssetUrl(item.image_webp || item.image || ""),
          description: sanitizeAbilityDescription(
            descObj && typeof descObj === "object" ? descObj.desc : descObj,
          ),
          stats: extractAbilityStats(item.properties),
        };
      }
    }
    return byClass;
  } catch (err) {
    console.warn("getAbilitiesByClass failed:", err);
    return {};
  }
}

// =============================================================================
// BUILD-SPECIFIC API FUNCTIONS
// =============================================================================

/**
 * Fetches hero build analytics for a given hero ID, falling back to favorite
 * builds if the analytics endpoint returns no data or fails.
 *
 * @param {string|number} heroId - The hero ID.
 * @param {number} minMatches - Minimum matches required for a build to be considered.
 * @param {object} opts - Fetch options.
 * @returns {Promise<Array>} List of build stats.
 */
export async function getHeroBuildStats(heroId, minMatches = 1, opts = {}) {
  const url = `${API_BASE}/analytics/hero-build-stats/${heroId}?min_matches=${minMatches}`;

  try {
    const raw = await fetchJson(url, opts);
    const stats = normalizeHeroBuildStats(raw);
    if (stats.length > 0) return stats;
    return getBuildsByFavorites(heroId, CONSTANTS.MAX_BUILDS_PER_LIST, opts);
  } catch (err) {
    console.warn(
      `No build data available for hero ${heroId}, trying favorites:`,
      err,
    );
    return getBuildsByFavorites(heroId, CONSTANTS.MAX_BUILDS_PER_LIST, opts);
  }
}

/**
 * Fallback when analytical build stats are unavailable: fetches the most
 * favorited builds for a hero.
 *
 * @param {string|number} heroId - The hero ID.
 * @param {number} limit - Maximum number of builds to return.
 * @param {object} opts - Fetch options.
 * @returns {Promise<Array>} List of build objects with a `fromFallback` flag.
 */
export async function getBuildsByFavorites(heroId, limit = 3, opts = {}) {
  const params = new URLSearchParams({
    hero_id: String(heroId),
    sort_by: "favorites",
    sort_direction: "desc",
    only_latest: "true",
    limit: String(limit),
  });
  const url = `${API_BASE}/builds?${params.toString()}`;

  try {
    const raw = await fetchJson(url, opts);
    const list = extractList(raw);

    return list
      .map((entry) => {
        const payload = normalizeBuildPayload(entry);
        if (!payload) return null;
        return {
          buildId: payload.hero_build_id ?? payload.id ?? null,
          name: payload.name || null,
          matches: null,
          wins: null,
          winRate: null,
          fromFallback: true,
          publishedBuild: payload,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn(`No favorite builds available for hero ${heroId}:`, err);
    return [];
  }
}

/**
 * Fetches a specific build by its ID and hero ID, returning the normalized payload.
 *
 * @param {string|number} buildId - The build ID.
 * @param {string|number} heroId - The hero ID.
 * @param {object} opts - Fetch options.
 * @returns {Promise<object|null>} Normalized build payload or null if not found.
 */
export async function getBuildById(buildId, heroId, opts = {}) {
  if (buildId == null) return null;

  const params = new URLSearchParams({
    build_id: String(buildId),
    hero_id: String(heroId),
    only_latest: "true",
    limit: "1",
  });
  const url = `${API_BASE}/builds?${params.toString()}`;

  try {
    const raw = await fetchJson(url, opts);
    const list = extractList(raw);

    return list.length > 0 ? normalizeBuildPayload(list[0]) : null;
  } catch (err) {
    console.warn(
      `No build content available for build ${buildId} (hero ${heroId}):`,
      err,
    );
    return null;
  }
}
