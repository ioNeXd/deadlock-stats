import type { Metadata, Viewport } from 'next'
import { withBase } from '@/lib/config'
import { type Locale, localePath, type SitePath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export const siteViewport: Viewport = {
  themeColor: '#16130f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export function layoutMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale)
  return {
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
    title: { default: `${t.site.name} · ${t.site.tag}`, template: `%s · ${t.site.name}` },
    description: t.site.description,
    openGraph: { siteName: t.site.name, locale: locale === 'en' ? 'en_US' : 'pt_BR', type: 'website' },
  }
}

export function pageMetadata(locale: Locale, path: SitePath, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: withBase(localePath(locale, path)),
      languages: { en: withBase(localePath('en', path)), 'pt-BR': withBase(localePath('pt-br', path)) },
    },
    openGraph: { title, description },
  }
}
