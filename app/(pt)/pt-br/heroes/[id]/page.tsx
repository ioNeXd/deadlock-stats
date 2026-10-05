import { HeroPage } from '@/components/pages/hero-page'
import { getHeroes } from '@/lib/api/assets'
import { pageMetadata } from '@/lib/metadata'

export async function generateStaticParams() {
  const heroes = await getHeroes('pt-br')
  return heroes.map((hero) => ({ id: String(hero.id) }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hero = (await getHeroes('pt-br')).find((item) => item.id === Number(id))
  return hero ? pageMetadata('pt-br', `/heroes/${id}`, hero.name, 'Perfil do herói e desempenho atual na tier list de Deadlock.') : {}
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <HeroPage locale="pt-br" id={Number(id)} />
}
