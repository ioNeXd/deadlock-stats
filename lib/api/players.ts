import type { components } from './schema'
import { apiGet } from './client'

type Schemas = components['schemas']
export type SteamProfile = Schemas['SteamProfile']
export type PlayerRank = Schemas['RankResponse']
export type PlayerMatch = Schemas['PlayerMatchHistoryEntry']
export type PlayerMate = Schemas['MateStats']
export type PlayerEnemy = Schemas['EnemyStats']

/** Fetch cached Steam profiles for match participants by account ID. */
export function fetchSteamProfiles(accountIds: number[]) {
  const uniqueIds = [...new Set(accountIds)].filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 100)
  if (!uniqueIds.length) return Promise.resolve([] as SteamProfile[])
  return apiGet<SteamProfile[]>('/v1/players/steam', { account_ids: uniqueIds })
}

/** Search public Steam profiles by persona name or SteamID3. */
export function searchPlayers(query: string) {
  return apiGet<SteamProfile[]>('/v1/players/steam-search', {
    search_query: query.trim(),
    limit: 12,
    min_matches_played_last_30d: 0,
  })
}

/** Player rank reported by Valve after the latest ranked match. */
export function fetchPlayerRank(accountId: number) {
  return apiGet<PlayerRank>(`/v1/players/${accountId}/rank`)
}

/** Stored match history; intentionally does not force a Steam refetch. */
export function fetchPlayerMatchHistory(accountId: number) {
  return apiGet<PlayerMatch[]>(`/v1/players/${accountId}/match-history`)
}

export function fetchPlayerMates(accountId: number) {
  return apiGet<PlayerMate[]>(`/v1/players/${accountId}/mate-stats`, { game_mode: 'normal' })
}

export function fetchPlayerEnemies(accountId: number) {
  return apiGet<PlayerEnemy[]>(`/v1/players/${accountId}/enemy-stats`, { game_mode: 'normal' })
}
