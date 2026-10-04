import type { ReactNode } from 'react'
import { RootShell } from '@/components/site/root-shell'
import { layoutMetadata, siteViewport } from '@/lib/metadata'

export const metadata = layoutMetadata('en')
export const viewport = siteViewport

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootShell locale="en">{children}</RootShell>
}
