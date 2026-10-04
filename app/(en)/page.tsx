import { TierPage } from '@/components/pages/tier-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/', t.heroes.title, t.heroes.lede)

export default function Page() {
  return <TierPage locale="en" kind="heroes" />
}
