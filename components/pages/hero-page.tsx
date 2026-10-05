import { fetchTierStats, STATS_FETCH } from '@/lib/api/analytics'
import { getHeroes } from '@/lib/api/assets'
import { getPatchWindows } from '@/lib/api/patches'
import { DEFAULT_BAND, MIN_MATCHES } from '@/lib/config'
import { formatCompact, formatPercent } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { computeTierRows } from '@/lib/tiers'
import { ContextStrip } from '@/components/tier/context-strip'
import { TierBadge } from '@/components/tier/tier-badge'
import { PageHeader } from './page-header'

export async function HeroPage({ locale, id }: { locale: Locale; id: number }) {
  const t = getDictionary(locale)
  const [heroes, windows] = await Promise.all([getHeroes(locale), getPatchWindows()])
  const hero = heroes.find((entity) => entity.id === id)

  if (!hero) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
        <PageHeader eyebrow={t.heroPage.eyebrow} title={t.heroPage.notFound} lede={t.heroPage.lede} />
      </main>
    )
  }

  const window = windows[0]
  const snapshot = window ? await fetchTierStats(window, DEFAULT_BAND, STATS_FETCH).catch(() => null) : null
  const heroMap = new Map(heroes.map((entity) => [entity.id, entity]))
  const row = snapshot ? computeTierRows(snapshot, 'heroes', heroMap, MIN_MATCHES.heroes).find((entry) => entry.id === hero.id) : undefined
  const periodLabel = window
    ? window.end
      ? `${new Date(window.start * 1000).toLocaleDateString(locale === 'pt-br' ? 'pt-BR' : 'en-US')} – ${new Date(window.end * 1000).toLocaleDateString(locale === 'pt-br' ? 'pt-BR' : 'en-US')}`
      : new Date(window.start * 1000).toLocaleDateString(locale === 'pt-br' ? 'pt-BR' : 'en-US')
    : '—'
  const statsResult = snapshot ? { snapshot, source: 'live' as const } : undefined

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
      <PageHeader eyebrow={t.heroPage.eyebrow} title={hero.name} lede={t.heroPage.lede} />

      <section className="rank-band-theme flex flex-col gap-6 border border-border/70 bg-card/40 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:px-6 md:py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-sm bg-muted md:size-28">
            {hero.icon ? <img src={hero.icon} alt="" width={112} height={112} className="size-full object-contain" /> : null}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-foreground md:text-4xl">{hero.name}</h2>
            {row ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-muted-foreground">
                {row.tier ? <TierBadge tier={row.tier} label={interpolate(t.tierLabel, { tier: row.tier })} /> : null}
                <span>{t.heroPage.winRate} {formatPercent(row.smoothed, locale)}</span>
                <span>{t.heroPage.pickRate} {formatPercent(row.pickRate, locale)}</span>
                <span>{t.heroPage.sample} {formatCompact(row.matches, locale)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {row ? (
          <div className="grid gap-px border border-border/60 bg-border/60 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label={t.heroPage.kda} value={row.kda?.toFixed(2) ?? '—'} />
            <Metric label={t.heroPage.avgKills} value={row.avgKills?.toFixed(2) ?? '—'} />
            <Metric label={t.heroPage.avgAssists} value={row.avgAssists?.toFixed(2) ?? '—'} />
            <Metric label={t.heroPage.avgDeaths} value={row.avgDeaths?.toFixed(2) ?? '—'} />
            <Metric label={t.heroPage.avgDamage} value={formatCompact(row.avgDamage ?? 0, locale)} />
            <Metric label={t.heroPage.avgNetWorth} value={formatCompact(row.avgNetWorth ?? 0, locale)} />
          </div>
        ) : null}

        <ContextStrip locale={locale} periodLabel={periodLabel} bandLabel={t.filters.allRanks} result={statsResult} loading={false} />
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}