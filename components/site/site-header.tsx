import Link from 'next/link'
import { type Locale, localePath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { SiteNav } from './site-nav'

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={localePath(locale, '/')} className="group flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold uppercase tracking-wide text-primary">{t.site.name}</span>
          <span className="hidden font-display text-sm uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            {t.site.tag}
          </span>
        </Link>
        <SiteNav
          locale={locale}
          labels={{ ...t.nav, mainNav: t.site.mainNav, language: t.site.language }}
        />
      </div>
    </header>
  )
}
