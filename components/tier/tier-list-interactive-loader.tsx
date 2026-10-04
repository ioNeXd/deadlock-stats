'use client'

import dynamic from 'next/dynamic'

export const TierListInteractive = dynamic(
  () => import('./tier-list-interactive').then((module) => module.TierListInteractive),
  { ssr: false },
)
