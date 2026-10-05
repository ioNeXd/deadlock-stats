import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { formatCompact, formatPercent } from '@/lib/format'
import type { HeroBuildSections, HeroBuildView } from '@/lib/api/builds'

export function HeroBuilds({
  locale,
  sections,
  labels,
}: {
  locale: Locale
  sections: HeroBuildSections
  labels: Dictionary['heroPage']['builds']
}) {
  const t: Dictionary['heroPage']['builds'] = labels


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
  labels: Dictionary['heroPage']['builds']
}) {
  return (
    <section className="border border-border/70 bg-card/40 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)] md:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">{title}</h2>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{labels.top}</span>
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
  labels: Dictionary['heroPage']['builds']
}) {
  return (
    <article className="border border-border/60 bg-background/45 p-4">
      <div className="flex items-start gap-3">
        <span className="font-display text-2xl font-bold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-foreground">{build.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{labels.id} {build.id}</p>
            </div>
            <div className="text-right tabular-nums">
              <div className="font-display text-xl font-semibold text-foreground">{formatPercent(build.winRate, locale)}</div>
              <div className="text-xs text-muted-foreground">{labels.winRate}</div>
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
              {build.items.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {build.items.map((item) => <ItemCard key={`${item.category}-${item.id}`} item={item} />)}
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>}
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


function ItemCard({ item }: { item: HeroBuildView['items'][number] }) {
  const tone = item.slot === 'vitality'
    ? 'border-emerald-400/45 text-emerald-100'
    : item.slot === 'weapon'
      ? 'border-orange-400/45 text-orange-100'
      : 'border-violet-400/45 text-violet-100'

  return (
    <div className={\`group relative aspect-[3/4] min-w-0 overflow-hidden border bg-black/30 shadow-[0_10px_24px_rgba(0,0,0,0.24)] \${tone}\`}>
      {item.backer ? (
        <>
          <img src={item.backer.backer.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-90" />
          <img src={item.backer.color.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-80 mix-blend-screen" />
          <img src={item.backer.mask.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-75" />
        </>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/10" />
      <div className="absolute inset-x-1 top-1 flex items-start justify-between gap-1">
        <span className="max-w-[70%] truncate bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">{item.name}</span>
        <div className="flex gap-1">
          {item.isActive ? <span className="bg-black/65 px-1 py-0.5 text-[8px] font-bold uppercase">A</span> : null}
          {item.isImbued ? <span className="bg-black/65 px-1 py-0.5 text-[8px] font-bold uppercase">I</span> : null}
        </div>
      </div>
      {item.icon ? <img src={item.icon} alt="" width={72} height={72} className="absolute inset-0 m-auto size-[58%] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105" /> : null}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
        <span className="truncate bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider">{item.category}</span>
        {item.isImbued ? <span className="bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase">Imbued</span> : null}
      </div>
    </div>
  )
}
