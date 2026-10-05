import { ASSET_CDN } from '@/lib/config'
import type { Locale } from '@/lib/i18n/config'
import { apiGet } from './client'
import type { HeroAsset, HeroEntity, ItemAsset, ItemEntity, ItemSlot, RankAsset, RankEntity } from './types'

const API_LANGUAGE: Record<Locale, string> = { en: 'english', 'pt-br': 'brazilian' }
const ASSET_CACHE = { next: { revalidate: 86400 } } satisfies RequestInit

const memo = new Map<string, Promise<unknown>>()
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit) return hit as Promise<T>
  const pending = load().catch((error) => {
    memo.delete(key)
    throw error
  })
  memo.set(key, pending)
  return pending
}

function collectAlleyImages(value: unknown, key = '', result: string[] = []): string[] {
  if (result.length >= 3) return result
  if (typeof value === 'string') {
    if (key.toLowerCase().includes('alley') || value.toLowerCase().includes('/alley')) {
      try {
        const url = new URL(value)
        const cdn = new URL(ASSET_CDN)
        if (url.protocol === 'https:' && url.origin === cdn.origin) result.push(url.toString())
      } catch {
        // Ignore malformed or non-CDN entries from the public asset index.
      }
    }
    return result
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAlleyImages(item, key, result)
    return result
  }
  for (const [childKey, childValue] of Object.entries(value)) {
    collectAlleyImages(childValue, childKey, result)
    if (result.length >= 3) break
  }
  return result
}

export function getAlleyBackground(): Promise<string | null> {
  return once('assets:latest:images:alley', async () => {
    const index = await apiGet<unknown>('/v1/assets/images', {}, ASSET_CACHE)
    if (!index || typeof index !== 'object') return null
    const images = collectAlleyImages(index as ImageIndex)
    const preferred = images.find((url) => /\.webp(?:$|[?#])/i.test(url))
    return preferred ?? images[0] ?? null
  })
}

export function getHeroes(locale: Locale): Promise<HeroEntity[]> {
  return once(`assets:latest:heroes:${locale}`, async () => {
    const heroes = await apiGet<HeroAsset[]>(
      '/v1/assets/heroes',
      { language: API_LANGUAGE[locale], only_active: true },
      ASSET_CACHE,
    )
    return heroes
      .filter((hero) => hero.player_selectable && !hero.disabled && !hero.in_development)
      .map((hero) => ({
        id: hero.id,
        name: hero.name,
        icon: hero.images.icon_image_small_webp ?? hero.images.icon_image_small ?? null,
        color: hero.colors?.ui ? hero.colors.ui.join(' ') : null,
      }))
  })
}

const SLOTS: ItemSlot[] = ['weapon', 'vitality', 'spirit']

export function getItems(locale: Locale): Promise<ItemEntity[]> {
  return once(`assets:latest:items:${locale}`, async () => {
    // Response is ~2 MB, above the Next data-cache limit; memoized per process instead.
    const items = await apiGet<ItemAsset[]>(
      '/v1/assets/items/by-type/upgrade',
      { language: API_LANGUAGE[locale] },
      ASSET_CACHE,
    )
    const result: ItemEntity[] = []
    for (const item of items) {
      const raw = item as unknown as Record<string, unknown>
      const slot = raw.item_slot_type as ItemSlot
      if (!raw.shopable || raw.disabled || !SLOTS.includes(slot)) continue
      result.push({
        id: Number(raw.id),
        name: String(raw.name),
        icon: (raw.shop_image_small_webp ?? raw.shop_image_webp ?? raw.image_webp ?? raw.image ?? null) as string | null,
        slot,
        tier: Number(raw.item_tier ?? 0),
        cost: Number(raw.cost ?? 0),
      })
    }
    return result
  })
}

function normalizeRankColor(color: string): string | null {
  const value = color.trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null
}

export function getRanks(locale: Locale): Promise<RankEntity[]> {
  return once(`assets:latest:ranks:${locale}`, async () => {
    const ranks = await apiGet<RankAsset[]>('/v1/assets/ranks', { language: API_LANGUAGE[locale] }, ASSET_CACHE)
    return ranks.map((rank) => {
      const images = rank.images as unknown as Record<string, string | undefined>
      return {
        tier: rank.tier,
        name: rank.name,
        icon: images.small_webp ?? images.small_subrank1_webp ?? images.large_webp ?? null,
        color: normalizeRankColor(rank.color),
      }
    })
  })
}
