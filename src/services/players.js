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
