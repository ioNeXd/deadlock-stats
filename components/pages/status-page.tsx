import { getRanks } from '@/lib/api/assets'
import { getPatchWindows } from '@/lib/api/patches'
import { formatDate, formatDateTime } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ApiHealth } from '@/components/status/api-health'
import { PageHeader } from './page-header'
import { buildBandOptions } from './tier-page'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="chamfer flex flex-col gap-3 border border-border bg-card p-4">
      <h2 className="font-display text-lg font-semibold uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  )
}

export async function StatusPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const [windows, ranks] = await Promise.all([getPatchWindows(), getRanks(locale).catch(() => [])])
  const bands = buildBandOptions(ranks, t.filters.allRanks)
  const builtAt = new Date().toISOString()

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:py-10">
      <PageHeader eyebrow={t.status.eyebrow} title={t.status.title} lede={t.status.lede} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t.status.api}>
          <ApiHealth locale={locale} />
        </Panel>
        <Panel title={t.status.build}>
          <p className="tabular-nums">{formatDateTime(builtAt, locale)}</p>
        </Panel>
        <Panel title={t.status.windows}>
          <ul className="flex flex-col gap-2 text-sm">
            {windows.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2">
                <span className="tabular-nums">
                  {w.end
                    ? interpolate(t.filters.range, { start: formatDate(w.start, locale), end: formatDate(w.end, locale) })
                    : interpolate(t.filters.current, { start: formatDate(w.start, locale) })}
                </span>
                <span className="text-muted-foreground">{t.status.windowSource[w.source]}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t.status.bands}>
          <ul className="flex flex-col gap-2 text-sm">
            {bands.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2">
                <span>{b.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {interpolate(t.status.badges, { min: b.min, max: b.max })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title={t.status.levels}>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          {t.status.levelItems.map(([name, description]) => (
            <div key={name}>
              <dt className="font-medium text-primary">{name}</dt>
              <dd className="text-muted-foreground">{description}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </main>
  )
}
