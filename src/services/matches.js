import {
  getActiveMatches,
  getActiveMatchesRaw,
  getRecentlyFetchedMatches,
  getMatchMetadata,
  getRawMatchMetadata,
  getMatchLiveUrl,
  getMatchSalts,
  getBulkMatchMetadata,
  createCustomMatch,
  leaveCustomMatch,
  readyCustomMatch,
  startCustomMatch,
  unreadyCustomMatch,
  getCustomMatchId,
  getLiveQuery,
  submitDemoQuery,
  getDemoQueryStatus,
  getDemoSchema,
  getLiveUrls,
  ingestLiveUrls,
  ingestMatchSalts,
} from "../api/matches.js";

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
    winningTeam: match?.winning_team ?? null,
    netWorthTeam0: match?.net_worth_team_0 ?? null,
    netWorthTeam1: match?.net_worth_team_1 ?? null,
    objectivesMaskTeam0: match?.objectives_mask_team0 ?? null,
    objectivesMaskTeam1: match?.objectives_mask_team1 ?? null,
    lobbyId: match?.lobby_id ?? null,
    spectators: match?.spectators ?? null,
    openSpectatorSlots: match?.open_spectator_slots ?? null,
    players: Array.isArray(match?.players) ? match.players : [],
    raw: match,
  }));
}

export function normalizeMatchMetadata(result) {
  if (result && Object.prototype.hasOwnProperty.call(result, "data")) return result.data;
  return result;
}

async function passthrough(loader, options = {}) {
  const { signal, ...requestOptions } = options;
  return loader({ ...requestOptions, signal });
}

export async function getActiveMatchesSnapshot(options = {}) {
  return normalizeMatchInfo(await passthrough(getActiveMatches, options));
}

export async function getRecentlyFetchedMatchesSnapshot(options = {}) {
  return normalizeMatchInfo(await passthrough(getRecentlyFetchedMatches, options));
}

export async function getMatchMetadataSnapshot(matchId, options = {}) {
  return normalizeMatchMetadata(await getMatchMetadata(matchId, options));
}

export async function getRawMatchMetadataSnapshot(matchId, options = {}) {
  return getRawMatchMetadata(matchId, options);
}

export async function getActiveMatchesRawSnapshot(options = {}) {
  return passthrough(getActiveMatchesRaw, options);
}

export async function getMatchLiveUrlSnapshot(matchId, options = {}) {
  return getMatchLiveUrl(matchId, options);
}

export async function getMatchSaltsSnapshot(matchId, options = {}) {
  return getMatchSalts(matchId, options);
}

export async function getBulkMatchMetadataSnapshot(options = {}) {
  return normalizeMatchMetadata(await getBulkMatchMetadata(options));
}

export function createCustomMatchSnapshot(body, options = {}) {
  return createCustomMatch(body, options);
}

export function leaveCustomMatchSnapshot(lobbyId, options = {}) {
  return leaveCustomMatch(lobbyId, options);
}

export function readyCustomMatchSnapshot(lobbyId, options = {}) {
  return readyCustomMatch(lobbyId, options);
}

export function startCustomMatchSnapshot(lobbyId, options = {}) {
  return startCustomMatch(lobbyId, options);
}

export function unreadyCustomMatchSnapshot(lobbyId, options = {}) {
  return unreadyCustomMatch(lobbyId, options);
}

export function getCustomMatchIdSnapshot(partyId, options = {}) {
  return getCustomMatchId(partyId, options);
}

export function getLiveQuerySnapshot(options = {}) {
  return getLiveQuery(options);
}

export function submitDemoQuerySnapshot(body, options = {}) {
  return submitDemoQuery(body, options);
}

export function getDemoQueryStatusSnapshot(jobId, options = {}) {
  return getDemoQueryStatus(jobId, options);
}

export function getDemoSchemaSnapshot(matchId, options = {}) {
  return getDemoSchema(matchId, options);
}

export function getLiveUrlsSnapshot(options = {}) {
  return getLiveUrls(options);
}

export function ingestLiveUrlsSnapshot(body, options = {}) {
  return ingestLiveUrls(body, options);
}

export function ingestMatchSaltsSnapshot(body, options = {}) {
  return ingestMatchSalts(body, options);
}
