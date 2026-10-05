import { HeroPage } from '@/components/pages/hero-page'
import { getHeroes } from '@/lib/api/assets'
import { pageMetadata } from '@/lib/metadata'

export async function generateStaticParams() {
  const heroes = await getHeroes('en')
  return heroes.map((hero) => ({ id: String(hero.id) }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hero = (await getHeroes('en')).find((item) => item.id === Number(id))
  return hero ? pageMetadata('en', `/heroes/${id}`, hero.name, 'Deadlock hero profile and current tier-list performance.') : {}
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <HeroPage locale="en" id={Number(id)} />
}
