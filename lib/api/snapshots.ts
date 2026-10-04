import { SNAPSHOT_SCHEMA_VERSION, withBase } from '@/lib/config'
import { fetchTierStats } from './analytics'
import { apiGet } from './client'
import type { ApiInfo, PatchWindow, StatsSnapshot } from './types'

export type DataSource = 'snapshot' | 'live'

export interface StatsResult {
  snapshot: StatsSnapshot
  source: DataSource
}

const memory = new Map<string, Promise<StatsResult>>()

async function readSnapshot(window: PatchWindow, bandId: string): Promise<StatsSnapshot | null> {
  try {
    const res = await fetch(withBase(`/data/stats/${window.id}/${bandId}.json`))
    if (!res.ok) return null
    const snapshot = (await res.json()) as StatsSnapshot
    if (snapshot.schema_version > SNAPSHOT_SCHEMA_VERSION) return null
    if (snapshot.window.start !== window.start) return null
    return snapshot
  } catch {
    return null
  }
}

/** Resolution order: memory, static snapshot, live API. */
export function loadTierStats(window: PatchWindow, band: { id: string; min: number; max: number }) {
  const key = `stats:tier:${window.id}:${band.id}`
  const hit = memory.get(key)
  if (hit) return hit

  const pending = (async (): Promise<StatsResult> => {
    const snapshot = await readSnapshot(window, band.id)
    if (snapshot) return { snapshot, source: 'snapshot' }
    return { snapshot: await fetchTierStats(window, band), source: 'live' }
  })().catch((error) => {
    memory.delete(key)
    throw error
  })

  memory.set(key, pending)
  return pending
}

export function getApiInfo() {
  return apiGet<ApiInfo>('/v1/info', {}, { cache: 'no-store' })
}
