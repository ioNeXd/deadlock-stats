import type { HeroEntity, ItemEntity, PatchWindow, StatsSnapshot } from '@/lib/api/types'
import { DEFAULT_BAND } from '@/lib/config'
import { formatDate } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { BandOption } from './filter-bar'
import type { TierTableRow } from './tier-table'
import { TierListInteractive } from './tier-list-interactive-loader'
import { TierTableStatic } from './tier-table-static'

interface Props {
  kind: 'heroes' | 'items'
  entities: HeroEntity[] | ItemEntity[]
  locale: Locale
  windows: PatchWindow[]
  bands: BandOption[]
  initialSnapshot: StatsSnapshot | null
  initialRows: TierTableRow[]
}

export function TierListView(props: Props) {
  const { kind, locale, windows, bands, initialSnapshot, initialRows } = props
  const t = getDictionary(locale)
  const patch = windows[0]
  const band = bands.find((item) => item.id === DEFAULT_BAND.id) ?? bands[0]
  const periodLabel = patch
    ? patch.end
      ? interpolate(t.filters.range, { start: formatDate(patch.start, locale), end: formatDate(patch.end, locale) })
      : interpolate(t.filters.current, { start: formatDate(patch.start, locale) })
    : ''
  const strings = kind === 'heroes' ? t.heroes : t.items
  const sample = initialSnapshot?.heroes.rows.reduce((sum, row) => sum + row[3], 0) ?? 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" aria-label={t.filters.label}>
          <div className="flex gap-1.5">
            <dt className="sr-only">{t.filters.patch}</dt>
            <dd className="font-medium text-foreground">{periodLabel}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="sr-only">{t.filters.rank}</dt>
            <dd className="text-muted-foreground">{band.label}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="sr-only">{t.context.mode}</dt>
            <dd className="text-muted-foreground">{t.context.mode}</dd>
          </div>
          {initialSnapshot ? (
            <div className="flex gap-1.5">
              <dt className="sr-only">{t.context.sample}</dt>
              <dd className="tabular-nums text-muted-foreground">
                {interpolate(t.context.sample, { n: String(sample) })}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2 md:ml-auto">
            <dd className="chamfer-sm bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {t.context.snapshot}
            </dd>
          </div>
        </dl>
      </div>

      {kind === 'items' ? <p className="text-sm text-muted-foreground text-pretty">{t.items.caveat}</p> : null}

      <div id="tier-static">
        <h2 id="tier-heading-static" className="sr-only">{strings.title}</h2>
        <TierTableStatic
          locale={locale}
          kind={kind}
          rows={initialRows}
          totalRows={initialRows.length}
          caption={interpolate(t.table.caption, {
            entity: strings.entity,
            rank: band.label,
            period: periodLabel,
            sort: t.table.score,
          })}
        />
      </div>

      <TierListInteractive
        kind={kind}
        entities={props.entities}
        locale={locale}
        windows={windows}
        bands={bands}
        initialSnapshot={initialSnapshot}
        initialRows={initialRows}
      />
    </section>
  )
}
