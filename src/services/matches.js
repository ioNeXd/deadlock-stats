import { getActiveMatches, getRecentlyFetchedMatches, getMatchMetadata, getMatchSalts, getBulkMatchMetadata } from "../api/matches.js";

function rows(result) {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
}

export function normalizeMatchInfo(result) {
  return rows(result).map(match => ({
    matchId: match?.match_id ?? null,
    startTime: match?.start_time ?? null,
    durationS: match?.duration_s ?? null,
    matchMode: match?.match_mode ?? null,
    gameMode: match?.game_mode ?? null,
    averageBadge: match?.average_badge ?? null,
    averageBadgeTeam0: match?.average_badge_team0 ?? null,
    averageBadgeTeam1: match?.average_badge_team1 ?? null,
    players: Array.isArray(match?.players) ? match.players : [],
    raw: match,
  }));
}

export function normalizeMatchMetadata(result) {
  return result?.data ? result.data : result;
}

export async function getActiveMatchesSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  return normalizeMatchInfo(await getActiveMatches({ ...requestOptions, signal }));
}

export async function getRecentlyFetchedMatchesSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  return normalizeMatchInfo(await getRecentlyFetchedMatches({ ...requestOptions, signal }));
}

export async function getMatchMetadataSnapshot(matchId, options = {}) {
  const { signal, ...requestOptions } = options;
  return normalizeMatchMetadata(await getMatchMetadata(matchId, { ...requestOptions, signal }));
}

export async function getMatchSaltsSnapshot(matchId, options = {}) {
  const { signal, ...requestOptions } = options;
  return getMatchSalts(matchId, { ...requestOptions, signal });
}

export async function getBulkMatchMetadataSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  return getBulkMatchMetadata({ ...requestOptions, signal });
}
