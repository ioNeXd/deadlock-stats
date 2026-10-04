import { GAME_MODE, SNAPSHOT_SCHEMA_VERSION } from '@/lib/config'
import { apiGet } from './client'
import type { HeroStatsQuery, HeroStatsRow, ItemStatsQuery, ItemStatsRow, PatchWindow, StatsSnapshot } from './types'

export const STATS_FETCH = { next: { revalidate: 21600 } } satisfies RequestInit

/** Fetches hero and item stats for one patch window and rank band, normalized to the snapshot format. */
export async function fetchTierStats(
  window: PatchWindow,
  band: { id: string; min: number; max: number },
  init?: RequestInit,
): Promise<StatsSnapshot> {
  const base = {
    game_mode: GAME_MODE,
    min_unix_timestamp: window.start,
    max_unix_timestamp: window.end ?? undefined,
    min_average_badge: band.min,
    max_average_badge: band.max,
  } satisfies HeroStatsQuery
  const itemQuery = { ...base, corrupted_items: 'exclude' } satisfies ItemStatsQuery

  const [heroes, items] = await Promise.all([
    apiGet<HeroStatsRow[]>('/v1/analytics/hero-stats', base, init),
    apiGet<ItemStatsRow[]>('/v1/analytics/item-stats', itemQuery, init),
  ])

  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source: 'tier_stats',
    patch: window.id,
    band: band.id,
    window: { start: window.start, end: window.end },
    filters: {
      game_mode: GAME_MODE,
      min_average_badge: band.min,
      max_average_badge: band.max,
      corrupted_items: 'exclude',
    },
    heroes: {
      columns: ['hero_id', 'wins', 'losses', 'matches'],
      rows: heroes.map((r) => [r.hero_id, r.wins, r.losses, r.matches]),
    },
    items: {
      columns: ['item_id', 'wins', 'losses', 'matches', 'players'],
      rows: items.map((r) => [r.item_id, r.wins, r.losses, r.matches, r.players]),
    },
  }
}
