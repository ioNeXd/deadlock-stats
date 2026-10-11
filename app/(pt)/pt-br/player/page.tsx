import { PlayerPage } from '@/components/pages/player-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('pt-br')
export const metadata = pageMetadata('pt-br', '/player', t.playerPage.title, t.playerPage.lede)

export default function Page() {
  return <PlayerPage locale="pt-br" />
}
