import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const HERO_STATS_FILTERS = new Set([
  "account_ids", "game_mode", "match_mode", "hero_ids",
  "min_unix_timestamp", "max_unix_timestamp", "min_duration_s", "max_duration_s",
  "min_networth", "max_networth", "min_average_badge", "max_average_badge",
  "min_match_id", "max_match_id",
]);

const ENEMY_MATE_FILTERS = new Set([
  "game_mode", "min_unix_timestamp", "max_unix_timestamp", "min_duration_s",
  "max_duration_s", "min_match_id", "max_match_id", "min_matches_played",
  "max_matches_played",
]);

function filteredQuery(options, allowed) {
  const { query, ...rest } = options ?? {};
  const source = { ...queryToObject(query), ...rest };
  return Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    allowed.has(key) && value !== undefined && value !== null && value !== ""
  ));
}

function accountPath(accountId, suffix = "") {
  return "/v1/players/" + encodeURIComponent(accountId) + suffix;
}

export function getPlayerHeroStats(options = {}) {
  const query = filteredQuery(options, HERO_STATS_FILTERS);
  if (query.account_ids == null || (Array.isArray(query.account_ids) && query.account_ids.length === 0)) {
    throw new TypeError("account_ids is required");
  }
  return apiGet("/v1/players/hero-stats", { ...options, query });
}

export function getPlayerRanks(accountIds, options = {}) {
  if (!Array.isArray(accountIds) || accountIds.length < 1 || accountIds.length > 1000) {
    throw new RangeError("accountIds must contain between 1 and 1000 account IDs");
  }
  const query = { account_ids: accountIds };
  return apiGet("/v1/players/rank", { ...options, query });
}

export function searchSteamProfiles(searchQuery, options = {}) {
  const query = {
    search_query: searchQuery,
    ...(options.limit == null ? {} : { limit: options.limit }),
    ...(options.min_matches_played_last_30d == null ? {} : { min_matches_played_last_30d: options.min_matches_played_last_30d }),
    ...(options.min_last_team_avg_badge == null ? {} : { min_last_team_avg_badge: options.min_last_team_avg_badge }),
    ...(options.matches_played_weight == null ? {} : { matches_played_weight: options.matches_played_weight }),
  };
  return apiGet("/v1/players/steam-search", { ...options, query });
}

export function getSteamProfiles(accountIds, options = {}) {
  return apiGet("/v1/players/steam", {
    ...options,
    query: { account_ids: accountIds, ...(options.refresh == null ? {} : { refresh: options.refresh }) },
  });
}

export function getPlayerRank(accountId, options = {}) {
  return apiGet(accountPath(accountId, "/rank"), options);
}

export function getPlayerCard(accountId, options = {}) {
  return apiGet(accountPath(accountId, "/card"), options);
}

export function getPlayerAccountStats(accountId, options = {}) {
  return apiGet(accountPath(accountId, "/account-stats"), options);
}

export function getPlayerMatchHistory(accountId, options = {}) {
  const query = {};
  if (options.force_refetch != null) query.force_refetch = options.force_refetch;
  return apiGet(accountPath(accountId, "/match-history"), { ...options, query });
}

export function getPlayerEnemyStats(accountId, options = {}) {
  return apiGet(accountPath(accountId, "/enemy-stats"), {
    ...options,
    query: filteredQuery(options, ENEMY_MATE_FILTERS),
  });
}

export function getPlayerMateStats(accountId, options = {}) {
  const query = filteredQuery(options, ENEMY_MATE_FILTERS);
  if (options.same_party != null) query.same_party = options.same_party;
  return apiGet(accountPath(accountId, "/mate-stats"), { ...options, query });
}

export function getPlayerRankImage(accountId, format = "webp", options = {}) {
  const imageFormat = format === "png" ? "png" : "webp";
  return apiGet(accountPath(accountId, "/rank/image"), {
    ...options,
    query: { format: imageFormat },
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}
