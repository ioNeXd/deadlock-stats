'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type Locale, localePath, type SitePath, stripLocale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

const LINKS: { path: SitePath; key: 'tierlist' | 'methodology' | 'status' }[] = [
  { path: '/tierlist', key: 'tierlist' },
  { path: '/methodology', key: 'methodology' },
  { path: '/status', key: 'status' },
]

interface Labels {
  tierlist: string
  methodology: string
  status: string
  mainNav: string
  language: string
}

export function SiteNav({ locale, labels }: { locale: Locale; labels: Labels }) {
  const current = stripLocale(usePathname() || '/')

  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <nav aria-label={labels.mainNav}>
        <ul className="flex items-center gap-1">
          {LINKS.map(({ path, key }) => {
            const active = current === path
            return (
              <li key={path}>
                <Link
                  href={localePath(locale, path)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'chamfer-sm inline-block px-3 py-1.5 font-display text-base font-semibold uppercase tracking-wider transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {labels[key]}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <nav aria-label={labels.language}>
        <ul className="flex items-center gap-1 text-sm">
          {(['en', 'pt-br'] as const).map((target) => (
            <li key={target}>
              <Link
                href={localePath(target, current)}
                hrefLang={target === 'en' ? 'en' : 'pt-BR'}
                aria-current={target === locale ? 'true' : undefined}
                className={cn(
                  'px-2 py-1 font-medium uppercase tracking-wider',
                  target === locale ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {target === 'en' ? 'EN' : 'PT-BR'}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
