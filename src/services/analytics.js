import { getGameStats, getHeroBanStats, getHeroStats, getHeroCounterStats, getHeroSynergyStats, getHeroBuildStats, getAbilityOrderStats } from "../api/analytics.js";

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


function normalizeRows(result, normalize) {
  const data = Array.isArray(result?.data) ? result.data : [];
  return data.map(normalize);
}

export function normalizeHeroCounterStats(result) {
  return normalizeRows(result, item => ({
    heroId: item?.hero_id ?? null,
    enemyHeroId: item?.enemy_hero_id ?? null,
    wins: item?.wins ?? null,
    matchesPlayed: item?.matches_played ?? null,
    kills: item?.kills ?? null,
    enemyKills: item?.enemy_kills ?? null,
    deaths: item?.deaths ?? null,
    enemyDeaths: item?.enemy_deaths ?? null,
    assists: item?.assists ?? null,
    enemyAssists: item?.enemy_assists ?? null,
    denies: item?.denies ?? null,
    enemyDenies: item?.enemy_denies ?? null,
    lastHits: item?.last_hits ?? null,
    enemyLastHits: item?.enemy_last_hits ?? null,
    networth: item?.networth ?? null,
    enemyNetworth: item?.enemy_networth ?? null,
    objDamage: item?.obj_damage ?? null,
    enemyObjDamage: item?.enemy_obj_damage ?? null,
    creeps: item?.creeps ?? null,
    enemyCreeps: item?.enemy_creeps ?? null,
    raw: item,
  }));
}

export function normalizeHeroSynergyStats(result) {
  return normalizeRows(result, item => ({
    heroId1: item?.hero_id1 ?? null,
    heroId2: item?.hero_id2 ?? null,
    wins: item?.wins ?? null,
    matchesPlayed: item?.matches_played ?? null,
    kills1: item?.kills1 ?? null,
    kills2: item?.kills2 ?? null,
    deaths1: item?.deaths1 ?? null,
    deaths2: item?.deaths2 ?? null,
    assists1: item?.assists1 ?? null,
    assists2: item?.assists2 ?? null,
    denies1: item?.denies1 ?? null,
    denies2: item?.denies2 ?? null,
    lastHits1: item?.last_hits1 ?? null,
    lastHits2: item?.last_hits2 ?? null,
    networth1: item?.networth1 ?? null,
    networth2: item?.networth2 ?? null,
    objDamage1: item?.obj_damage1 ?? null,
    objDamage2: item?.obj_damage2 ?? null,
    creeps1: item?.creeps1 ?? null,
    creeps2: item?.creeps2 ?? null,
    raw: item,
  }));
}

export function normalizeHeroCombStats(result) {
  return normalizeRows(result, item => ({
    heroIds: Array.isArray(item?.hero_ids) ? item.hero_ids : [],
    wins: item?.wins ?? null,
    losses: item?.losses ?? null,
    matches: item?.matches ?? null,
    raw: item,
  }));
}


export async function getHeroMatchupSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const [counterResult, synergyResult] = await Promise.all([
    getHeroCounterStats({ ...requestOptions, signal }),
    getHeroSynergyStats({ ...requestOptions, signal }),
  ]);
  return {
    counters: normalizeHeroCounterStats(counterResult),
    synergies: normalizeHeroSynergyStats(synergyResult),
  };
}


export function normalizeHeroBuildStats(result) {
  return normalizeRows(result, item => ({
    heroId: item?.hero_id ?? null,
    heroBuildId: item?.hero_build_id ?? null,
    wins: item?.wins ?? null,
    losses: item?.losses ?? null,
    matches: item?.matches ?? null,
    players: item?.players ?? null,
    raw: item,
  }));
}

export function normalizeAbilityOrderStats(result) {
  return normalizeRows(result, item => ({
    abilities: Array.isArray(item?.abilities) ? item.abilities : [],
    wins: item?.wins ?? null,
    losses: item?.losses ?? null,
    matches: item?.matches ?? null,
    players: item?.players ?? null,
    totalKills: item?.total_kills ?? null,
    totalDeaths: item?.total_deaths ?? null,
    totalAssists: item?.total_assists ?? null,
    raw: item,
  }));
}

export async function getHeroBuildStatsSnapshot(heroId, options = {}) {
  const { signal, ...requestOptions } = options;
  const result = await getHeroBuildStats(heroId, {
    ...requestOptions,
    min_matches: requestOptions.min_matches ?? 20,
    signal,
  });
  return normalizeHeroBuildStats(result);
}

export async function getAbilityOrderStatsSnapshot(heroId, options = {}) {
  const { signal, ...requestOptions } = options;
  const result = await getAbilityOrderStats({
    ...requestOptions,
    hero_id: heroId,
    min_matches: requestOptions.min_matches ?? 20,
    signal,
  });
  return normalizeAbilityOrderStats(result);
}
