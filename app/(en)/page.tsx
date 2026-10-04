import { HomePage } from '@/components/pages/home-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('en')
export const metadata = pageMetadata('en', '/', t.site.name, t.site.description)

export default function Page() {
  return <HomePage locale="en" />
}
