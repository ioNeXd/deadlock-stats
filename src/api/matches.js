import { apiGet } from "./client.js";
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
  const source = query instanceof URLSearchParams ? Object.fromEntries(query.entries()) : (query ?? {});
  const topLevel = Object.fromEntries(Object.entries(rest).filter(([key]) => BULK_METADATA_KEYS.includes(key)));
  const merged = { ...source, ...topLevel };
  for (const key of ["match_ids","account_ids"]) {
    if (Array.isArray(merged[key])) merged[key] = merged[key];
  }
  for (const key of ["hero_ids","include_item_ids","exclude_item_ids"]) {
    if (Array.isArray(merged[key])) merged[key] = merged[key].join(",");
  }
  return { ...rest, query: Object.fromEntries(Object.entries(merged).filter(([key]) => BULK_METADATA_KEYS.includes(key) && merged[key] !== undefined && merged[key] !== null)) };
}

export function getActiveMatches(options = {}) {
  return apiGet("/v1/matches/active", options);
}

export function getRecentlyFetchedMatches(options = {}) {
  return apiGet("/v1/matches/recently-fetched", options);
}

export function getMatchMetadata(matchId, options = {}) {
  return apiGet(`/v1/matches/${encodeURIComponent(matchId)}/metadata`, options);
}

export function getMatchSalts(matchId, options = {}) {
  return apiGet(`/v1/matches/${encodeURIComponent(matchId)}/salts`, options);
}

export function getBulkMatchMetadata(options = {}) {
  return apiGet("/v1/matches/metadata", bulkMetadataOptions(options));
}
