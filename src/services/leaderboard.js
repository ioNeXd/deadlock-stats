import { getLeaderboard, getLeaderboardRaw, getHeroLeaderboard, getHeroLeaderboardRaw } from "../api/leaderboard.js";

export async function loadLeaderboard(region, options = {}) {
  const result = await getLeaderboard(region, options);
  const raw = result?.data;
  return { ...result, raw, data: Array.isArray(raw?.entries) ? raw.entries : [] };
}

export function downloadLeaderboardRaw(region, options = {}) {
  return getLeaderboardRaw(region, options);
}

export async function loadHeroLeaderboard(region, heroId, options = {}) {
  const result = await getHeroLeaderboard(region, heroId, options);
  const raw = result?.data;
  return { ...result, raw, data: Array.isArray(raw?.entries) ? raw.entries : [] };
}

export function downloadHeroLeaderboardRaw(region, heroId, options = {}) {
  return getHeroLeaderboardRaw(region, heroId, options);
}
