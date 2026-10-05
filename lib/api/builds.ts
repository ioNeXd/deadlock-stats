import { GAME_MODE } from '@/lib/config'
import { getItemTooltipBackers, getItems } from './assets'
import { apiGet } from './client'
import type { Locale } from '@/lib/i18n/config'
import type { HeroEntity, ItemAsset, ItemSlot } from './types'
import type { components } from './schema'

type Build = components['schemas']['Build']
type HeroBuildStats = components['schemas']['HeroBuildStats']

const BUILD_STATS_FETCH = { next: { revalidate: 21600 } } satisfies RequestInit
const BUILD_DETAIL_FETCH = { next: { revalidate: 86400 } } satisfies RequestInit
const MIN_BUILD_MATCHES = 20

export interface HeroBuildItem {
  id: number
  name: string
  icon: string | null
  category: string
  slot: 'weapon' | 'vitality' | 'spirit'
  isActive: boolean
  isImbued: boolean
  backer: { backer: { png: string; webp: string }; color: { png: string; webp: string }; mask: { png: string; webp: string } } | null
}

export interface HeroBuildSkill {
  id: number
  name: string
  icon: string | null
  annotation: string | null
  delta: number
}

export interface HeroBuildView {
  id: number
  name: string
  description: string | null
  wins: number
  matches: number
  players: number
  winRate: number
  popularity: number
  items: HeroBuildItem[]
  skillPath: HeroBuildSkill[]
}

export interface HeroBuildSections {
  popular: HeroBuildView[]
  highestWinRate: HeroBuildView[]
}

function toView(
  stat: HeroBuildStats,
  build: Build,
  items: Map<number, { name: string; icon: string | null; slot: 'weapon' | 'vitality' | 'spirit'; isActive: boolean; isImbued: boolean }>,
  abilities: Map<number, { name: string; icon: string | null }>,
  tooltipBackers: Record<ItemSlot, { backer: { png: string; webp: string }; color: { png: string; webp: string }; mask: { png: string; webp: string } }> | null,
): HeroBuildView {
  const details = build.hero_build.details
  const buildItems: HeroBuildItem[] = []
  const seenItems = new Set<number>()

  for (const category of details.mod_categories) {
    for (const mod of category.mods ?? []) {
      const id = mod.ability_id
      if (seenItems.has(id)) continue
      const asset = items.get(id)
      if (!asset) continue
      seenItems.add(id)
      buildItems.push({
        id,
        name: asset.name,
        icon: asset.icon,
        category: category.name,
        slot: asset.slot,
        isActive: asset.isActive,
        isImbued: asset.isImbued,
        backer: tooltipBackers?.[asset.slot] ?? null,
      })
    }
  }

  const skillPath = (details.ability_order?.currency_changes ?? []).map((entry) => {
    const ability = abilities.get(entry.ability_id)
    return {
      id: entry.ability_id,
      name: ability?.name ?? `Ability #${entry.ability_id}`,
      icon: ability?.icon ?? null,
      annotation: entry.annotation ?? null,
      delta: entry.delta,
    }
  })

  return {
    id: stat.hero_build_id,
    name: build.hero_build.name,
    description: build.hero_build.description ?? null,
    wins: stat.wins,
    matches: stat.matches,
    players: stat.players,
    winRate: stat.matches > 0 ? stat.wins / stat.matches : 0,
    popularity: stat.matches,
    items: buildItems,
    skillPath,
  }
}

async function fetchHeroBuildStats(heroId: number, start?: number): Promise<HeroBuildStats[]> {
  return apiGet<HeroBuildStats[]>(
    `/v1/analytics/hero-build-stats/${heroId}`,
    {
      game_mode: GAME_MODE,
      min_unix_timestamp: start,
      min_matches: MIN_BUILD_MATCHES,
    },
    BUILD_STATS_FETCH,
  )
}

async function fetchBuild(heroId: number, buildId: number): Promise<Build> {
  return apiGet<Build>(`/v1/builds/${heroId}/${buildId}`, {}, BUILD_DETAIL_FETCH)
}

async function getAbilityAssets(locale: Locale, heroId: number) {
  const API_LANGUAGE = locale === 'pt-br' ? 'brazilian' : 'english'
  const abilities = await apiGet<ItemAsset[]>(
    `/v1/assets/items/by-hero-id/${heroId}`,
    { language: API_LANGUAGE },
    { next: { revalidate: 86400 } },
  )
  const result = new Map<number, { name: string; icon: string | null }>()
  for (const item of abilities) {
    const raw = item as unknown as Record<string, unknown>
    const id = Number(raw.id)
    if (!Number.isFinite(id)) continue
    result.set(id, {
      name: String(raw.name ?? raw.class_name ?? id),
      icon: (raw.image_webp ?? raw.image ?? null) as string | null,
    })
  }
  return result
}

export async function getHeroBuildSections(
  hero: HeroEntity,
  locale: Locale,
  start?: number,
): Promise<HeroBuildSections> {
  const [stats, items, abilities, tooltipBackers] = await Promise.all([
    fetchHeroBuildStats(hero.id, start),
    getItems(locale),
    getAbilityAssets(locale, hero.id),
    getItemTooltipBackers(),
  ])

  const itemMap = new Map(items.map((item) => [item.id, { name: item.name, icon: item.icon, slot: item.slot, isActive: item.isActive, isImbued: item.isImbued }]))

  const popularStats = [...stats]
    .sort((a, b) => b.matches - a.matches || b.players - a.players || b.hero_build_id - a.hero_build_id)
    .slice(0, 3)

  const highestWinRateStats = [...stats]
    .sort((a, b) => {
      const aRate = a.matches > 0 ? a.wins / a.matches : 0
      const bRate = b.matches > 0 ? b.wins / b.matches : 0
      return bRate - aRate || b.matches - a.matches || b.hero_build_id - a.hero_build_id
    })
    .slice(0, 3)

  const detailIds = [...new Set([...popularStats, ...highestWinRateStats].map((stat) => stat.hero_build_id))]
  const details = await Promise.all(
    detailIds.map(async (buildId) => {
      try {
        return [buildId, await fetchBuild(hero.id, buildId)] as const
      } catch {
        return null
      }
    }),
  )
  const detailMap = new Map(details.filter((entry): entry is readonly [number, Build] => entry !== null))

  const makeViews = (rows: HeroBuildStats[]) =>
    rows.flatMap((stat) => {
      const build = detailMap.get(stat.hero_build_id)
      return build ? [toView(stat, build, itemMap, abilities, tooltipBackers)] : []
    })

  return {
    popular: makeViews(popularStats),
    highestWinRate: makeViews(highestWinRateStats),
  }
}
