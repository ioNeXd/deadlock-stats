import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const ANALYTICS_FILTER_KEYS = {
  game: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","hero_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids"],
  heroStats: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_hero_matches","max_hero_matches","min_hero_matches_total","max_hero_matches_total","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","account_ids"],
  matchup: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_enemy_networth","max_enemy_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","same_lane_filter","min_matches","max_matches","account_ids"],
  synergy: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","same_lane_filter","min_matches","max_matches","account_ids"],
  combo: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id","min_matches","max_matches","comb_size","account_ids"],
  build: ["match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id","hero_build_id","min_matches","account_ids","ability_order_prefix","ability_unlock_order_prefix"],
  ability: ["hero_id","game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_ability_upgrades","max_ability_upgrades","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_matches","account_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix"],
  badge: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","is_high_skill_range_parties","is_low_pri_pool","is_new_player_pool","min_match_id","max_match_id"],
  buff: ["game_mode","match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id","min_networth","max_networth","hero_ids","account_ids"],
  itemFlow: ["phase_interval_s","phase_count","game_mode","match_mode","hero_ids","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","min_matches","account_ids","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","locked_item_ids","locked_columns"],
  itemPermutation: ["item_ids","comb_size","min_matches","max_matches","game_mode","match_mode","hero_ids","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","account_ids","ability_order_prefix","ability_unlock_order_prefix","include_corrupted_items"],
  itemStats: ["bucket","game_mode","match_mode","hero_ids","enemy_hero_ids","enemy_hero_ids_all_match","min_enemy_networth","max_enemy_networth","same_lane_filter","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_networth","max_networth","min_average_badge","max_average_badge","min_match_id","max_match_id","include_item_ids","exclude_item_ids","ability_order_prefix","ability_unlock_order_prefix","min_matches","max_matches","account_ids","min_bought_at_s","max_bought_at_s","item_order","corrupted_items"],
};

function analyticsOptions(options = {}, allowedKeys = [], stringArrayKeys = []) {
  const { query, ...rest } = options;
  const querySource = queryToObject(query);
  const topLevel = Object.fromEntries(Object.entries(rest).filter(([key]) => allowedKeys.includes(key)));
  const source = { ...querySource, ...topLevel };
  const filtered = Object.fromEntries(Object.entries(source).filter(([key]) => allowedKeys.includes(key)));
  for (const key of stringArrayKeys) {
    if (Array.isArray(filtered[key])) filtered[key] = filtered[key].join(",");
  }
  return { ...rest, query: filtered };
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

export function getHeroBanStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/hero-ban-stats", withAnalyticsQuery(analyticsOptions(options, ["match_mode","min_unix_timestamp","max_unix_timestamp","min_duration_s","max_duration_s","min_average_badge","max_average_badge","min_match_id","max_match_id"]), { bucket }));
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
  return apiGet("/v1/analytics/item-flow-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemFlow, ["hero_ids"]));
}

export function getItemPermutationStats(options = {}) {
  return apiGet("/v1/analytics/item-permutation-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemPermutation, ["hero_ids"]));
}

export function getItemStats(options = {}) {
  return apiGet("/v1/analytics/item-stats", analyticsOptions(options, ANALYTICS_FILTER_KEYS.itemStats, ["hero_ids", "enemy_hero_ids"]));
}
