export const LOCALES = ['en', 'pt-br'] as const
export type Locale = (typeof LOCALES)[number]

export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', 'pt-br': 'pt-BR' }
export const HTML_LANG: Record<Locale, string> = { en: 'en', 'pt-br': 'pt-BR' }

export type SitePath = '/' | '/items' | '/methodology' | '/status'

export function localePath(locale: Locale, path: SitePath | string) {
  if (locale === 'en') return path
  return path === '/' ? '/pt-br' : `/pt-br${path}`
}

/** Strips the locale prefix and trailing slash from a pathname. */
export function stripLocale(pathname: string) {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (trimmed === '/pt-br') return '/'
  return trimmed.startsWith('/pt-br/') ? trimmed.slice(6) : trimmed
}

export function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}
