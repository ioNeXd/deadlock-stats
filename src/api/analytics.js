import { apiGet } from "./client.js";

function withAnalyticsQuery(options = {}, query = {}) {
  const existing = options.query instanceof URLSearchParams
    ? Object.fromEntries(options.query.entries())
    : (options.query ?? {});

  const merged = Object.fromEntries(
    Object.entries({ ...existing, ...query }).filter(([, value]) => value !== undefined && value !== null),
  );

  return { ...options, query: merged };
}

export function getGameStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/game-stats", withAnalyticsQuery(options, { bucket }));
}

export function getHeroBanStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/hero-ban-stats", withAnalyticsQuery(options, { bucket }));
}

export function getHeroStats({ bucket, ...options } = {}) {
  return apiGet("/v1/analytics/hero-stats", withAnalyticsQuery(options, { bucket }));
}

export function getHeroCounterStats(options = {}) {
  return apiGet("/v1/analytics/hero-counter-stats", options);
}

export function getHeroSynergyStats(options = {}) {
  return apiGet("/v1/analytics/hero-synergy-stats", options);
}

export function getHeroCombStats(options = {}) {
  return apiGet("/v1/analytics/hero-comb-stats", options);
}

export function getHeroBuildStats(heroId, options = {}) {
  return apiGet(`/v1/analytics/hero-build-stats/${encodeURIComponent(heroId)}`, options);
}

export function getAbilityOrderStats(options = {}) {
  return apiGet("/v1/analytics/ability-order-stats", options);
}

export function getBadgeDistribution(options = {}) {
  return apiGet("/v1/analytics/badge-distribution", options);
}

export function getBuffStats(options = {}) {
  return apiGet("/v1/analytics/buff-stats", options);
}

export function getBuildItemStats(options = {}) {
  return apiGet("/v1/analytics/build-item-stats", options);
}
