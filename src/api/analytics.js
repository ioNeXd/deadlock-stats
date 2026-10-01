import { apiGet } from "./client.js";

export function getGameStats(options = {}) {
  return apiGet("/v1/analytics/game-stats", options);
}

export function getHeroBanStats(options = {}) {
  return apiGet("/v1/analytics/hero-ban-stats", options);
}
