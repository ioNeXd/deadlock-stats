import { fetchTierStats, STATS_FETCH } from '@/lib/api/analytics'
import { getHeroes, getItems, getRanks } from '@/lib/api/assets'
import { getPatchWindows } from '@/lib/api/patches'
import type { RankEntity } from '@/lib/api/types'
import { DEFAULT_BAND, MIN_MATCHES, RANK_BANDS } from '@/lib/config'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { computeTierRows } from '@/lib/tiers'
import type { BandOption } from '@/components/tier/filter-bar'
import { TierListSwitcher } from '@/components/tier/tier-list-switcher'
import { PageHeader } from './page-header'

export function buildBandOptions(ranks: RankEntity[], allLabel: string): BandOption[] {
  const byTier = new Map(ranks.map((r) => [r.tier, r]))
  return RANK_BANDS.map((band) => {
    const [low, high] = band.tiers
    const label =
      band.id === 'all'
        ? allLabel
        : `${byTier.get(low)?.name ?? low} – ${byTier.get(high)?.name ?? high}`
    return { id: band.id, min: band.min, max: band.max, label }
  })
}

export async function TierListPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const [windows, ranks, entities] = await Promise.all([
    getPatchWindows(),
    getRanks(locale).catch(() => []),
    Promise.all([getHeroes(locale), getItems(locale)]),
  ])
  const bands = buildBandOptions(ranks, t.filters.allRanks)
  const initialSnapshot = windows[0]
    ? await fetchTierStats(windows[0], DEFAULT_BAND, STATS_FETCH).catch(() => null)
    : null

  const [heroes, items] = entities
  const heroMap = new Map(heroes.map((entity) => [entity.id, entity]))
  const itemMap = new Map(items.map((entity) => [entity.id, entity]))
  const heroRows = initialSnapshot
    ? computeTierRows(initialSnapshot, 'heroes', heroMap, MIN_MATCHES.heroes)
    : []
  const itemRows = initialSnapshot
    ? computeTierRows(initialSnapshot, 'items', itemMap, MIN_MATCHES.items)
    : []

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
      <PageHeader eyebrow={t.tierList.eyebrow} title={t.tierList.title} lede={t.tierList.lede} />
      <TierListSwitcher
        locale={locale}
        windows={windows}
        bands={bands}
        initialSnapshot={initialSnapshot}
        heroes={heroes}
        items={items}
        heroRows={heroRows}
        itemRows={itemRows}
      />
    </main>
  )
}
