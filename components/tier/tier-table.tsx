'use client'

import type { CSSProperties } from 'react'
import type { HeroEntity, ItemEntity } from '@/lib/api/types'
import { formatCompact, formatInteger, formatPercent } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { TierStat } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { TierBadge } from './tier-badge'

export type SortKey = 'score' | 'winRate' | 'pickRate' | 'matches' | 'name'
export type SortDir = 'asc' | 'desc'
export type TierTableRow = TierStat & { entity: HeroEntity | ItemEntity }

interface Props {
  locale: Locale
  kind: 'heroes' | 'items'
  rows: TierTableRow[]
  totalRows: number
  loading: boolean
  sort: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  caption: string
}

const SLOT_COLOR: Record<ItemEntity['slot'], string> = {
  weapon: 'text-tier-d',
  vitality: 'text-tier-a',
  spirit: 'text-tier-b',
}

function SortHeader({
  label,
  column,
  sort,
  dir,
  onSort,
  align = 'left',
  className,
  sortLabel,
}: {
  label: string
  column: SortKey
  sort: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
  className?: string
  sortLabel: string
}) {
  const active = sort === column
  const icon = !active ? '↕' : dir === 'asc' ? '↑' : '↓'
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2 font-medium', align === 'right' && 'text-right', className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={sortLabel}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <span aria-hidden className="text-[0.8rem] leading-none">{icon}</span>
      </button>
    </th>
  )
}

export function TierTable({ locale, kind, rows, totalRows, loading, sort, dir, onSort, caption }: Props) {
  const t = getDictionary(locale)
  const entityLabel = kind === 'heroes' ? t.heroes.entity : t.items.entity
  const maxPick = rows.reduce((max, r) => Math.max(max, r.pickRate), 0) || 1
  const header = (label: string, column: SortKey, extra?: Partial<Parameters<typeof SortHeader>[0]>) => (
    <SortHeader
      label={label}
      column={column}
      sort={sort}
      dir={dir}
      onSort={onSort}
      sortLabel={interpolate(t.table.sortBy, { column: label })}
      {...extra}
    />
  )

  return (
    <div className="chamfer border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border text-xs">
            <tr>
              {header(t.table.tier, 'score', { className: 'w-20' })}
              {header(entityLabel, 'name')}
              {header(t.table.winRate, 'winRate', { align: 'right' })}
              {header(t.table.pickRate, 'pickRate', { align: 'right', className: 'w-40' })}
              {header(t.table.matches, 'matches', { align: 'right', className: 'hidden sm:table-cell' })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }, (_, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="h-8 animate-pulse bg-muted" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => <Row key={row.id} row={row} kind={kind} locale={locale} maxPick={maxPick} />)}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-medium">{t.table.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.table.emptyHint}</p>
        </div>
      ) : null}
      {!loading && rows.length > 0 ? (
        <p className="border-t border-border px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
          {interpolate(t.table.count, { shown: rows.length, total: totalRows })}
        </p>
      ) : null}
    </div>
  )
}

function Row({ row, kind, locale, maxPick }: { row: TierTableRow; kind: 'heroes' | 'items'; locale: Locale; maxPick: number }) {
  const t = getDictionary(locale)
  const lowData = row.tier === null
  const hero = kind === 'heroes' ? (row.entity as HeroEntity) : null
  const item = kind === 'items' ? (row.entity as ItemEntity) : null
  const style = hero?.color ? ({ '--hero': `rgb(${hero.color})` } as CSSProperties) : undefined
  const margin = (row.high - row.low) / 2

  return (
    <tr className={cn('tier-row border-b border-border/60 last:border-0 hover:bg-accent/40', lowData && 'text-muted-foreground')}>
      <td className="px-3 py-2">
        {row.tier ? (
          <TierBadge tier={row.tier} label={interpolate(t.tierLabel, { tier: row.tier })} />
        ) : (
          <span className="text-xs font-medium uppercase tracking-wider">{t.table.lowData}</span>
        )}
      </td>
      <th scope="row" className="px-3 py-2 text-left font-normal">
        <div className="flex items-center gap-3">
          <span
            style={style}
            className={cn(
              'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted',
              hero?.color && 'bg-[color-mix(in_oklch,var(--hero)_35%,var(--muted))]',
            )}
          >
            {row.entity.icon ? (
              <img
                src={row.entity.icon || "/placeholder.svg"}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                className={cn('size-full object-contain', item && 'p-1', lowData && 'opacity-60')}
              />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate font-medium', !lowData && 'text-foreground')}>{row.entity.name}</span>
            {item ? (
              <span className="text-xs text-muted-foreground">
                <span className={SLOT_COLOR[item.slot]}>{t.slots[item.slot]}</span>
                {' · '}T{item.tier}
                {item.cost ? ` · ${interpolate(t.table.cost, { n: formatInteger(item.cost, locale) })}` : null}
              </span>
            ) : null}
          </span>
        </div>
      </th>
      <td className="px-3 py-2 text-right tabular-nums">
        <div className={cn('font-semibold', !lowData && 'text-foreground')}>{formatPercent(row.smoothed, locale)}</div>
        <div className="text-xs text-muted-foreground" title={t.table.winRateHint}>
          {'±'}
          {formatPercent(margin, locale)}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <div className="flex items-center justify-end gap-2">
          <span
            aria-hidden
            className="hidden h-1.5 w-16 overflow-hidden bg-muted md:block"
          >
            <span className="block h-full bg-primary/70" style={{ width: `${(row.pickRate / maxPick) * 100}%` }} />
          </span>
          <span>{formatPercent(row.pickRate, locale)}</span>
        </div>
      </td>
      <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
        {formatCompact(row.matches, locale)}
      </td>
    </tr>
  )
}
