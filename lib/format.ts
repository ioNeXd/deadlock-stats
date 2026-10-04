import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'

export function formatPercent(value: number, locale: Locale, digits = 1) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatCompact(value: number, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatInteger(value: number, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value)
}

/** Dates are always shown in UTC so server and client render the same text. */
export function formatDate(value: number | string, locale: Locale) {
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function formatDateTime(value: string, locale: Locale) {
  const text = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
  return `${text} UTC`
}
