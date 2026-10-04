'use client'

import { useQueryState } from '@/lib/use-query-state'
import type { HeroEntity, ItemEntity, PatchWindow, StatsSnapshot } from '@/lib/api/types'
import { type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { BandOption } from './filter-bar'
import type { TierTableRow } from './tier-table'
import { TierListView } from './tier-list-view'

interface Props {
  locale: Locale
  windows: PatchWindow[]
  bands: BandOption[]
  initialSnapshot: StatsSnapshot | null
  heroes: HeroEntity[]
  items: ItemEntity[]
  heroRows: TierTableRow[]
  itemRows: TierTableRow[]
}

export function TierListSwitcher(props: Props) {
  const [params, setParams] = useQueryState()
  const kind = params.get('view') === 'items' ? 'items' : 'heroes'
  const t = getDictionary(props.locale)

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2" role="tablist" aria-label={t.tierList.switchLabel}>
        {(['heroes', 'items'] as const).map((value) => {
          const active = value === kind
          const className = active
            ? 'chamfer-sm bg-primary px-4 py-2 font-display text-base font-semibold uppercase tracking-wider text-primary-foreground transition-colors'
            : 'chamfer-sm px-4 py-2 font-display text-base font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ view: value === 'heroes' ? null : value })}
              className={className}
            >
              {value === 'heroes' ? t.tierList.heroes : t.tierList.items}
            </button>
          )
        })}
      </div>

      {kind === 'heroes' ? (
        <TierListView
          kind="heroes"
          entities={props.heroes}
          locale={props.locale}
          windows={props.windows}
          bands={props.bands}
          initialSnapshot={props.initialSnapshot}
          initialRows={props.heroRows}
        />
      ) : (
        <TierListView
          kind="items"
          entities={props.items}
          locale={props.locale}
          windows={props.windows}
          bands={props.bands}
          initialSnapshot={props.initialSnapshot}
          initialRows={props.itemRows}
        />
      )}
    </>
  )
}
