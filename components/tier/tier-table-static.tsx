import type { CSSProperties } from 'react'
import type { HeroEntity, ItemEntity } from '@/lib/api/types'
import { formatCompact, formatInteger, formatPercent } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { interpolate, type Locale } from '@/lib/i18n/config'
import type { TierStat } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { TierBadge } from './tier-badge'

type Row = TierStat & { entity: HeroEntity | ItemEntity }

export function TierTableStatic({ locale, kind, rows, totalRows, caption }: {
  locale: Locale
  kind: 'heroes' | 'items'
  rows: Row[]
  totalRows: number
  caption: string
}) {
  const t = getDictionary(locale)
  const entityLabel = kind === 'heroes' ? t.heroes.entity : t.items.entity
  const maxPick = rows.reduce((max, r) => Math.max(max, r.pickRate), 0) || 1
  return (
    <div className="chamfer border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border text-xs">
            <tr>
              <th scope="col" className="w-20 px-3 py-2 text-left font-medium uppercase tracking-wider">{t.table.tier}</th>
              <th scope="col" className="px-3 py-2 text-left font-medium uppercase tracking-wider">{entityLabel}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium uppercase tracking-wider">{t.table.winRate}</th>
              <th scope="col" className="w-40 px-3 py-2 text-right font-medium uppercase tracking-wider">{t.table.pickRate}</th>
              <th scope="col" className="hidden w-auto px-3 py-2 text-right font-medium uppercase tracking-wider sm:table-cell">{t.table.matches}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lowData = row.tier === null
              const hero = kind === 'heroes' ? (row.entity as HeroEntity) : null
              const item = kind === 'items' ? (row.entity as ItemEntity) : null
              const style = hero?.color ? ({ '--hero': `rgb(${hero.color})` } as CSSProperties) : undefined
              const margin = (row.high - row.low) / 2
              return (
                <tr key={row.id} className={cn('tier-row border-b border-border/60 last:border-0', lowData && 'text-muted-foreground')}>
                  <td className="px-3 py-2">{row.tier ? <TierBadge tier={row.tier} label={interpolate(t.tierLabel, { tier: row.tier })} /> : <span className="text-xs font-medium uppercase tracking-wider">{t.table.lowData}</span>}</td>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <div className="flex items-center gap-3">
                      <span style={style} className={cn('chamfer-sm flex size-10 shrink-0 items-center justify-center overflow-hidden bg-muted', hero?.color && 'bg-[color-mix(in_oklch,var(--hero)_35%,var(--muted))]')}>
                        {row.entity.icon ? <img src={row.entity.icon || '/placeholder.svg'} alt="" width={40} height={40} decoding="async" className={cn('size-full object-cover', item && 'p-1 object-contain', lowData && 'opacity-60')} /> : null}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className={cn('truncate font-medium', !lowData && 'text-foreground')}>{row.entity.name}</span>
                        {item ? <span className="text-xs text-muted-foreground"><span className={SLOT_COLOR[item.slot]}>{t.slots[item.slot]}</span>{' · '}T{item.tier}{item.cost ? ` · ${interpolate(t.table.cost, { n: formatInteger(item.cost, locale) })}` : null}</span> : null}
                      </span>
                    </div>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums"><div className={cn('font-semibold', !lowData && 'text-foreground')}>{formatPercent(row.smoothed, locale)}</div><div className="text-xs text-muted-foreground">{'±'}{formatPercent(margin, locale)}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums"><div className="flex items-center justify-end gap-2"><span aria-hidden className="hidden h-1.5 w-16 overflow-hidden bg-muted md:block"><span className="block h-full bg-primary/70" style={{ width: `${(row.pickRate / maxPick) * 100}%` }} /></span><span>{formatPercent(row.pickRate, locale)}</span></div></td>
                  <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{formatCompact(row.matches, locale)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <div className="px-4 py-10 text-center"><p className="font-medium">{t.table.empty}</p><p className="mt-1 text-sm text-muted-foreground">{t.table.emptyHint}</p></div> : null}
      {rows.length > 0 ? <p className="border-t border-border px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">{interpolate(t.table.count, { shown: rows.length, total: totalRows })}</p> : null}
    </div>
  )
}

const SLOT_COLOR: Record<ItemEntity['slot'], string> = {
  weapon: 'text-tier-d',
  vitality: 'text-tier-a',
  spirit: 'text-tier-b',
}

