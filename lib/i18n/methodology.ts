import { MIN_MATCHES, PICK_WEIGHT, TIER_CUTOFFS } from '@/lib/config'
import type { Locale } from './config'

interface Section {
  title: string
  body: string[]
}

interface Methodology {
  eyebrow: string
  title: string
  lede: string
  sections: Section[]
  cutoffsTitle: string
  cutoffsTop: string
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const winWeight = pct(1 - PICK_WEIGHT)
const pickWeight = pct(PICK_WEIGHT)

const en: Methodology = {
  eyebrow: 'Methodology',
  title: 'How the tiers are made',
  lede: 'Every number on this site is computed in the open from public match data. Here is exactly how.',
  sections: [
    {
      title: 'Data',
      body: [
        'Hero and item results come from the community Deadlock API (hero-stats and item-stats), limited to Normal mode, the selected patch window, and the selected rank band by average match badge.',
        'Patch windows start at each major update. The update list is hand-maintained by the API, so this site adds manual dates when it lags.',
      ],
    },
    {
      title: 'Win rate, smoothed',
      body: [
        'Raw win rate swings wildly on small samples. Each row is pulled toward the overall mean by an empirical-Bayes beta prior estimated from the rows themselves, so a hero with 300 games cannot top the list on luck.',
        'The ± figure next to win rate is half the width of a 95% Wilson interval: the plausible range of the true win rate given the sample.',
      ],
    },
    {
      title: 'Score and tiers',
      body: [
        `Score combines smoothed win rate (${winWeight}) and log pick rate (${pickWeight}), each standardized within the current filter. Pick rate is the share of all hero picks in the window.`,
        'Tiers come from score quantiles, not fixed thresholds, so the letter distribution stays stable between patches.',
        `Rows with fewer than ${MIN_MATCHES.heroes.toLocaleString('en-US')} games are listed as "Low data" without a tier.`,
      ],
    },
    {
      title: 'Items',
      body: [
        'Item stats count games where the item was bought. Corrupted items are excluded.',
        'Item win rates are confounded by wealth: the team ahead buys more, and expensive items show up in won games more often. Read them as correlation, not cause. Tiers are computed within the current item filter.',
      ],
    },
  ],
  cutoffsTitle: 'Quantile cutoffs',
  cutoffsTop: 'top {pct}',
}

const ptBr: Methodology = {
  eyebrow: 'Metodologia',
  title: 'Como os tiers são feitos',
  lede: 'Todo número deste site é calculado abertamente a partir de dados públicos de partidas. Veja exatamente como.',
  sections: [
    {
      title: 'Dados',
      body: [
        'Os resultados de heróis e itens vêm da Deadlock API da comunidade (hero-stats e item-stats), limitados ao modo Normal, à janela de patch e à faixa de rank selecionadas pelo badge médio da partida.',
        'As janelas de patch começam em cada grande atualização. A lista de atualizações é mantida à mão pela API, então este site adiciona datas manuais quando ela atrasa.',
      ],
    },
    {
      title: 'Taxa de vitória suavizada',
      body: [
        'A taxa de vitória bruta oscila muito em amostras pequenas. Cada linha é puxada em direção à média geral por um prior beta empírico estimado a partir das próprias linhas, então um herói com 300 partidas não chega ao topo por sorte.',
        'O valor ± ao lado da taxa de vitória é metade da largura de um intervalo de Wilson de 95%: a faixa plausível da taxa real dada a amostra.',
      ],
    },
    {
      title: 'Pontuação e tiers',
      body: [
        `A pontuação combina taxa de vitória suavizada (${winWeight}) e log da taxa de escolha (${pickWeight}), ambas padronizadas dentro do filtro atual. A taxa de escolha é a fração de todas as escolhas de herói na janela.`,
        'Os tiers vêm de quantis da pontuação, não de limites fixos, então a distribuição das letras fica estável entre patches.',
        `Linhas com menos de ${MIN_MATCHES.heroes.toLocaleString('pt-BR')} partidas aparecem como "Poucos dados", sem tier.`,
      ],
    },
    {
      title: 'Itens',
      body: [
        'As estatísticas de itens contam partidas em que o item foi comprado. Itens corrompidos são excluídos.',
        'A taxa de vitória de itens é confundida pela riqueza: o time na frente compra mais, e itens caros aparecem mais em partidas vencidas. Leia como correlação, não causa. Os tiers são calculados dentro do filtro de itens atual.',
      ],
    },
  ],
  cutoffsTitle: 'Cortes por quantil',
  cutoffsTop: 'top {pct}',
}

export function getMethodology(locale: Locale) {
  return locale === 'en' ? en : ptBr
}

export const CUTOFF_ROWS = TIER_CUTOFFS.map(([tier, cutoff], i) => ({
  tier,
  from: i === 0 ? 0 : TIER_CUTOFFS[i - 1][1],
  to: cutoff,
}))
export { pct }
