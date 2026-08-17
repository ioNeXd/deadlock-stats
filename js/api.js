const API_BASE = "https://api.deadlock-api.com/v1";

// ---------------------------------------------------------------------------
// Assets locais: apenas SVGs (ícones de stats e HUD) ficam baixados no
// projeto. As demais imagens (heróis, habilidades, itens — PNG/WebP) são
// servidas diretamente pelo CDN da API (assets-bucket.deadlock-api.com),
// que é quem entrega esses arquivos. Este mapeador converte só os SVGs de
// /icons/*.svg para os arquivos locais; o resto mantém a URL original do CDN.
// ---------------------------------------------------------------------------
const CDN_BASE = "https://assets-bucket.deadlock-api.com/assets-api-res";
const CDN_ICONS = `${CDN_BASE}/icons`;

// Converte URL do CDN de assets para o caminho local baixado no projeto.
// Apenas SVGs de stats têm versão local; tudo mais (PNG/WebP) vem do CDN.
function localAssetUrl(url) {
  if (!url || typeof url !== "string") return url;
  // Ícones de stats em /icons/*.svg -> assets/icons/stats/*.svg (locais).
  if (url.startsWith(`${CDN_ICONS}/`)) {
    return `assets/icons/stats/${url.slice(CDN_ICONS.length + 1)}`;
  }
  // Demais imagens (heróis, habilidades, itens, upgrades, npcs) ficam no
  // CDN — a API entrega: https://assets-bucket.deadlock-api.com/...
  return url;
}

// Simple in-memory cache: URL -> { ts, data }
const _cache = new Map();
const DEFAULT_CACHE_TTL = CONSTANTS.API_CACHE_TTL_MS; // 30s

