import { HomePage } from '@/components/pages/home-page'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pageMetadata } from '@/lib/metadata'

const t = getDictionary('pt-br')
export const metadata = pageMetadata('pt-br', '/', t.site.name, t.site.description)

export default function Page() {
  return <HomePage locale="pt-br" />
}
