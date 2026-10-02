import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const ANALYTICS_CACHE_TTL_MS = 60 * 60_000;
const ITEM_STATS_CACHE_TTL_MS = 6 * 60 * 60_000;

const LANE_BASE_FILTERS = [
  "game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s",
  "min_average_badge","max_average_badge","min_match_id","max_match_id","assigned_lanes",
  "hero_ids","enemy_hero_ids","stats","group_by","min_matches","max_matches","account_ids",
];
const LANE_MATCHUP_FILTERS = ["sample_time_s", ...LANE_BASE_FILTERS];
const LANE_SOUL_CURVE_FILTERS = ["min_time_s","max_time_s", ...LANE_BASE_FILTERS];

const PLAYER_PERFORMANCE_FILTERS = [
  "resolution","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s",
  "min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","hero_ids",
  "include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids",
];

const PLAYER_METRICS_FILTERS = [
  "hero_ids","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s",
  "min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","max_matches",
  "include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids","include_buff_metrics",
];

const SCOREBOARD_FILTERS = [
  "sort_by","sort_direction","game_mode","match_mode","hero_id","min_matches","max_matches","min_unix_timestamp",
  "max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge",
  "max_average_badge","min_match_id","max_match_id","account_ids",
];

const HERO_SCOREBOARD_FILTERS = SCOREBOARD_FILTERS.filter(key => key !== "max_matches");
const PLAYER_SCOREBOARD_FILTERS = [...SCOREBOARD_FILTERS, "start", "limit"];

const KILL_DEATH_FILTERS = [
  "team","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s",
  "account_ids","hero_ids","min_networth","max_networth","is_high_skill_range_parties","is_low_pri_pool",
  "is_new_player_pool","min_match_id","max_match_id","min_average_badge","max_average_badge","min_kills_per_raster",
  "max_kills_per_raster","min_deaths_per_raster","max_deaths_per_raster","min_game_time_s","max_game_time_s",
];

const ANALYTICS_FILTER_KEYS = {
  game: ["bucket","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","hero_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids"],
  heroStats: ["bucket","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_hero_matches","max_hero_matches","min_hero_matches_total","max_hero_matches_total","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids"],
  matchup: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_enemy_networth","max_enemy_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","same_lane_filter","min_matches","max_matches","account_ids"],
  synergy: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","same_lane_filter","min_matches","max_matches","account_ids"],
  combo: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","include_hero_ids","exclude_hero_ids","include_enemy_hero_ids","exclude_enemy_hero_ids","min_matches","max_matches","comb_size","account_ids"],
  build: ["match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id","hero_build_id","min_matches","account_ids","ability_order_prefix","ability_unlock_order_prefix"],
  ability: ["hero_id","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_ability_upgrades","max_ability_upgrades","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_matches","account_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix"],
  badge: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","is_high_skill_range_parties","is_low_pri_pool","is_new_player_pool","min_match_id","max_match_id"],
  buff: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id","min_networth","max_networth","hero_ids","account_ids"],
  itemFlow: ["phase_interval_s","phase_count","game_mode","match_mode","hero_ids","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_matches","account_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","locked_item_ids","locked_columns"],
  itemPermutation: ["item_ids","comb_size","min_matches","max_matches","game_mode","match_mode","hero_ids","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","account_ids","ability_order_prefix","ability_unlock_order_prefix","include_corrupted_items"],
  itemStats: ["bucket","game_mode","match_mode","hero_ids","enemy_hero_ids","enemy_hero_ids_all_match","min_enemy_networth","max_enemy_networth","same_lane_filter","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","min_matches","max_matches","account_ids","min_bought_at_s","max_bought_at_s","item_order","corrupted_items"],
};

function analyticsOptions(options = {}, allowedKeys = []) {
  const { query, ...rest } = options;
  const querySource = queryToObject(query);
  const topLevel = Object.fromEntries(Object.entries(rest).filter(([key]) => allowedKeys.includes(key)));
  const source = { ...querySource, ...topLevel };
  const filtered = Object.fromEntries(Object.entries(source).filter(([key]) => allowedKeys.includes(key)));
  for (const [key, value] of Object.entries(filtered)) {
    if (Array.isArray(value)) filtered[key] = value.join(",");
  }
  return { ...rest, cacheTtlMs: rest.cacheTtlMs ?? ANALYTICS_CACHE_TTL_MS, query: filtered };
}

