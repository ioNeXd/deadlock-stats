import { TierPage } from '@/components/pages/tier-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('pt-br')
export const metadata = pageMetadata('pt-br', '/items', t.items.title, t.items.lede)

export default function Page() {
  return <TierPage locale="pt-br" kind="items" />
}
