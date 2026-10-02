import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const REGIONS = new Set(["Europe","Asia","NAmerica","SAmerica","Oceania"]);

function validateRegion(region) {
  if (!REGIONS.has(region)) throw new RangeError("Unsupported leaderboard region");
  return region;
}

function leaderboardQuery(options = {}) {
  const query = queryToObject(options.query);
  if (options.leaderboard_id !== undefined && options.leaderboard_id !== null && options.leaderboard_id !== "") {
    const value = Number(options.leaderboard_id);
    if (!Number.isInteger(value) || value < 0) throw new RangeError("leaderboard_id must be a non-negative integer");
    query.leaderboard_id = value;
  }
  return query;
}

export function getLeaderboard(region, options = {}) {
  validateRegion(region);
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region), { ...options, query: leaderboardQuery(options) });
}

export function getHeroLeaderboard(region, heroId, options = {}) {
  validateRegion(region);
  if (!Number.isInteger(heroId) || heroId < 0) throw new RangeError("heroId must be a non-negative integer");
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/" + encodeURIComponent(heroId), { ...options, query: leaderboardQuery(options) });
}

export function getHeroLeaderboardRaw(region, heroId, options = {}) {
  validateRegion(region);
  if (!Number.isInteger(heroId) || heroId < 0) throw new RangeError("heroId must be a non-negative integer");
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/" + encodeURIComponent(heroId) + "/raw", {
    ...options,
    query: leaderboardQuery(options),
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}

export function getLeaderboardRaw(region, options = {}) {
  validateRegion(region);
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/raw", {
    ...options,
    query: leaderboardQuery(options),
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}
