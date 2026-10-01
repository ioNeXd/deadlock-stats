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
