import { TierListPage } from '@/components/pages/tier-list-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/tierlist', t.tierList.title, t.tierList.lede)

export default function Page() {
  return <TierListPage locale="en" />
}
