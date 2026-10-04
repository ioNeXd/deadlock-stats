import type { ReactNode } from 'react'
import { RootShell } from '@/components/site/root-shell'
import { layoutMetadata, siteViewport } from '@/lib/metadata'

export const metadata = layoutMetadata('pt-br')
export const viewport = siteViewport

export default function PortugueseLayout({ children }: { children: ReactNode }) {
  return <RootShell locale="pt-br">{children}</RootShell>
}
