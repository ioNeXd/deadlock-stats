import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

const LINKS = [
  { path: '/tierlist', key: 'tierlist' },
  { path: '/methodology', key: 'methodology' },
  { path: '/status', key: 'status' },
] as const

export function HomePage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)

  return (
    <main id="main" className="flex min-h-[calc(100dvh-9rem)] items-center justify-center px-4 py-12">
      <section className="flex w-full max-w-3xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.35em] text-primary">{t.site.tag}</p>
          <h1 className="font-display text-7xl font-bold uppercase leading-none tracking-[0.08em] text-balance sm:text-8xl md:text-9xl">
            {t.site.name}
          </h1>
          <span aria-hidden className="h-px w-32 bg-primary/70" />
        </div>

        <nav aria-label={t.site.mainNav} className="flex flex-wrap justify-center gap-2">
          {LINKS.map(({ path, key }) => (
            <Link
              key={path}
              href={localePath(locale, path)}
              className="chamfer-sm border border-border bg-card px-6 py-3 font-display text-base font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary focus-visible:border-primary"
            >
              {t.nav[key]}
            </Link>
          ))}
        </nav>
      </section>
    </main>
  )
}
