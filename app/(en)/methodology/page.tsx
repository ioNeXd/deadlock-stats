import { MethodologyPage } from '@/components/pages/methodology-page'
import { getMethodology } from '@/lib/i18n/methodology'
import { pageMetadata } from '@/lib/metadata'

const m = getMethodology('en')
export const metadata = pageMetadata('en', '/methodology', m.title, m.lede)

export default function Page() {
  return <MethodologyPage locale="en" />
}
