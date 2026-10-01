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
    timestamp: item?.start_time ?? item?.start_time_unix ?? item?.timestamp ?? null,
    matches: item?.matches ?? item?.match_count ?? item?.total_matches ?? null,
    raw: item,
  }));
}

export function normalizeHeroBanStats(result) {
  const data = Array.isArray(result?.data) ? result.data : [];
  return data.map(item => ({
    heroId: item?.hero_id ?? item?.heroId ?? null,
    bans: item?.bans ?? item?.ban_count ?? item?.total_bans ?? null,
    rate: item?.ban_rate ?? item?.banRate ?? null,
    raw: item,
  }));
}
