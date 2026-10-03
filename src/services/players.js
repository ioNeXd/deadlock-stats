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
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) throw new TypeError("query is required");

  if (/^\d+$/.test(normalizedQuery)) {
    const accountId = Number(normalizedQuery);
    if (Number.isSafeInteger(accountId) && accountId >= 0) {
      return loadSteamProfiles([accountId], options);
    }
  }

  return withArray(await searchSteamProfiles(normalizedQuery, options));
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

export async function loadPlayerRankHistory(accountId, options = {}) {
  const matchHistory = await loadPlayerMatchHistory(accountId, options);
  return {
    ...matchHistory,
    data: buildPlayerRankHistoryViewModel(matchHistory),
  };
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


export async function loadPlayerRankForecast(accountId, options = {}) {
  return loadPlayerRankPredict(accountId, options);
}

export async function loadPlayerRankPredict(accountId, options = {}) {
  return loadPlayerRank(accountId, options);
}

export function loadPlayerRankPredictImage(accountId, format, options = {}) {
  return getPlayerRankPredictImage(accountId, format, options);
}

export function loadPlayerRankPredictBatchImage(accountIds, format, options = {}) {
  return getPlayerRankPredictBatchImage(accountIds, format, options);
}

export function buildPlayerRankHistoryViewModel(matchHistory) {
  const rows = Array.isArray(matchHistory)
    ? matchHistory
    : asArray(matchHistory?.data);

  return rows
    .filter(match => match?.ranked_display_badge != null)
    .map(match => ({
      matchId: match.match_id ?? null,
      startTime: match.start_time ?? null,
      heroId: match.hero_id ?? null,
      badge: match.ranked_display_badge,
      delta: match.ranked_delta ?? null,
      calibrationMatch: match.ranked_calibration_match ?? null,
      usedDemotionProtection: match.ranked_used_demotion_protection ?? null,
      raw: match,
    }))
    .sort((a, b) => Number(a.startTime ?? 0) - Number(b.startTime ?? 0));
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
