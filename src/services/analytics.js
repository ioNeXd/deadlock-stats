import { getGameStats, getHeroBanStats } from "../api/analytics.js";

export async function getAnalyticsSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;

  const [gameStats, heroBanStats] = await Promise.all([
    getGameStats({
      ...requestOptions,
      bucket: requestOptions.bucket ?? "start_time_day",
      signal,
    }),
    getHeroBanStats({
      ...requestOptions,
      bucket: requestOptions.bucket ?? "start_time_day",
      signal,
    }),
  ]);

  return { gameStats, heroBanStats };
}

export function normalizeGameStats(result) {
  const data = Array.isArray(result?.data) ? result.data : [];
  return data.map(item => ({
    bucket: item?.bucket ?? null,
    totalMatches: item?.total_matches ?? null,
    totalPlayers: item?.total_players ?? null,
    avgDurationS: item?.avg_duration_s ?? null,
    avgKills: item?.avg_kills ?? null,
    avgPlayerDamage: item?.avg_player_damage ?? null,
    team0Wins: item?.team0_wins ?? null,
    team1Wins: item?.team1_wins ?? null,
    raw: item,
  }));
}

export function normalizeHeroBanStats(result) {
  const data = Array.isArray(result?.data) ? result.data : [];
  return data.map(item => ({
    heroId: item?.hero_id ?? null,
    bucket: item?.bucket ?? null,
    bans: item?.bans ?? null,
    raw: item,
  }));
}
