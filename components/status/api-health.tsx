'use client'

import useSWR from 'swr'
import { RateLimitError } from '@/lib/api/client'
import { getApiInfo } from '@/lib/api/snapshots'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

async function probe() {
  const started = performance.now()
  await getApiInfo()
  return Math.round(performance.now() - started)
}

export function ApiHealth({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const { data: latency, error, isValidating, mutate } = useSWR('status:api-info', probe, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const state = isValidating && latency === undefined && !error ? 'checking' : error ? (error instanceof RateLimitError ? 'throttled' : 'unreachable') : 'reachable'
  const label = { checking: t.status.checking, reachable: t.status.reachable, throttled: t.status.throttled, unreachable: t.status.unreachable }[state]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
      <p className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            state === 'reachable' && 'bg-tier-a',
            state === 'throttled' && 'bg-tier-d',
            state === 'unreachable' && 'bg-tier-f',
            state === 'checking' && 'animate-pulse bg-muted-foreground',
          )}
        />
        <span className="font-medium">{label}</span>
        {state === 'reachable' && latency !== undefined ? (
          <span className="tabular-nums text-sm text-muted-foreground">{interpolate(t.status.latency, { ms: latency })}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => mutate()}
        disabled={isValidating}
        className="chamfer-sm bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {t.status.recheck}
      </button>
    </div>
  )
}
