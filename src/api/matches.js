import { apiGet, apiRequest } from "./client.js";
import { queryToObject } from "./query.js";

const BULK_METADATA_KEYS = [
  "include_info","include_more_info","include_objectives","include_mid_boss","include_player_info",
  "include_player_kda","include_player_items","include_player_stats","include_player_final_stats",
  "include_player_death_details","game_mode","match_mode","match_ids","min_unix_timestamp",
  "max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge",
  "min_match_id","max_match_id","is_high_skill_range_parties","is_low_pri_pool","is_new_player_pool",
  "account_ids","only_filtered_players","hero_ids","item_filter_hero_id","include_item_ids",
  "exclude_item_ids","extra_match_columns","extra_player_columns","order_by","order_direction","limit","format"
];

function bulkMetadataOptions(options = {}) {
  const { query, ...rest } = options;
  const source = queryToObject(query);
  const topLevel = Object.fromEntries(Object.entries(rest).filter(([key]) => BULK_METADATA_KEYS.includes(key)));
  const merged = { ...source, ...topLevel };
  return {
    ...rest,
    query: Object.fromEntries(
      Object.entries(merged).filter(([key, value]) =>
        BULK_METADATA_KEYS.includes(key) && value !== undefined && value !== null
      ),
    ),
  };
}

function validateNumericId(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(name + " must be a non-negative integer");
  return value;
}

function matchPath(matchId, suffix = "") {
  return "/v1/matches/" + encodeURIComponent(validateNumericId(matchId, "matchId")) + suffix;
}

function lobbyPath(lobbyId, action) {
  return "/v1/matches/custom/" + encodeURIComponent(String(lobbyId)) + "/" + action;
}

function partyMatchPath(partyId) {
  return "/v1/matches/custom/" + encodeURIComponent(String(partyId)) + "/match-id";
}

export function getActiveMatches(options = {}) {
  return apiGet("/v1/matches/active", options);
}

export function getActiveMatchesRaw(options = {}) {
  return apiGet("/v1/matches/active/raw", { ...options, responseType: "arrayBuffer" });
}

export function getRecentlyFetchedMatches(options = {}) {
  return apiGet("/v1/matches/recently-fetched", options);
}

export function getMatchMetadata(matchId, options = {}) {
  return apiGet(matchPath(matchId, "/metadata"), options);
}

export function getRawMatchMetadata(matchId, options = {}) {
  return apiGet(matchPath(matchId, "/metadata/raw"), options);
}

export function getMatchLiveUrl(matchId, options = {}) {
  return apiGet(matchPath(matchId, "/live/url"), options);
}

export function getMatchSalts(matchId, options = {}) {
  return apiGet(matchPath(matchId, "/salts"), options);
}

export function getBulkMatchMetadata(options = {}) {
  return apiGet("/v1/matches/metadata", bulkMetadataOptions(options));
}

export function createCustomMatch(body, options = {}) {
  return apiRequest("/v1/matches/custom/create", {
    ...options,
    method: "POST",
    body,
  });
}

export function leaveCustomMatch(lobbyId, options = {}) {
  return apiRequest(lobbyPath(lobbyId, "leave"), { ...options, method: "POST" });
}

export function readyCustomMatch(lobbyId, options = {}) {
  return apiRequest(lobbyPath(lobbyId, "ready"), { ...options, method: "POST" });
}

export function startCustomMatch(lobbyId, options = {}) {
  return apiRequest(lobbyPath(lobbyId, "start"), { ...options, method: "POST" });
}

export function unreadyCustomMatch(lobbyId, options = {}) {
  return apiRequest(lobbyPath(lobbyId, "unready"), { ...options, method: "POST" });
}

export function getCustomMatchId(partyId, options = {}) {
  return apiGet(partyMatchPath(partyId), options);
}

export function getLiveQuery(options = {}) {
  return apiGet("/v1/matches/demo/live/query", options);
}

export function submitDemoQuery(body, options = {}) {
  return apiRequest("/v1/matches/demo/query", {
    ...options,
    method: "POST",
    body,
  });
}

export function getDemoQueryStatus(jobId, options = {}) {
  return apiGet("/v1/matches/demo/query/" + encodeURIComponent(String(jobId)), options);
}

export function getDemoSchema(matchId, options = {}) {
  return apiGet("/v1/matches/demo/schema", {
    ...options,
    query: { ...(options.query ?? {}), match_id: validateNumericId(matchId, "matchId") },
  });
}

export function getLiveUrls(options = {}) {
  return apiGet("/v1/matches/live/urls", options);
}

export function ingestLiveUrls(body, options = {}) {
  return apiRequest("/v1/matches/live/urls", {
    ...options,
    method: "POST",
    body,
  });
}

export function ingestMatchSalts(body, options = {}) {
  return apiRequest("/v1/matches/salts", {
    ...options,
    method: "POST",
    body,
  });
}
