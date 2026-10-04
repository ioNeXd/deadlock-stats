'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import useSWR from 'swr'
import { RateLimitError } from '@/lib/api/client'
import { loadTierStats, type StatsResult } from '@/lib/api/snapshots'
import type { HeroEntity, ItemEntity, ItemSlot, PatchWindow, StatsSnapshot } from '@/lib/api/types'
import { DEFAULT_BAND, MIN_MATCHES } from '@/lib/config'
import { formatDate } from '@/lib/format'
import { interpolate, type Locale, localePath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { computeTierRows, type TierStat } from '@/lib/tiers'
import { useQueryState } from '@/lib/use-query-state'
import { ContextStrip } from './context-strip'
import { type BandOption, FilterBar } from './filter-bar'
import { type SortDir, type SortKey, TierTable, type TierTableRow } from './tier-table'

type Props =
  | { kind: 'heroes'; entities: HeroEntity[] } & Shared
  | { kind: 'items'; entities: ItemEntity[] } & Shared

interface Shared {
  locale: Locale
  windows: PatchWindow[]
  bands: BandOption[]
  initialSnapshot: StatsSnapshot | null
  initialRows: TierTableRow[]
}

const SORT_KEYS: SortKey[] = ['score', 'winRate', 'pickRate', 'matches', 'name']
const SLOTS: ItemSlot[] = ['weapon', 'vitality', 'spirit']

function snapshotRows(snapshot: StatsSnapshot, kind: 'heroes' | 'items') {
  return snapshot[kind].rows.map(([id, wins, , matches]) => ({ id, wins, matches }))
}

export function TierListView(props: Props) {
  const { kind, locale, windows, bands, initialSnapshot } = props
  const t = getDictionary(locale)
  const [params, setParams] = useQueryState()

  const patch = windows.find((w) => w.id === params.get('patch')) ?? windows[0]
  const band = bands.find((b) => b.id === params.get('rank')) ?? bands[0]
  const query = params.get('q') ?? ''
  const slotParam = params.get('slot') as ItemSlot | null
  const slot = slotParam && SLOTS.includes(slotParam) ? slotParam : null
  const itemTier = Number(params.get('tier')) || null
  const sortParam = params.get('sort') as SortKey | null
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'score'
  const dir: SortDir = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : sort === 'name' ? 'asc' : 'desc'

  const isDefault = patch.id === windows[0]?.id && band.id === DEFAULT_BAND.id
  const fallback: StatsResult | undefined =
    isDefault && initialSnapshot ? { snapshot: initialSnapshot, source: 'snapshot' } : undefined

  const { data, error, isLoading, mutate } = useSWR(
    ['stats', patch.id, band.id],
    () => loadTierStats(patch, band),
    { fallbackData: fallback, revalidateIfStale: false, revalidateOnFocus: false, keepPreviousData: true },
  )

  const entityMap = useMemo(
    () => new Map<number, HeroEntity | ItemEntity>(props.entities.map((e) => [e.id, e])),
    [props.entities],
  )

  const allRows = useMemo<TierTableRow[]>(() => {
    if (!data) return []
    if (isDefault && props.initialRows.length > 0) return props.initialRows
    return computeTierRows(data.snapshot, kind, entityMap, MIN_MATCHES[kind])
  }, [data, kind, entityMap, isDefault, props.initialRows])

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const filtered = allRows.filter((row) => {
      if (needle && !row.entity.name.toLocaleLowerCase().includes(needle)) return false
      if (kind === 'items') {
        const item = row.entity as ItemEntity
        if (slot && item.slot !== slot) return false
        if (itemTier && item.tier !== itemTier) return false
      }
      return true
    })
    const factor = dir === 'asc' ? 1 : -1
    const value = (row: TierTableRow) => (sort === 'score' ? row.score : row[sort as 'winRate' | 'pickRate' | 'matches'])
    return filtered.sort((a, b) => {
      const aRanked = a.tier !== null
      const bRanked = b.tier !== null
      if (aRanked !== bRanked) return aRanked ? -1 : 1
      if (sort === 'name') return factor * a.entity.name.localeCompare(b.entity.name, locale)
      if (sort === 'winRate') return factor * (a.smoothed - b.smoothed)
      return factor * (value(a) - value(b))
    })
  }, [allRows, query, kind, slot, itemTier, sort, dir, locale])

  const periodLabel = patch.end
    ? interpolate(t.filters.range, { start: formatDate(patch.start, locale), end: formatDate(patch.end, locale) })
    : interpolate(t.filters.current, { start: formatDate(patch.start, locale) })

  const onSort = (key: SortKey) => {
    const nextDir: SortDir = key === sort ? (dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'
    const isDefaultSort = key === 'score' && nextDir === 'desc'
    setParams({ sort: isDefaultSort ? null : key, dir: isDefaultSort ? null : nextDir })
  }

  const strings = kind === 'heroes' ? t.heroes : t.items
  const throttled = error instanceof RateLimitError

  return (
    <section aria-labelledby="tier-heading" className="flex flex-col gap-4">
      <FilterBar
        locale={locale}
        windows={windows}
        bands={bands}
        patchId={patch.id}
        bandId={band.id}
        onPatch={(id) => setParams({ patch: id === windows[0]?.id ? null : id })}
        onBand={(id) => setParams({ rank: id === DEFAULT_BAND.id ? null : id })}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tier-search" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {strings.search}
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="tier-search"
              type="search"
              value={query}
              onChange={(e) => setParams({ q: e.target.value })}
              placeholder={strings.search}
              autoComplete="off"
              className="chamfer-sm h-10 w-full bg-input/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-input"
            />
          </div>
        </div>
      </FilterBar>

      {kind === 'items' ? (
        <div className="flex flex-wrap items-end gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.filters.slot}</legend>
            <div className="flex flex-wrap gap-1">
              {[null, ...SLOTS].map((value) => (
                <button
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={slot === value}
                  onClick={() => setParams({ slot: value })}
                  className="chamfer-sm h-9 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
                >
                  {value ? t.slots[value] : t.filters.all}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.filters.itemTier}</legend>
            <div className="flex flex-wrap gap-1">
              {[null, 1, 2, 3, 4].map((value) => (
                <button
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={itemTier === value}
                  onClick={() => setParams({ tier: value ? String(value) : null })}
                  className="chamfer-sm h-9 min-w-9 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
                >
                  {value ? `T${value}` : t.filters.all}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      <ContextStrip
        locale={locale}
        periodLabel={periodLabel}
        bandLabel={band.label}
        result={data}
        loading={isLoading || (!!data && data.snapshot.band !== band.id) || (!!data && data.snapshot.patch !== patch.id)}
      />

      {kind === 'items' ? <p className="text-sm text-muted-foreground text-pretty">{t.items.caveat}</p> : null}

      {error ? (
        <div role="alert" className="chamfer flex flex-wrap items-center justify-between gap-3 border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <p>{throttled ? t.context.throttled : data ? t.context.errorKeep : t.context.error}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="chamfer-sm bg-secondary px-3 py-1.5 font-medium hover:bg-accent"
          >
            {t.context.retry}
          </button>
        </div>
      ) : null}

      <h2 id="tier-heading" className="sr-only">
        {strings.title}
      </h2>
      <TierTable
        locale={locale}
        kind={kind}
        rows={visibleRows}
        totalRows={allRows.length}
        loading={!data && isLoading}
        sort={sort}
        dir={dir}
        onSort={onSort}
        caption={interpolate(t.table.caption, {
          entity: strings.entity,
          rank: band.label,
          period: periodLabel,
          sort: sort === 'score' ? t.table.score : sort === 'name' ? strings.entity : t.table[sort],
        })}
      />

      <aside className="chamfer border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <h2 className="font-display text-base font-semibold uppercase tracking-wider text-foreground">{t.legend.title}</h2>
        <p className="mt-1 text-pretty">
          {t.legend.body}{' '}
          {interpolate(t.table.lowDataHint, { n: MIN_MATCHES[kind] })}.{' '}
          <Link href={localePath(locale, '/methodology')} className="text-primary underline-offset-4 hover:underline">
            {t.legend.link}
          </Link>
        </p>
      </aside>
    </section>
  )
}
