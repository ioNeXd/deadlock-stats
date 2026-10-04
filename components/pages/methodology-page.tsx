import { TierBadge } from '@/components/tier/tier-badge'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { CUTOFF_ROWS, getMethodology, pct } from '@/lib/i18n/methodology'
import { PageHeader } from './page-header'

export function MethodologyPage({ locale }: { locale: Locale }) {
  const m = getMethodology(locale)
  const t = getDictionary(locale)
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:py-10">
      <PageHeader eyebrow={m.eyebrow} title={m.title} lede={m.lede} />
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="flex max-w-2xl flex-col gap-8">
          {m.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-primary">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-pretty text-foreground/90">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <aside className="chamfer h-fit border border-border bg-card p-4 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wider">{m.cutoffsTitle}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {CUTOFF_ROWS.map((row) => (
              <li key={row.tier} className="flex items-center gap-3 text-sm">
                <TierBadge tier={row.tier} label={interpolate(t.tierLabel, { tier: row.tier })} className="h-8 w-11 text-lg" />
                <span className="tabular-nums text-muted-foreground">
                  {row.from === 0 ? interpolate(m.cutoffsTop, { pct: pct(row.to) }) : `${pct(row.from)} – ${pct(row.to)}`}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  )
}
