import type { Locale } from '@/lib/i18n/config'
import { formatCompact, formatPercent } from '@/lib/format'
import type { HeroBuildSections, HeroBuildView } from '@/lib/api/builds'

export function HeroBuilds({
  locale,
  sections,
}: {
  locale: Locale
  sections: HeroBuildSections
}) {
  const t = locale === 'pt-br'
    ? {
        popular: 'Builds populares',
        winRate: 'Maior winrate',
        matches: 'partidas',
        players: 'jogadores',
        items: 'Itens',
        skillPath: 'Skill path',
        empty: 'Nenhuma build disponível para este período.',
      }
    : {
        popular: 'Popular builds',
        winRate: 'Highest win rate',
        matches: 'matches',
        players: 'players',
        items: 'Items',
        skillPath: 'Skill path',
        empty: 'No builds available for this period.',
      }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BuildSection title={t.popular} locale={locale} builds={sections.popular} labels={t} />
      <BuildSection title={t.winRate} locale={locale} builds={sections.highestWinRate} labels={t} />
    </div>
  )
}

function BuildSection({
  title,
  locale,
  builds,
  labels,
}: {
  title: string
  locale: Locale
  builds: HeroBuildView[]
  labels: { matches: string; players: string; items: string; skillPath: string; empty: string }
}) {
  return (
    <section className="border border-border/70 bg-card/40 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)] md:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">{title}</h2>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Top 3</span>
      </div>

      {builds.length > 0 ? (
        <div className="space-y-3">
          {builds.map((build, index) => (
            <BuildCard key={build.id} build={build} index={index} locale={locale} labels={labels} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      )}
    </section>
  )
}

function BuildCard({
  build,
  index,
  locale,
  labels,
}: {
  build: HeroBuildView
  index: number
  locale: Locale
  labels: { matches: string; players: string; items: string; skillPath: string }
}) {
  return (
    <article className="border border-border/60 bg-background/45 p-4">
      <div className="flex items-start gap-3">
        <span className="font-display text-2xl font-bold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-foreground">{build.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">ID {build.id}</p>
            </div>
            <div className="text-right tabular-nums">
              <div className="font-display text-xl font-semibold text-foreground">{formatPercent(build.winRate, locale)}</div>
              <div className="text-xs text-muted-foreground">win rate</div>
            </div>
          </div>

          {build.description ? <p className="mt-3 text-sm text-muted-foreground">{build.description}</p> : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
            <span><strong className="font-semibold text-foreground">{formatCompact(build.popularity, locale)}</strong> {labels.matches}</span>
            <span><strong className="font-semibold text-foreground">{formatCompact(build.players, locale)}</strong> {labels.players}</span>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labels.items}</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {build.items.length > 0 ? build.items.map((item) => (
                <span key={`${item.category}-${item.id}`} className="inline-flex items-center gap-2 border border-border/60 bg-card px-2 py-1 text-xs text-foreground">
                  {item.icon ? <img src={item.icon} alt="" width={24} height={24} className="size-6 object-contain" /> : null}
                  <span>{item.name}</span>
                </span>
              )) : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labels.skillPath}</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {build.skillPath.length > 0 ? build.skillPath.map((skill, skillIndex) => (
                <span key={`${skill.id}-${skillIndex}`} className="inline-flex items-center gap-2 border border-border/60 bg-card px-2 py-1 text-xs text-foreground">
                  <span className="font-mono text-muted-foreground">{skillIndex + 1}</span>
                  {skill.icon ? <img src={skill.icon} alt="" width={24} height={24} className="size-6 object-contain" /> : null}
                  <span>{skill.name}</span>
                  {skill.delta > 0 ? <span className="text-muted-foreground">+{skill.delta}</span> : null}
                </span>
              )) : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
