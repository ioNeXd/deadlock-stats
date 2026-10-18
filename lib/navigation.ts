import type { SitePath } from './i18n/config'

export interface NavItem {
  path: SitePath
  key: 'tierlist' | 'player' | 'methodology' | 'status'
  /** If false, the link appears in header nav but not on the home hero buttons. Defaults to true. */
  showOnHome?: boolean
}

/**
 * Single source of truth for site navigation.
 * Any new top-level page registered here will automatically appear in both
 * the Site Header navbar and the Home Page hero navigation.
 */
export const SITE_NAVIGATION: readonly NavItem[] = [
  { path: '/tierlist', key: 'tierlist', showOnHome: true },
  { path: '/player', key: 'player', showOnHome: true },
  { path: '/methodology', key: 'methodology', showOnHome: true },
  { path: '/status', key: 'status', showOnHome: true },
] as const

export const HOME_NAV_ITEMS = SITE_NAVIGATION.filter((item) => item.showOnHome !== false)
