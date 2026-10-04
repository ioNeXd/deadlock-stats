'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useQueryState } from '@/lib/use-query-state'
import type { BandOption } from './filter-bar'

export function RankBandTheme({ bands, children }: { bands: BandOption[]; children: ReactNode }) {
  const [params] = useQueryState()
  const band = bands.find((item) => item.id === params.get('rank')) ?? bands[0]

  const style = (
    band
      ? {
          '--rank-start': band.startColor ?? 'transparent',
          '--rank-end': band.endColor ?? 'transparent',
        }
      : {}
  ) as CSSProperties

  return (
    <div className="rank-band-theme flex flex-col gap-6 px-1 py-1" style={style}>
      {children}
    </div>
  )
}