async function fetchJson(
  url,
  options = {},
  timeout = CONSTANTS.API_TIMEOUT_MS,
  retries = CONSTANTS.API_RETRIES,
  cacheTtl = DEFAULT_CACHE_TTL,
) {
  // Read-through cache for GET requests without cache-busting
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? url : null;

  if (cacheKey) {
    const entry = _cache.get(cacheKey);
    if (entry && Date.now() - entry.ts < cacheTtl) {
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
        throw new Error(
          `Request failed: ${res.status} ${res.statusText} ${text}`,
        );
      }
      const json = await res.json();

      if (cacheKey) {
        try {
          _cache.set(cacheKey, { ts: Date.now(), data: json });
        } catch (e) {
          /* ignore cache errors */
        }
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

// Updated request: last updated
async function getLastUpdated(opts = {}) {
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

// Heroes requests (return normalized shapes)
async function getHeroStats(opts = {}) {
  const url = `${API_BASE}/analytics/hero-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeHeroStats(raw);
  } catch (err) {
    console.warn("getHeroStats failed:", err);
    return [];
  }
}

async function getHeroesById(opts = {}) {
  const url = `${API_BASE}/assets/heroes`;
  try {
    // Assets mudam raramente — TTL mais longo que os analytics.
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

// Items requests
async function getItemStats(opts = {}) {
  const url = `${API_BASE}/analytics/item-stats`;
  try {
    const raw = await fetchJson(url, opts);
    return normalizeItemStats(raw);
  } catch (err) {
    console.warn("getItemStats failed:", err);
    return [];
  }
}

async function getItemsById(opts = {}) {
  const url = `${API_BASE}/assets/items`;
  try {
    // Assets mudam raramente — TTL mais longo que os analytics.
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

// Converte a descrição HTML da habilidade (com SVGs/Panels embutidos) em
// texto puro legível, preservando quebras de linha do <br>.
function sanitizeAbilityDescription(html) {
  if (!html) return "";
  let text = String(html);
  // Remove blocos SVG e Panel inteiros (ícones/dados de dano embutidos).
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<Panel[\s\S]*?<\/Panel>/gi, "");
  // Quebras de linha dos blocos HTML.
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n");
  // Remove as tags restantes, mantendo o texto.
  text = text.replace(/<[^>]+>/g, "");
  // Limpa espaços duplicados e quebras consecutivas.
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return text;
}

// Ordem de exibição das propriedades no tooltip (cooldown, dano, alcance...).
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

// Extrai as propriedades úteis da habilidade (label + valor + postfix),
// ignorando valores zerados e sem label.
function extractAbilityStats(properties) {
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
    // Evita duplicar o postfix quando o valor já o inclui (ex.: "20m" + "m").
    const value = postfix && !rawValue.endsWith(postfix) ? `${rawValue}${postfix}` : rawValue;
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
  stats.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
  return stats;
}

// Habilidades dos heróis (itens do tipo "ability"): class_name ->
// { id, name, image, description, stats }.
// Usado para mapear os ability_id do build para o slot (1-4) do herói,
// cruzando com items.signature1..4 do asset do herói, e para o tooltip
// com descrição e propriedades (cooldown, dano, alcance...).
async function getAbilitiesByClass(opts = {}) {
  const url = `${API_BASE}/assets/items/by-type/ability`;
  try {
    const raw = await fetchJson(
      url,
      opts,
      CONSTANTS.API_TIMEOUT_MS,
      CONSTANTS.API_RETRIES,
      CONSTANTS.API_ASSETS_CACHE_TTL_MS,
    );
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw && raw.data)
        ? raw.data
        : [];
    const byClass = {};
    for (const item of list) {
      if (item && item.class_name && item.id != null) {
        const descObj = item.description;
        byClass[item.class_name] = {
          id: item.id,
          name: item.name || item.class_name,
          // Ícone da habilidade (WebP mais leve; fallback PNG).
          // Baixados para assets/images/abilities/.
          image: localAssetUrl(item.image_webp || item.image || ""),
          // Descrição em texto puro (a API devolve HTML com SVGs embutidos).
          description: sanitizeAbilityDescription(
            descObj && typeof descObj === "object" ? descObj.desc : descObj,
          ),
          // Propriedades úteis (cooldown, dano, alcance...) para o tooltip.
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

// Game stats request
async function getGameStats(opts = {}) {
  const url = `${API_BASE}/analytics/game-stats`;
  try {
    const raw = await fetchJson(url, opts);
    const arr = Array.isArray(raw) ? raw : [];
    return arr;
  } catch (err) {
    console.warn("getGameStats failed:", err);
    return [{ total_matches: 0 }];
  }
}

async function getHeroBuildStats(heroId, minMatches = 1, opts = {}) {
  const url = `${API_BASE}/analytics/hero-build-stats/${heroId}?min_matches=${minMatches}`;

  try {
    const raw = await fetchJson(url, opts);
    const stats = normalizeHeroBuildStats(raw);
    if (stats.length > 0) return stats;
    // Stats vazios (ou endpoint fora do ar): cai para o fallback por favoritos.
    return getBuildsByFavorites(heroId, CONSTANTS.MAX_BUILDS_PER_LIST, opts);
  } catch (err) {
    console.warn(
      `No build data available for hero ${heroId}, trying favorites:`,
      err,
    );
    return getBuildsByFavorites(heroId, CONSTANTS.MAX_BUILDS_PER_LIST, opts);
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

// Fallback quando os stats analíticos de builds do herói não estão
// disponíveis (ex.: erro no servidor): busca as builds mais favoritadas de
// todos os tempos. Sem matches/wins — os cards sinalizam a origem.
async function getBuildsByFavorites(heroId, limit = 3, opts = {}) {
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
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw && raw.value)
        ? raw.value
        : Array.isArray(raw && raw.data)
          ? raw.data
          : [];

    return list
      .map((entry) => {
        const payload = normalizeBuildPayload(entry);
        if (!payload) return null;
        return {
          buildId: payload.hero_build_id ?? payload.id ?? null,
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
async function getBuildById(buildId, heroId, opts = {}) {
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
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw && raw.value)
        ? raw.value
        : Array.isArray(raw && raw.data)
          ? raw.data
          : [];

    return list.length > 0 ? normalizeBuildPayload(list[0]) : null;
  } catch (err) {
    console.warn(
      `No build content available for build ${buildId} (hero ${heroId}):`,
      err,
    );
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
