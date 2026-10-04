import type { components, operations } from './schema'

type Schemas = components['schemas']

export type HeroAsset = Schemas['Hero']
export type ItemAsset = Schemas['Item']
export type RankAsset = Schemas['Rank']
export type ApiInfo = Schemas['APIInfo']
export type HeroStatsRow = Schemas['AnalyticsHeroStats']
export type ItemStatsRow = Schemas['ItemStats']
export type HeroStatsQuery = NonNullable<operations['hero_stats']['parameters']['query']>
export type ItemStatsQuery = NonNullable<operations['item_stats']['parameters']['query']>

export type ItemSlot = 'weapon' | 'vitality' | 'spirit'

export interface HeroEntity {
  id: number
  name: string
  icon: string | null
  /** "r g b" from `colors.ui`, used as a CSS variable. */
  color: string | null
}

export interface ItemEntity {
  id: number
  name: string
  icon: string | null
  slot: ItemSlot
  tier: number
  cost: number
}

export interface RankEntity {
  tier: number
  name: string
  icon: string | null
  /** API-provided hex color for this rank tier. */
  color: string | null
}

export interface PatchWindow {
  id: string
  start: number
  end: number | null
  source: 'big-days' | 'override'
}

export interface StatsSnapshot {
  schema_version: number
  generated_at: string
  source: 'tier_stats'
  patch: string
  band: string
  window: { start: number; end: number | null }
  filters: {
    game_mode: string
    min_average_badge: number
    max_average_badge: number
    corrupted_items: 'exclude'
  }
  heroes: { columns: ['hero_id', 'wins', 'losses', 'matches']; rows: number[][] }
  items: { columns: ['item_id', 'wins', 'losses', 'matches', 'players']; rows: number[][] }
}
