import { fetchTierStats, STATS_FETCH } from '@/lib/api/analytics'
import { getHeroes, getItems, getRanks } from '@/lib/api/assets'
import { getPatchWindows } from '@/lib/api/patches'
import type { RankEntity } from '@/lib/api/types'
import { DEFAULT_BAND, MIN_MATCHES, RANK_BANDS } from '@/lib/config'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { computeTierRows } from '@/lib/tiers'
import type { ReactNode } from 'react'
import type { BandOption } from '@/components/tier/filter-bar'
import { TierListView } from '@/components/tier/tier-list-view'
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

export async function TierPage({ locale, kind }: { locale: Locale; kind: 'heroes' | 'items' }) {
  const t = getDictionary(locale)
  const [windows, ranks] = await Promise.all([getPatchWindows(), getRanks(locale).catch(() => [])])
  const bands = buildBandOptions(ranks, t.filters.allRanks)
  const initialSnapshot = windows[0]
    ? await fetchTierStats(windows[0], DEFAULT_BAND, STATS_FETCH).catch(() => null)
    : null

  let tierListView: ReactNode

  if (kind === 'heroes') {
    const entities = await getHeroes(locale)
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
    const initialRows = initialSnapshot
      ? computeTierRows(initialSnapshot, 'heroes', entityMap, MIN_MATCHES.heroes)
      : []

    tierListView = (
      <TierListView
        kind="heroes"
        entities={entities}
        locale={locale}
        windows={windows}
        bands={bands}
        initialSnapshot={initialSnapshot}
        initialRows={initialRows}
      />
    )
  } else {
    const entities = await getItems(locale)
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
    const initialRows = initialSnapshot
      ? computeTierRows(initialSnapshot, 'items', entityMap, MIN_MATCHES.items)
      : []

    tierListView = (
      <TierListView
        kind="items"
        entities={entities}
        locale={locale}
        windows={windows}
        bands={bands}
        initialSnapshot={initialSnapshot}
        initialRows={initialRows}
      />
    )
  }

  const strings = kind === 'heroes' ? t.heroes : t.items

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} lede={strings.lede} />
      {tierListView}
    </main>
  )
}
