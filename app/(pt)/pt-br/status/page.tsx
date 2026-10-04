import { StatusPage } from '@/components/pages/status-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('pt-br')
export const metadata = pageMetadata('pt-br', '/status', t.status.title, t.status.lede)

export default function Page() {
  return <StatusPage locale="pt-br" />
}
