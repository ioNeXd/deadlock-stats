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
                  {build.items.map((item) => <ItemCard key={`${item.category}-${item.id}`} item={item} labels={labels} />)}
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


function ItemCard({ item, labels }: { item: HeroBuildView['items'][number]; labels: Dictionary['heroPage']['builds'] }) {
  const tone = item.slot === 'vitality'
    ? {
        frame: 'border-emerald-400/55',
        glow: 'bg-emerald-400/10',
        label: 'text-emerald-100',
      }
    : item.slot === 'weapon'
      ? {
          frame: 'border-orange-400/55',
          glow: 'bg-orange-400/10',
          label: 'text-orange-100',
        }
      : {
          frame: 'border-violet-400/55',
          glow: 'bg-violet-400/10',
          label: 'text-violet-100',
        }

  return (
    <article className={`group min-w-0 overflow-hidden border bg-black/35 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-transform duration-200 hover:-translate-y-0.5 ${tone.frame}`}>
      <div className={`relative aspect-square overflow-hidden ${tone.glow}`}>
        {item.backer ? (
          <>
            <img src={item.backer.backer.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-95" />
            <img src={item.backer.color.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-95 mix-blend-screen" />
            <img src={item.backer.mask.webp} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-85" />
          </>
        ) : null}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_62%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />

        {item.icon ? (
          <img
            src={item.icon}
            alt=""
            width={128}
            height={128}
            className="absolute inset-0 m-auto size-[72%] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.75)] transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.name}
          </div>
        )}

        <div className="absolute inset-x-1 top-1 flex items-start justify-between gap-1">
          <span className={`bg-black/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${tone.label}`}>
            {item.slot}
          </span>
          <div className="flex gap-1">
            {item.isActive ? <span className="bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase text-foreground">{labels.active}</span> : null}
            {item.isImbued ? <span className="bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase text-primary">I</span> : null}
          </div>
        </div>
      </div>

      <div className="min-w-0 border-t border-border/50 bg-black/35 px-2 py-1.5">
        <div className={`truncate text-[10px] font-semibold uppercase leading-tight tracking-wide ${tone.label}`} title={item.name}>
          {item.name}
        </div>
        <div className="mt-0.5 truncate text-[8px] uppercase tracking-wider text-muted-foreground" title={item.category}>
          {item.category}
        </div>
      </div>
    </article>
  )
}