function withAnalyticsQuery(options = {}, query = {}) {
  const existing = queryToObject(options.query);

  const merged = Object.fromEntries(
    Object.entries({ ...existing, ...query }).filter(([, value]) => value !== undefined && value !== null),
  );

  return { ...options, query: merged };
}

export function getGameStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/game-stats", withAnalyticsQuery(analyticsOptions(options, ANALYTICS_FILTER_KEYS.game), { bucket }));
}

export function getHeroBanStats(options = {}) {
  return apiGet("/v1/analytics/hero-ban-stats", analyticsOptions(options, ["match_mode","bucket","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id"]));
}

export function getHeroStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/hero-stats", withAnalyticsQuery(analyticsOptions(options, ANALYTICS_FILTER_KEYS.heroStats), { bucket }));
}

export function getHeroCounterStats(options = {}) {
  return apiGet("/v1/analytics/hero-counter-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.matchup));
}

export function getHeroSynergyStats(options = {}) {
  return apiGet("/v1/analytics/hero-synergy-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.synergy));
}

export function getHeroCombStats(options = {}) {
  return apiGet("/v1/analytics/hero-comb-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.combo));
}

export function getHeroBuildStats(heroId, options = {}) {
  return apiGet(`/v1/analytics/hero-build-stats/${encodeURIComponent(heroId)}`, analyticsOptions(options, ANALYTICS_FILTER_KEYS.build));
}

export function getAbilityOrderStats(options = {}) {
  return apiGet("/v1/analytics/ability-order-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.ability));
}

export function getBadgeDistribution(options = {}) {
  return apiGet("/v1/analytics/badge-distribution", analyticsOptions(options, ANALYTICS_FILTER_KEYS.badge));
}

export function getBuffStats(options = {}) {
  return apiGet("/v1/analytics/buff-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.buff));
}

export function getBuildItemStats(options = {}) {
  return apiGet("/v1/analytics/build-item-stats", analyticsOptions(options, ["hero_id","min_last_updated_unix_timestamp","max_last_updated_unix_timestamp"]));
}

export function getItemFlowStats(options = {}) {
  return apiGet("/v1/analytics/item-flow-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemFlow));
}

export function getItemPermutationStats(options = {}) {
  return apiGet("/v1/analytics/item-permutation-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemPermutation));
}

export function getItemStats(options = {}) {
  return apiGet("/v1/analytics/item-stats", {
    ...analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemStats),
    cacheTtlMs: options.cacheTtlMs ?? ITEM_STATS_CACHE_TTL_MS,
  });
}


export function getLaneMatchupStats(options = {}) {
  return apiGet("/v1/analytics/lane-matchup-stats", analyticsOptions(options, LANE_MATCHUP_FILTERS));
}

export function getLaneSoulCurve(options = {}) {
  return apiGet("/v1/analytics/lane-soul-curve", analyticsOptions(options, LANE_SOUL_CURVE_FILTERS));
}

export function getPlayerPerformanceCurve(options = {}) {
  return apiGet("/v1/analytics/player-performance-curve", analyticsOptions(options, PLAYER_PERFORMANCE_FILTERS));
}

export function getPlayerStatsMetrics(options = {}) {
  return apiGet("/v1/analytics/player-stats/metrics", analyticsOptions(options, PLAYER_METRICS_FILTERS));
}

function requireSortBy(options = {}) {
  if (options.sort_by == null || options.sort_by === "") throw new TypeError("sort_by is required");
  return options;
}

export function getHeroScoreboard(options = {}) {
  return apiGet("/v1/analytics/scoreboards/heroes", analyticsOptions(requireSortBy(options), HERO_SCOREBOARD_FILTERS));
}

export function getPlayerScoreboard(options = {}) {
  return apiGet("/v1/analytics/scoreboards/players", analyticsOptions(requireSortBy(options), PLAYER_SCOREBOARD_FILTERS));
}

export function getKillDeathStats(options = {}) {
  const { query, ...rest } = options;
  const source = { ...queryToObject(query), ...Object.fromEntries(Object.entries(rest).filter(([key]) => KILL_DEATH_FILTERS.includes(key))) };
  const filtered = Object.fromEntries(Object.entries(source).filter(([key, value]) => KILL_DEATH_FILTERS.includes(key) && value !== undefined && value !== null && value !== ""));
  return apiGet("/v1/analytics/kill-death-stats", { ...rest, cacheTtlMs: rest.cacheTtlMs ?? ANALYTICS_CACHE_TTL_MS, query: filtered });
}
