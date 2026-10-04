import {
  createCustomMatch,
  leaveCustomMatch,
  readyCustomMatch,
  startCustomMatch,
  unreadyCustomMatch,
  getCustomMatchId,
  getLiveQuery,
  submitDemoQuery,
  getDemoQueryStatus,
  getDemoSchema,
  getLiveUrls,
  ingestLiveUrls,
} from "../api/matches.js";

const CUSTOM_GAME_MODES = ["normal", "street_brawl", "explore_n_y_c", "internal"];
const CUSTOM_SERVER_REGIONS = ["europe", "eu_amsterdam", "eu_poland", "eu_stockholm", "eu_helsinki", "eu_falkenstein", "eu_spain", "eu_east", "eu_london", "south_africa", "us_west", "us_east", "us_north_central", "us_south_central", "us_south_east", "us_south_west", "australia", "singapore", "japan", "hong_kong", "mp_hong_kong", "seoul", "chile", "peru", "argentina", "south_america"];

export function normalizeDemoStatus(result) {
  const data = result?.data && typeof result.data === "object" ? result.data : result;
  return {
    jobId: data?.job_id ?? null,
    status: data?.status ?? null,
    matchId: data?.match_id ?? null,
    format: data?.format ?? null,
    estimatedWaitSeconds: data?.estimated_wait_seconds ?? null,
    resultUrl: data?.result_url ?? null,
    error: data?.error ?? null,
    raw: data,
  };
}

export function normalizeLiveUrls(result) {
  const data = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
  return data.map(row => ({
    matchId: row?.match_id ?? null,
    lobbyId: row?.lobby_id ?? null,
    broadcastUrl: row?.broadcast_url ?? null,
    startedAt: row?.started_at ?? null,
    updatedAt: row?.updated_at ?? null,
    raw: row,
  }));
}

export function normalizeDemoSchema(result) {
  const data = result?.data && typeof result.data === "object" ? result.data : result;
  const tables = Array.isArray(data?.tables) ? data.tables : [];
  return {
    matchId: data?.match_id ?? null,
    demoUrl: data?.demo_url ?? null,
    tables: tables.map(table => ({
      name: table?.name ?? table?.table_name ?? null,
      columns: Array.isArray(table?.columns) ? table.columns.map(column => ({
        name: column?.name ?? null,
        arrowType: column?.arrow_type ?? column?.data_type ?? column?.type ?? null,
        nullable: column?.nullable ?? null,
        raw: column,
      })) : [],
      raw: table,
    })),
    raw: data,
  };
}

export function buildDemoQueryBody({ matchId, query, format } = {}) {
  const id = Number(matchId);
  if (!Number.isInteger(id) || id < 0) throw new RangeError("matchId must be a non-negative integer");
  if (typeof query !== "string" || !query.trim()) throw new TypeError("query must be a non-empty string");
  const body = { match_id: id, query: query.trim() };
  if (format) {
    if (!["parquet", "ndjson"].includes(format)) throw new RangeError("format must be parquet or ndjson");
    body.format = format;
  }
  return body;
}

export function buildCustomMatchBody(values = {}) {
  const body = {};
  const allowedKeys = new Set([
    "callback_url",
    "cheats_enabled",
    "corrupted_item_shop_spawn_minutes",
    "disable_auto_ready",
    "duplicate_heroes_enabled",
    "game_mode",
    "is_publicly_visible",
    "min_roster_size",
    "randomize_lanes",
    "server_region",
  ]);
  for (const [key, rawValue] of Object.entries(values)) {
    if (!allowedKeys.has(key) || rawValue === undefined || rawValue === null || rawValue === "") continue;
    if (["cheats_enabled", "disable_auto_ready", "duplicate_heroes_enabled", "is_publicly_visible", "randomize_lanes"].includes(key)) {
      if (typeof rawValue !== "boolean") throw new TypeError(key + " must be a boolean");
      body[key] = rawValue;
      continue;
    }
    if (key === "game_mode") {
      if (!CUSTOM_GAME_MODES.includes(rawValue)) throw new RangeError("game_mode must be a supported GameMode");
      body[key] = rawValue;
      continue;
    }
    if (key === "server_region") {
      if (!CUSTOM_SERVER_REGIONS.includes(rawValue)) throw new RangeError("server_region must be a supported ServerRegion");
      body[key] = rawValue;
      continue;
    }
    if (key === "min_roster_size" || key === "corrupted_item_shop_spawn_minutes") {
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value < 0) throw new RangeError(key + " must be a non-negative integer");
      body[key] = value;
      continue;
    }
    if (key === "callback_url") {
      if (typeof rawValue !== "string") throw new TypeError("callback_url must be a string");
      body[key] = rawValue.trim();
    }
  }
  return body;
}

export async function loadDemoSchema(matchId, options = {}) {
  return getDemoSchema(matchId === "" ? undefined : matchId, options);
}

export async function submitDemoQueryFromForm(values, options = {}) {
  return submitDemoQuery(buildDemoQueryBody(values), options);
}

export function getDemoQueryStatusSnapshot(jobId, options = {}) {
  return getDemoQueryStatus(jobId, options);
}

export function loadLiveUrls(options = {}) {
  return getLiveUrls(options);
}

export function ingestLiveUrlsFromForm(values, options = {}) {
  const rows = Array.isArray(values) ? values : [values];
  return ingestLiveUrls(rows, options);
}

export function buildLiveQueryOptions({ query, matchId, broadcastUrl } = {}, options = {}) {
  if (typeof query !== "string" || !query.trim()) throw new TypeError("query must be a non-empty string");
  const normalizedMatchId = matchId === undefined || matchId === null || matchId === "" ? undefined : Number(matchId);
  if (normalizedMatchId !== undefined && (!Number.isInteger(normalizedMatchId) || normalizedMatchId < 0)) {
    throw new RangeError("matchId must be a non-negative integer");
  }
  const normalizedBroadcastUrl = typeof broadcastUrl === "string" && broadcastUrl.trim() ? broadcastUrl.trim() : undefined;
  if (normalizedMatchId === undefined && !normalizedBroadcastUrl) {
    throw new TypeError("matchId or broadcastUrl is required");
  }
  return {
    ...options,
    query: query.trim(),
    match_id: normalizedMatchId,
    broadcast_url: normalizedBroadcastUrl,
  };
}

export function runLiveQuery(values = {}, options = {}) {
  return getLiveQuery(buildLiveQueryOptions(values, options));
}

export function parseSseEventBlock(block = "") {
  const event = { type: "message", data: "", id: null, retry: null };
  const dataLines = [];
  for (const rawLine of String(block).replace(/\r/g, "").split("\n")) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event.type = value || "message";
    else if (field === "data") dataLines.push(value);
    else if (field === "id") event.id = value;
    else if (field === "retry" && /^\d+$/.test(value)) event.retry = Number(value);
  }
  event.data = dataLines.join("\n");
  return event;
}

export function createCustomMatchFromForm(values, options = {}) {
  return createCustomMatch(buildCustomMatchBody(values), options);
}

export function customMatchAction(action, lobbyId, options = {}) {
  const actions = { leave: leaveCustomMatch, ready: readyCustomMatch, start: startCustomMatch, unready: unreadyCustomMatch };
  const loader = actions[action];
  if (!loader) throw new RangeError("Unsupported custom match action");
  return loader(lobbyId, options);
}

export function loadCustomMatchId(partyId, options = {}) {
  return getCustomMatchId(partyId, options);
}
