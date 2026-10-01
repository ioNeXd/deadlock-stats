import { getLeaderboard, getLeaderboardRaw } from "../api/leaderboard.js";

export async function loadLeaderboard(region, options = {}) {
  const result = await getLeaderboard(region, options);
  const raw = result?.data;
  return { ...result, raw, data: Array.isArray(raw?.entries) ? raw.entries : [] };
}

export function downloadLeaderboardRaw(region, options = {}) {
  return getLeaderboardRaw(region, options);
}
