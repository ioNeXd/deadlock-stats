import { fetchTierStats, STATS_FETCH } from '@/lib/api/analytics'
import { getHeroes, getItems, getRanks, getTierListBackground } from '@/lib/api/assets'
import { getPatchWindows } from '@/lib/api/patches'
import type { RankEntity } from '@/lib/api/types'
import { DEFAULT_BAND, MIN_MATCHES, RANK_BANDS } from '@/lib/config'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { computeTierRows } from '@/lib/tiers'
import type { BandOption } from '@/components/tier/filter-bar'
import { RankBandTheme } from '@/components/tier/rank-band-theme'
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
    return {
      id: band.id,
      min: band.min,
      max: band.max,
      label,
      startColor: byTier.get(low)?.color ?? null,
      endColor: byTier.get(high)?.color ?? null,
    }
  })
}

export async function TierListPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const [windows, ranks, entities, background] = await Promise.all([
    getPatchWindows(),
    getRanks(locale).catch(() => []),
    Promise.all([getHeroes(locale), getItems(locale)]),
    getTierListBackground().catch(() => null),
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
    <>
      {background ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <div className="absolute inset-0 bg-background/80" />
        </div>
      ) : null}
      <main id="main" className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
        <RankBandTheme bands={bands}>
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
        </RankBandTheme>
      </main>
    </>
  )
}
