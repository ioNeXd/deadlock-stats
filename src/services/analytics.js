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
    accountId: item?.account_id ?? null,
    heroId: item?.hero_id ?? null,
    matchesPlayed: item?.matches_played ?? null,
    lastPlayed: item?.last_played ?? null,
    timePlayed: item?.time_played ?? null,
    wins: item?.wins ?? null,
    endingLevel: item?.ending_level ?? null,
    kills: item?.kills ?? null,
    deaths: item?.deaths ?? null,
    assists: item?.assists ?? null,
    totalPlayerDamage: item?.total_player_damage ?? null,
    totalPlayerDamageTaken: item?.total_player_damage_taken ?? null,
    totalBossDamage: item?.total_boss_damage ?? null,
    totalCreepDamage: item?.total_creep_damage ?? null,
    totalNeutralDamage: item?.total_neutral_damage ?? null,
    deniesPerMatch: item?.denies_per_match ?? null,
    killsPerMin: item?.kills_per_min ?? null,
    deathsPerMin: item?.deaths_per_min ?? null,
    assistsPerMin: item?.assists_per_min ?? null,
    deniesPerMin: item?.denies_per_min ?? null,
    networthPerMin: item?.networth_per_min ?? null,
    lastHitsPerMin: item?.last_hits_per_min ?? null,
    damagePerMin: item?.damage_per_min ?? null,
    damagePerSoul: item?.damage_per_soul ?? null,
    damageMitigatedPerMin: item?.damage_mitigated_per_min ?? null,
    damageTakenPerMin: item?.damage_taken_per_min ?? null,
    damageTakenPerSoul: item?.damage_taken_per_soul ?? null,
    creepsPerMin: item?.creeps_per_min ?? null,
    objDamagePerMin: item?.obj_damage_per_min ?? null,
    objDamagePerSoul: item?.obj_damage_per_soul ?? null,
    accuracy: item?.accuracy ?? null,
    critShotRate: item?.crit_shot_rate ?? null,
    mvpRankCounts: item?.mvp_rank_counts ?? [],
    mvpRatedMatches: item?.mvp_rated_matches ?? null,
    matches: item?.matches ?? [],
    permanentBuffs: item?.permanent_buffs ?? null,
    permanentBuffMatches: item?.permanent_buff_matches ?? null,
    permanentBuffsPerMin: item?.permanent_buffs_per_min ?? null,
    avgFirstPermanentBuffTimeS: item?.avg_first_permanent_buff_time_s ?? null,
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
