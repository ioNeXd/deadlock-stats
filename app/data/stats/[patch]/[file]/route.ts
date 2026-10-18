import { fetchTierStats, STATS_FETCH } from '@/lib/api/analytics'
import { getPatchWindows } from '@/lib/api/patches'
import { RANK_BANDS } from '@/lib/config'

export const dynamic = 'force-static'
export const dynamicParams = false

export async function generateStaticParams() {
  const windows = await getPatchWindows()
  // Older patch windows can be expensive for the upstream analytics API and
  // make static export time out. Publish a snapshot for the latest patch only;
  // older windows already fall back to the live API in lib/api/snapshots.ts.
  const latestWindow = windows.slice(0, 1)
  return latestWindow.flatMap((window) => RANK_BANDS.map((band) => ({ patch: window.id, file: `${band.id}.json` })))
}

export async function GET(_request: Request, { params }: { params: Promise<{ patch: string; file: string }> }) {
  const { patch, file } = await params
  const band = RANK_BANDS.find((b) => `${b.id}.json` === file)
  const window = (await getPatchWindows()).find((w) => w.id === patch)
  if (!band || !window) return Response.json({ error: 'Unknown snapshot' }, { status: 404 })

  const snapshot = await fetchTierStats(window, band, STATS_FETCH)
  if (snapshot.heroes.rows.length === 0) {
    throw new Error(`Refusing to publish empty snapshot ${patch}/${file}`)
  }
  return Response.json(snapshot)
}
