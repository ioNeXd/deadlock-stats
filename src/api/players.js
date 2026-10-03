import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const HERO_STATS_FILTERS = new Set([
  "account_ids", "game_mode", "match_mode", "hero_ids",
  "min_unix_timestamp", "max_unix_timestamp", "min_duration_s", "max_duration_s",
  "min_networth", "max_networth", "min_average_badge", "max_average_badge",
  "min_match_id", "max_match_id",
]);

const RANK_DISTRIBUTION_FILTERS = new Set([
  "min_unix_timestamp", "max_unix_timestamp", "min_duration_s", "max_duration_s",
  "is_high_skill_range_parties", "is_low_pri_pool", "is_new_player_pool",
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

function validateAccountId(accountId, name = "accountId") {
  if (!Number.isInteger(accountId) || accountId < 0) {
    throw new RangeError(name + " must be a non-negative integer");
  }
  return accountId;
}

function validateAccountIds(accountIds, max = 1000) {
  if (!Array.isArray(accountIds) || accountIds.length < 1 || accountIds.length > max) {
    throw new RangeError("accountIds must contain between 1 and " + max + " account IDs");
  }
  accountIds.forEach(accountId => validateAccountId(accountId));
  return accountIds;
}

function accountPath(accountId, suffix = "") {
  return "/v1/players/" + encodeURIComponent(validateAccountId(accountId)) + suffix;
}

export function getPlayerHeroStats(options = {}) {
  const query = filteredQuery(options, HERO_STATS_FILTERS);
  if (query.account_ids == null) throw new TypeError("account_ids is required");
  if (Array.isArray(query.account_ids)) {
    if (query.account_ids.length < 1 || query.account_ids.length > 1000) {
      throw new RangeError("account_ids must contain between 1 and 1000 account IDs");
    }
    validateAccountIds(query.account_ids);
    query.account_ids = query.account_ids.join(",");
  }
  if (query.account_ids === "") throw new TypeError("account_ids is required");
  return apiGet("/v1/players/hero-stats", { ...options, query });
}

export function getPlayerRankDistribution(options = {}) {
  const query = filteredQuery(options, RANK_DISTRIBUTION_FILTERS);
  return apiGet("/v1/players/rank/distribution", { ...options, query, cacheTtlMs: 60_000 });
}

export function getPlayerRanks(accountIds, options = {}) {
  validateAccountIds(accountIds);
  const query = { account_ids: accountIds.join(",") };
  return apiGet("/v1/players/rank", { ...options, query });
}

export function searchSteamProfiles(searchQuery, options = {}) {
  if (typeof searchQuery !== "string" || searchQuery.trim() === "") throw new TypeError("searchQuery is required");
  if (options.limit != null && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)) {
    throw new RangeError("limit must be between 1 and 1000");
  }
  if (options.min_matches_played_last_30d != null && (!Number.isInteger(options.min_matches_played_last_30d) || options.min_matches_played_last_30d < 0)) {
    throw new RangeError("min_matches_played_last_30d must be a non-negative integer");
  }
  if (options.min_last_team_avg_badge != null && (!Number.isInteger(options.min_last_team_avg_badge) || options.min_last_team_avg_badge < 0)) {
    throw new RangeError("min_last_team_avg_badge must be a non-negative integer");
  }
  if (options.matches_played_weight != null && (typeof options.matches_played_weight !== "number" || !Number.isFinite(options.matches_played_weight) || options.matches_played_weight < 0)) {
    throw new RangeError("matches_played_weight must be a non-negative number");
  }
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
  validateAccountIds(accountIds);
  return apiGet("/v1/players/steam", {
    ...options,
    query: { account_ids: accountIds.join(","), ...(options.refresh == null ? {} : { refresh: options.refresh }) },
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

export function getPlayerRankImage(accountIds, format = "png", options = {}) {
  validateAccountIds(accountIds, 12);
  if (format !== "png" && format !== "webp") {
    throw new RangeError("format must be png or webp");
  }
  const imageFormat = format;
  return apiGet("/v1/players/rank/image", {
    ...options,
    query: { account_ids: accountIds.join(","), format: imageFormat },
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}


export function getPlayerRankPredict(accountId, options = {}) {
  return apiGet(accountPath(accountId, "/rank"), options);
}

export function getPlayerRankPredictImage(accountId, format = "png", options = {}) {
  validateAccountId(accountId);
  if (format !== "png" && format !== "webp") throw new RangeError("format must be png or webp");
  return apiGet(accountPath(accountId, "/rank/image"), {
    ...options,
    query: { ...(options.query ?? {}), format },
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}

export function getPlayerRankPredictBatchImage(accountIds, format = "png", options = {}) {
  validateAccountIds(accountIds, 12);
  if (format !== "png" && format !== "webp") throw new RangeError("format must be png or webp");
  return apiGet("/v1/players/rank/image", {
    ...options,
    query: { ...(options.query ?? {}), account_ids: accountIds.join(","), format },
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}
