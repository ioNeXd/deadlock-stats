import {
  getPlayerHeroStats,
  getPlayerRanks,
  getPlayerRankDistribution,
  searchSteamProfiles,
  getSteamProfiles,
  getPlayerRank,
  getPlayerCard,
  getPlayerAccountStats,
  getPlayerMatchHistory,
  getPlayerEnemyStats,
  getPlayerMateStats,
  getPlayerRankImage,
  getPlayerMmr,
  getPlayerMmrDistribution,
  getPlayerHeroMmr,
  getPlayerHeroMmrDistribution,
  getPlayerMmrHistory,
  getPlayerHeroMmrHistory,
  getPlayerRankPredict,
  getPlayerRankPredictImage,
  getPlayerRankPredictBatchImage,
} from "../api/players.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function withArray(result) {
  const raw = result?.data;
  return { ...result, raw, data: asArray(raw) };
}

function withObject(result) {
  return { ...result, raw: result?.data, data: result?.data ?? null };
}

export async function searchPlayers(query, options = {}) {
  return withArray(await searchSteamProfiles(query, options));
}

export async function loadSteamProfiles(accountIds, options = {}) {
  return withArray(await getSteamProfiles(accountIds, options));
}

export async function loadPlayerHeroStats(options = {}) {
  return withArray(await getPlayerHeroStats(options));
}

export async function loadPlayerRanks(accountIds, options = {}) {
  return withArray(await getPlayerRanks(accountIds, options));
}

export async function loadPlayerRankDistribution(options = {}) {
  return withArray(await getPlayerRankDistribution(options));
}

export async function loadPlayerRank(accountId, options = {}) {
  return withObject(await getPlayerRank(accountId, options));
}

export async function loadPlayerCard(accountId, options = {}) {
  return withObject(await getPlayerCard(accountId, options));
}

export async function loadPlayerAccountStats(accountId, options = {}) {
  return withObject(await getPlayerAccountStats(accountId, options));
}

export async function loadPlayerMatchHistory(accountId, options = {}) {
  return withArray(await getPlayerMatchHistory(accountId, options));
}

export async function loadPlayerEnemyStats(accountId, options = {}) {
  return withArray(await getPlayerEnemyStats(accountId, options));
}

export async function loadPlayerMateStats(accountId, options = {}) {
  return withArray(await getPlayerMateStats(accountId, options));
}

export function loadPlayerRankImage(accountIds, format, options = {}) {
  return getPlayerRankImage(accountIds, format, options);
}


export async function loadPlayerMmr(accountIds, options = {}) {
  return withArray(await getPlayerMmr(accountIds, options));
}

export async function loadPlayerMmrDistribution(options = {}) {
  return withArray(await getPlayerMmrDistribution(options));
}

export async function loadPlayerHeroMmr(heroId, accountIds, options = {}) {
  return withArray(await getPlayerHeroMmr(heroId, accountIds, options));
}

export async function loadPlayerHeroMmrDistribution(heroId, options = {}) {
  return withArray(await getPlayerHeroMmrDistribution(heroId, options));
}

export async function loadPlayerMmrHistory(accountId, options = {}) {
  return withArray(await getPlayerMmrHistory(accountId, options));
}

export async function loadPlayerHeroMmrHistory(accountId, heroId, options = {}) {
  return withArray(await getPlayerHeroMmrHistory(accountId, heroId, options));
}

export async function loadPlayerRankPredict(accountId, options = {}) {
  return withObject(await getPlayerRankPredict(accountId, options));
}

export function loadPlayerRankPredictImage(accountId, format, options = {}) {
  return getPlayerRankPredictImage(accountId, format, options);
}

export function loadPlayerRankPredictBatchImage(accountIds, format, options = {}) {
  return getPlayerRankPredictBatchImage(accountIds, format, options);
}

export function buildPlayerDetailViewModel(snapshot, profile = null) {
  const rank = snapshot?.rank?.data ?? snapshot?.rank?.raw ?? snapshot?.rank ?? {};
  const heroes = Array.isArray(snapshot?.heroStats) ? snapshot.heroStats : asArray(snapshot?.heroStats?.data);
  const history = Array.isArray(snapshot?.matchHistory) ? snapshot.matchHistory : asArray(snapshot?.matchHistory?.data);
  const enemies = Array.isArray(snapshot?.enemyStats) ? snapshot.enemyStats : asArray(snapshot?.enemyStats?.data);
  const mates = Array.isArray(snapshot?.mateStats) ? snapshot.mateStats : asArray(snapshot?.mateStats?.data);

  return {
    accountId: Number.isInteger(Number(snapshot?.accountId)) ? Number(snapshot.accountId) : null,
    profile: profile ?? null,
    rank,
    heroStats: heroes.slice().sort((a, b) => Number(b?.matches_played ?? 0) - Number(a?.matches_played ?? 0)),
    matchHistory: history,
    enemyStats: enemies.slice().sort((a, b) => Number(b?.matches_played ?? 0) - Number(a?.matches_played ?? 0)),
    mateStats: mates.slice().sort((a, b) => Number(b?.matches_played ?? 0) - Number(a?.matches_played ?? 0)),
    raw: snapshot ?? null,
  };
}

export async function getPlayerDetailCoreSnapshot(accountId, options = {}) {
  const rank = await loadPlayerRank(accountId, options);
  return { accountId, rank, heroStats: [], matchHistory: [] };
}

export async function getPlayerMatchHistorySnapshot(accountId, options = {}) {
  const matchHistory = await loadPlayerMatchHistory(accountId, options);
  return { accountId, matchHistory: matchHistory.data };
}

export async function getPlayerHeroStatsSnapshot(accountId, options = {}) {
  const heroStats = await loadPlayerHeroStats({ ...options, account_ids: [Number(accountId)] });
  return { accountId, heroStats: heroStats.data };
}

export async function getPlayerRelationsSnapshot(accountId, options = {}) {
  const [enemyStats, mateStats] = await Promise.all([
    loadPlayerEnemyStats(accountId, options),
    loadPlayerMateStats(accountId, options),
  ]);
  return { accountId, enemyStats: enemyStats.data, mateStats: mateStats.data };
}

export async function getPlayerDetailSnapshot(accountId, options = {}) {
  const [core, history, heroStats, relations] = await Promise.all([
    getPlayerDetailCoreSnapshot(accountId, options),
    getPlayerMatchHistorySnapshot(accountId, options),
    getPlayerHeroStatsSnapshot(accountId, options),
    getPlayerRelationsSnapshot(accountId, options),
  ]);
  return { ...core, ...history, ...heroStats, ...relations };
}
