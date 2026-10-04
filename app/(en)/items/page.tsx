import { TierPage } from '@/components/pages/tier-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/items', t.items.title, t.items.lede)

export default function Page() {
  return <TierPage locale="en" kind="items" />
}
