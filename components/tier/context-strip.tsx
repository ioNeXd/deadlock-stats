'use client'

import { useEffect, useState } from 'react'
import type { StatsResult } from '@/lib/api/snapshots'
import { STATS_FRESHNESS_MS } from '@/lib/config'
import { formatCompact, formatDateTime } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

interface Props {
  locale: Locale
  periodLabel: string
  bandLabel: string
  result: StatsResult | undefined
  loading: boolean
}

export function ContextStrip({ locale, periodLabel, bandLabel, result, loading }: Props) {
  const t = getDictionary(locale)
  const [stale, setStale] = useState(false)
  const generatedAt = result?.snapshot.generated_at

  useEffect(() => {
    setStale(!!generatedAt && Date.now() - Date.parse(generatedAt) > STATS_FRESHNESS_MS)
  }, [generatedAt])

  const picks = result ? result.snapshot.heroes.rows.reduce((sum, row) => sum + row[3], 0) : 0

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" aria-live="polite" aria-busy={loading}>
        <div className="flex gap-1.5">
          <dt className="sr-only">Period</dt>
          <dd className="font-medium text-foreground">{periodLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="sr-only">Rank</dt>
          <dd className="text-muted-foreground">{bandLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="sr-only">Mode</dt>
          <dd className="text-muted-foreground">{t.context.mode}</dd>
        </div>
        {result ? (
          <div className="flex gap-1.5">
            <dt className="sr-only">Sample</dt>
            <dd className="tabular-nums text-muted-foreground">
              {interpolate(t.context.sample, { n: formatCompact(picks, locale) })}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center gap-2 md:ml-auto">
          <dt className="sr-only">Source</dt>
          <dd className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
                loading ? 'bg-secondary text-muted-foreground' : result?.source === 'live' ? 'bg-accent text-foreground' : 'bg-secondary text-primary',
              )}
            >
              <span
                aria-hidden
                className={cn('size-1.5 rounded-full bg-current', loading && 'animate-pulse')}
              />
              {loading ? t.context.loading : result?.source === 'live' ? t.context.live : t.context.snapshot}
            </span>
            {generatedAt ? (
              <span className="text-xs text-muted-foreground">
                {interpolate(t.context.generated, { date: formatDateTime(generatedAt, locale) })}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      {stale ? (
        <p role="status" className="text-sm text-tier-d">
          {t.context.stale}
        </p>
      ) : null}
    </div>
  )
}
