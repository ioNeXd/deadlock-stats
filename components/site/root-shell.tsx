import { Barlow_Condensed, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { API_BASE, ASSET_CDN } from '@/lib/config'
import { HTML_LANG, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import '@/app/globals.css'

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export function RootShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getDictionary(locale)
  return (
    <html lang={HTML_LANG[locale]} className={`${display.variable} ${sans.variable} dark`}>
      <head>
        <link rel="preconnect" href={ASSET_CDN} />
        <link rel="preconnect" href={API_BASE} crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          {t.site.skipToContent}
        </a>
        <SiteHeader locale={locale} />
        <div className="flex-1">{children}</div>
        <SiteFooter locale={locale} />
      </body>
    </html>
  )
}
