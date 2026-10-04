import { PICK_WEIGHT, TIER_CUTOFFS } from '@/lib/config'

export type Tier = (typeof TIER_CUTOFFS)[number][0]
export const TIERS: Tier[] = TIER_CUTOFFS.map(([tier]) => tier)

export interface RawStat {
  id: number
  wins: number
  matches: number
}

export interface TierStat extends RawStat {
  winRate: number
  smoothed: number
  low: number
  high: number
  pickRate: number
  score: number
  tier: Tier | null
}

/** Wilson score interval (95% by default). */
export function wilson(wins: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1]
  const p = wins / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return [Math.max(0, (center - margin) / denom), Math.min(1, (center + margin) / denom)]
}

/** Empirical-Bayes beta prior via method of moments. Strength = pseudo-matches added to each row. */
export function estimatePrior(rows: RawStat[]) {
  const totalWins = rows.reduce((sum, r) => sum + r.wins, 0)
  const totalMatches = rows.reduce((sum, r) => sum + r.matches, 0)
  if (rows.length < 2 || totalMatches === 0) return { mean: 0.5, strength: 0 }
  const mean = totalWins / totalMatches
  const observedVar = rows.reduce((sum, r) => sum + (r.wins / r.matches - mean) ** 2, 0) / rows.length
  const samplingVar = rows.reduce((sum, r) => sum + (mean * (1 - mean)) / r.matches, 0) / rows.length
  const trueVar = observedVar - samplingVar
  if (trueVar <= 1e-7) return { mean, strength: 1e6 }
  const strength = Math.min(1e6, Math.max(0, (mean * (1 - mean)) / trueVar - 1))
  return { mean, strength }
}

function zScores(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
  return values.map((v) => (sd === 0 ? 0 : (v - mean) / sd))
}

/** Tier by rank position, using cumulative quantile cutoffs. */
export function tierForRank(index: number, count: number): Tier {
  const fraction = (index + 0.5) / count
  for (const [tier, cutoff] of TIER_CUTOFFS) if (fraction <= cutoff) return tier
  return 'F'
}

export function computeTiers(
  rows: RawStat[],
  totalPicks: number,
  { minMatches, pickWeight = PICK_WEIGHT }: { minMatches: number; pickWeight?: number },
): TierStat[] {
  const valid = rows.filter((r) => r.matches > 0)
  const eligible = valid.filter((r) => r.matches >= minMatches)
  const { mean, strength } = estimatePrior(eligible)

  const stats: TierStat[] = valid.map((r) => {
    const [low, high] = wilson(r.wins, r.matches)
    return {
      ...r,
      winRate: r.wins / r.matches,
      smoothed: (r.wins + strength * mean) / (r.matches + strength),
      low,
      high,
      pickRate: totalPicks > 0 ? r.matches / totalPicks : 0,
      score: Number.NEGATIVE_INFINITY,
      tier: null,
    }
  })

  const ranked = stats.filter((s) => s.matches >= minMatches)
  if (ranked.length === 0) return stats
  const zWin = zScores(ranked.map((s) => s.smoothed))
  const zPick = zScores(ranked.map((s) => Math.log(Math.max(s.pickRate, 1e-9))))
  ranked.forEach((s, i) => {
    s.score = (1 - pickWeight) * zWin[i] + pickWeight * zPick[i]
  })
  ranked.sort((a, b) => b.score - a.score)
  ranked.forEach((s, i) => {
    s.tier = tierForRank(i, ranked.length)
  })
  return stats
}
