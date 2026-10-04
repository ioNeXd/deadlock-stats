'use client'

import type { ReactNode } from 'react'
import type { PatchWindow } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { interpolate, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export interface BandOption {
  id: string
  min: number
  max: number
  label: string
}

interface Props {
  locale: Locale
  windows: PatchWindow[]
  bands: BandOption[]
  patchId: string
  bandId: string
  onPatch: (id: string) => void
  onBand: (id: string) => void
  children?: ReactNode
}

export function FilterBar({ locale, windows, bands, patchId, bandId, onPatch, onBand, children }: Props) {
  const t = getDictionary(locale)
  return (
    <div className="chamfer flex flex-col gap-4 border border-border bg-card p-4">
      <h2 className="sr-only">{t.filters.label}</h2>
      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.filters.rank}</legend>
        <div className="flex flex-wrap gap-1.5">
          {bands.map((band) => {
            const active = band.id === bandId
            return (
              <button
                key={band.id}
                type="button"
                aria-pressed={active}
                onClick={() => onBand(band.id)}
                className="chamfer-sm flex h-10 items-center gap-2 bg-secondary px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <span>{band.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="patch-window" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.filters.patch}
          </label>
          <select
            id="patch-window"
            value={patchId}
            onChange={(e) => onPatch(e.target.value)}
            className="chamfer-sm h-10 w-full bg-input/60 px-3 text-sm text-foreground focus:bg-input"
          >
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.end
                  ? interpolate(t.filters.range, { start: formatDate(w.start, locale), end: formatDate(w.end, locale) })
                  : interpolate(t.filters.current, { start: formatDate(w.start, locale) })}
              </option>
            ))}
          </select>
        </div>
        {children}
      </div>
    </div>
  )
}
