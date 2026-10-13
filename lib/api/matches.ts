import { apiGet } from './client'

/** The OpenAPI contract documents the parsed protobuf response but has no JSON body schema. */
export function fetchMatchMetadata(matchId: number) {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) return Promise.reject(new Error('Invalid match ID'))
  return apiGet<unknown>(`/v1/matches/${matchId}/metadata`, { disable_steam: true })
}
