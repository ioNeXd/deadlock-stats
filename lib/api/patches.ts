import { PATCH_OVERRIDES, PATCH_WINDOW_COUNT } from '@/lib/config'
import { apiGet } from './client'
import type { PatchWindow } from './types'

const DAY = 86400

/** Pure: merges big-days and overrides into contiguous windows, newest first. */
export function buildPatchWindows(bigDays: string[], overrides: readonly string[], count = PATCH_WINDOW_COUNT) {
  const starts: { start: number; source: PatchWindow['source'] }[] = []
  const add = (iso: string, source: PatchWindow['source']) => {
    const start = Math.floor(Date.parse(iso) / 1000)
    if (!Number.isFinite(start)) return
    if (starts.some((s) => Math.abs(s.start - start) < DAY)) return
    starts.push({ start, source })
  }
  for (const iso of overrides) add(iso, 'override')
  for (const iso of bigDays) add(iso, 'big-days')
  starts.sort((a, b) => b.start - a.start)

  return starts.slice(0, count).map<PatchWindow>((entry, index) => ({
    id: new Date(entry.start * 1000).toISOString().slice(0, 10),
    start: entry.start,
    end: index === 0 ? null : starts[index - 1].start,
    source: entry.source,
  }))
}

export async function getPatchWindows(): Promise<PatchWindow[]> {
  const bigDays = await apiGet<string[]>('/v1/patches/big-days', {}, { next: { revalidate: 3600 } }).catch(() => [])
  return buildPatchWindows(
    bigDays,
    PATCH_OVERRIDES.map((o) => o.datetime),
  )
}
