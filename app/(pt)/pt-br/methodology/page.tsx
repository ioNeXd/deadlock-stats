import { MethodologyPage } from '@/components/pages/methodology-page'
import { getMethodology } from '@/lib/i18n/methodology'
import { pageMetadata } from '@/lib/metadata'

const m = getMethodology('pt-br')
export const metadata = pageMetadata('pt-br', '/methodology', m.title, m.lede)

export default function Page() {
  return <MethodologyPage locale="pt-br" />
}
