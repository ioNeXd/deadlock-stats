import { getGameStats, getHeroBanStats, getHeroStats } from "../api/analytics.js";

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

export function normalizeHeroStats(result) {
  const data = Array.isArray(result?.data) ? result.data : [];
  return data.map(item => ({
    heroId: item?.hero_id ?? null,
    bucket: item?.bucket ?? null,
    wins: item?.wins ?? null,
    losses: item?.losses ?? null,
    matches: item?.matches ?? null,
    matchesPerBucket: item?.matches_per_bucket ?? null,
    totalKills: item?.total_kills ?? null,
    totalDeaths: item?.total_deaths ?? null,
    totalAssists: item?.total_assists ?? null,
    totalNetWorth: item?.total_net_worth ?? null,
    totalLastHits: item?.total_last_hits ?? null,
    totalDenies: item?.total_denies ?? null,
    totalPlayerDamage: item?.total_player_damage ?? null,
    totalPlayerDamageTaken: item?.total_player_damage_taken ?? null,
    totalBossDamage: item?.total_boss_damage ?? null,
    totalCreepDamage: item?.total_creep_damage ?? null,
    totalNeutralDamage: item?.total_neutral_damage ?? null,
    totalMaxHealth: item?.total_max_health ?? null,
    totalShotsHit: item?.total_shots_hit ?? null,
    totalShotsMissed: item?.total_shots_missed ?? null,
    totalPermanentBuffs: item?.total_permanent_buffs ?? null,
    permanentBuffMatches: item?.permanent_buff_matches ?? null,
    totalFirstPermanentBuffTimeS: item?.total_first_permanent_buff_time_s ?? null,
    permanentBuffTimingMatches: item?.permanent_buff_timing_matches ?? null,
    raw: item,
  }));
}

export async function getHeroStatsSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const result = await getHeroStats({
    ...requestOptions,
    bucket: requestOptions.bucket ?? "no_bucket",
    signal,
  });
  return normalizeHeroStats(result);
}
