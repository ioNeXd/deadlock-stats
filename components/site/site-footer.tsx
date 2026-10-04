import { API_SPONSOR_URL } from '@/lib/config'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-pretty">{t.footer.disclaimer}</p>
        <p>
          {t.footer.data}{' '}
          <a
            href={API_SPONSOR_URL}
            className="text-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {t.footer.sponsor}
          </a>
        </p>
      </div>
    </footer>
  )
}
