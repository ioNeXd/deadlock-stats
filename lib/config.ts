export const API_BASE = 'https://api.deadlock-api.com'
export const ASSET_CDN = 'https://assets-bucket.deadlock-api.com'
export const API_SPONSOR_URL = 'https://github.com/deadlock-api/deadlock-api'

export const GAME_MODE = 'normal' as const

/** Rank bands as ranges of `average_badge` (badge = tier * 10 + subrank). Single source of truth. */
export const RANK_BANDS = [
  { id: 'all', min: 0, max: 116, tiers: [0, 11] },
  { id: 'initiate-acolyte', min: 10, max: 36, tiers: [1, 3] },
  { id: 'sentinel-ritualist', min: 40, max: 66, tiers: [4, 6] },
  { id: 'emissary-phantom', min: 70, max: 96, tiers: [7, 9] },
  { id: 'ascendant-eternus', min: 100, max: 116, tiers: [10, 11] },
] as const

export type RankBand = (typeof RANK_BANDS)[number]
export type RankBandId = RankBand['id']
export const DEFAULT_BAND: RankBand = RANK_BANDS[0]

/** Rows below this sample are shown without a tier ("low data"). API default is 20. */
export const MIN_MATCHES = { heroes: 1000, items: 1000 } as const

/** Cumulative quantile cutoffs, top to bottom. Keeps the letter distribution stable between patches. */
export const TIER_CUTOFFS = [
  ['S', 0.1],
  ['A', 0.3],
  ['B', 0.6],
  ['C', 0.8],
  ['D', 0.92],
  ['F', 1],
] as const

/** Weight of (log) pick rate in the composite score; win rate gets the rest. */
export const PICK_WEIGHT = 0.25

/**
 * Manual exceptions for `/v1/patches/big-days`, which is hand-maintained and can lag.
 * [validate] exact start time of build 6712 against the forum post `pub_date`.
 */
export const PATCH_OVERRIDES = [{ datetime: '2026-09-29T00:00:00Z', note: 'Build 6712' }] as const

export const PATCH_WINDOW_COUNT = 3
export const STATS_FRESHNESS_MS = 6 * 60 * 60 * 1000
export const SNAPSHOT_SCHEMA_VERSION = 1

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** For raw URLs (fetch, metadata). `next/link` already applies basePath. */
export function withBase(path: string) {
  return `${BASE_PATH}${path}`
}
