import { PlayerPage } from '@/components/pages/player-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/player', t.playerPage.title, t.playerPage.lede)

export default function Page() {
  return <PlayerPage locale="en" />
}
