import { apiGet } from "./client.js";

const REGIONS = new Set(["Europe","Asia","NAmerica","SAmerica","Oceania"]);

export function getLeaderboard(region, options = {}) {
  if (!REGIONS.has(region)) throw new RangeError("Unsupported leaderboard region");
  const query = {};
  if (options.leaderboard_id !== undefined && options.leaderboard_id !== null && options.leaderboard_id !== "") {
    query.leaderboard_id = options.leaderboard_id;
  }
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region), { ...options, query });
}

export function getHeroLeaderboard(region, heroId, options = {}) {
  if (!REGIONS.has(region)) throw new RangeError("Unsupported leaderboard region");
  if (!Number.isInteger(heroId) || heroId < 0) throw new RangeError("heroId must be a non-negative integer");
  const query = {};
  if (options.leaderboard_id !== undefined && options.leaderboard_id !== null && options.leaderboard_id !== "") {
    query.leaderboard_id = options.leaderboard_id;
  }
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/" + encodeURIComponent(heroId), { ...options, query });
}

export function getHeroLeaderboardRaw(region, heroId, options = {}) {
  if (!REGIONS.has(region)) throw new RangeError("Unsupported leaderboard region");
  if (!Number.isInteger(heroId) || heroId < 0) throw new RangeError("heroId must be a non-negative integer");
  const query = {};
  if (options.leaderboard_id !== undefined && options.leaderboard_id !== null && options.leaderboard_id !== "") {
    query.leaderboard_id = options.leaderboard_id;
  }
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/" + encodeURIComponent(heroId) + "/raw", {
    ...options,
    query,
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}

export function getLeaderboardRaw(region, options = {}) {
  if (!REGIONS.has(region)) throw new RangeError("Unsupported leaderboard region");
  const query = {};
  if (options.leaderboard_id !== undefined && options.leaderboard_id !== null && options.leaderboard_id !== "") {
    query.leaderboard_id = options.leaderboard_id;
  }
  return apiGet("/v1/leaderboard/" + encodeURIComponent(region) + "/raw", {
    ...options,
    query,
    responseType: "arrayBuffer",
    cache: false,
    dedupe: false,
  });
}
