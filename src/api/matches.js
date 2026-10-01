import { apiGet } from "./client.js";

export function getActiveMatches(options = {}) {
  return apiGet("/v1/matches/active", options);
}

export function getRecentlyFetchedMatches(options = {}) {
  return apiGet("/v1/matches/recently-fetched", options);
}

export function getMatchMetadata(matchId, options = {}) {
  return apiGet(`/v1/matches/${encodeURIComponent(matchId)}/metadata`, options);
}

export function getMatchSalts(matchId, options = {}) {
  return apiGet(`/v1/matches/${encodeURIComponent(matchId)}/salts`, options);
}

export function getBulkMatchMetadata(options = {}) {
  return apiGet("/v1/matches/metadata", options);
}
