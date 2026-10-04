import { StatusPage } from '@/components/pages/status-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/status', t.status.title, t.status.lede)

export default function Page() {
  return <StatusPage locale="en" />
}
