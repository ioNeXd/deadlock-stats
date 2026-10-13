'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Search, UserRound, ExternalLink, LoaderCircle, ShieldAlert, Users, History, Trophy, ChevronDown } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { fetchMatchMetadata } from '@/lib/api/matches'
import {
  fetchPlayerMatchHistory,
  fetchPlayerRank,
  searchPlayers,
  type PlayerMatch,
  type PlayerRank,
  type SteamProfile,
} from '@/lib/api/players'
import { PageHeader } from './page-header'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

type DataState<T> = { data: T | null; error: string | null; loading: boolean }

function formatNumber(value: unknown) {
  if (typeof value === 'number') return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function MatchHistory({ matches, loading, error, empty, playerName, selectedAccountId, labels }: {
  matches: PlayerMatch[] | null
  loading: boolean
  error: string | null
  empty: string
  playerName: string
  selectedAccountId: number
  labels: {
    title: string; team0: string; team1: string; player: string; hero: string
    netWorth: string; damage: string; duration: string; unavailable: string
    loading: string; result: string; win: string; loss: string
    showing: string; previous: string; next: string; page: string
  }
}) {
  const [openedMatchId, setOpenedMatchId] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15
  const visibleMatches = (matches ?? []).slice(0, 100)
  const pageCount = Math.max(1, Math.ceil(visibleMatches.length / pageSize))
  const pageMatches = visibleMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = visibleMatches.length ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, visibleMatches.length)

  useEffect(() => { setCurrentPage(1) }, [matches])

  async function toggleMatch(match: PlayerMatch) {
    const id = String(match.match_id)
    if (openedMatchId === id) { setOpenedMatchId(null); return }
    setOpenedMatchId(id)
    setMetadata(null)
    setMetadataError('')
    setMetadataLoading(true)
    try {
      const response = asRecord(await fetchMatchMetadata(Number(id)))
      setMetadata(response)
      if (!response) setMetadataError(labels.unavailable)
    } catch {
      setMetadataError(labels.unavailable)
    } finally {
      setMetadataLoading(false)
    }
  }

  const matchInfo = asRecord(metadata?.match_info)
  const players = Array.isArray(matchInfo?.players) ? matchInfo.players.map(asRecord).filter((p): p is Record<string, unknown> => p !== null) : []
  const duration = typeof matchInfo?.duration_s === 'number' ? matchInfo.duration_s : null

  function renderTeam(team: number, title: string) {
    const members = players.filter((player) => player.team === team)
    return <section key={team} className="min-w-0 border border-border bg-background/70">
      <h4 className="border-b border-border px-3 py-2 font-display font-bold uppercase tracking-wide">{title}<span className="ml-2 text-xs text-muted-foreground">({members.length})</span></h4>
      {!members.length ? <p className="px-3 py-4 text-sm text-muted-foreground">{labels.unavailable}</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">{labels.player}</th><th className="px-3 py-2">{labels.hero}</th><th className="px-3 py-2">K/D/A</th><th className="px-3 py-2">{labels.netWorth}</th><th className="px-3 py-2">{labels.damage}</th></tr></thead>
          <tbody>{members.map((player, index) => {
            const accountId = typeof player.account_id === 'number' ? player.account_id : null
            const snapshots = Array.isArray(player.stats) ? player.stats : []
            const finalStats = snapshots.length ? asRecord(snapshots[snapshots.length - 1]) : null
            const kills = typeof player.kills === 'number' ? player.kills : finalStats?.kills
            const deaths = typeof player.deaths === 'number' ? player.deaths : finalStats?.deaths
            const assists = typeof player.assists === 'number' ? player.assists : finalStats?.assists
            const netWorth = typeof player.net_worth === 'number' ? player.net_worth : finalStats?.net_worth
            const damage = finalStats?.player_damage ?? player.player_damage
            const label = accountId === selectedAccountId ? playerName : accountId === null ? labels.player : `#${accountId}`
            return <tr key={accountId ?? index} className="border-t border-border/70">
              <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>
              <td className="px-3 py-2">{formatNumber(player.hero_id)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono">{formatNumber(kills)}/{formatNumber(deaths)}/{formatNumber(assists)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono">{formatNumber(netWorth)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono">{formatNumber(damage)}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </section>
  }

  return <section className="border border-border bg-card/80">
    <h3 className="border-b border-border px-4 py-3 font-display text-lg font-bold uppercase tracking-wide">{labels.title}</h3>
    {loading && !matches ? <p className="px-4 py-5 text-sm text-muted-foreground">{labels.loading}</p> : null}
    {error ? <p className="px-4 py-5 text-sm text-muted-foreground">{error}</p> : null}
    {!loading && !error && !matches?.length ? <p className="px-4 py-5 text-sm text-muted-foreground">{empty}</p> : null}
    {visibleMatches.length ? <ul className="divide-y divide-border">{pageMatches.map((match) => {
      const id = String(match.match_id)
      const isOpen = openedMatchId === id
      return <li key={id}>
        <button type="button" aria-expanded={isOpen} onClick={() => void toggleMatch(match)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span className="min-w-0 flex-1"><span className="block font-semibold">#{id}</span><span className="block text-xs text-muted-foreground">{labels.duration}: {Math.floor(match.match_duration_s / 60)}:{String(match.match_duration_s % 60).padStart(2, '0')} · {labels.hero}: {match.hero_id}</span></span>
          <span className="font-mono text-sm">{match.player_kills}/{match.player_deaths}/{match.player_assists}</span>
          <span className={match.player_match_outcome === 1 ? 'text-sm font-semibold text-primary' : 'text-sm text-muted-foreground'}>{labels.result}: {match.player_match_outcome === 1 ? labels.win : labels.loss}</span>
          <ChevronDown size={17} aria-hidden className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen ? <div className="space-y-3 border-t border-border p-3 sm:p-4">
          {metadataLoading ? <p role="status" className="py-3 text-sm text-muted-foreground"><LoaderCircle size={15} className="mr-2 inline animate-spin" />{labels.loading}</p> : null}
          {metadataError ? <p role="status" className="py-3 text-sm text-muted-foreground">{metadataError}</p> : null}
          {!metadataLoading && !metadataError && matchInfo ? <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-wider text-muted-foreground"><span>{labels.duration}: {duration === null ? '—' : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}</span><span>{labels.player}: {players.length}</span></div>
            <div className="grid gap-3 xl:grid-cols-2">{renderTeam(0, labels.team0)}{renderTeam(1, labels.team1)}</div>
          </> : null}
        </div> : null}
      </li>
    })}</ul> : null}
    {visibleMatches.length > 0 ? <nav aria-label={labels.title} className="flex flex-col items-center justify-center gap-3 border-t border-border px-4 py-4 sm:flex-row">
      <p className="text-center text-xs text-muted-foreground" aria-live="polite">{labels.showing.replace('{start}', String(rangeStart)).replace('{end}', String(rangeEnd)).replace('{total}', String(visibleMatches.length))}</p>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">{labels.previous}</button>
        <span className="min-w-20 text-center text-xs text-muted-foreground">{labels.page.replace('{page}', String(currentPage)).replace('{pages}', String(pageCount))}</span>
        <button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage >= pageCount} className="border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">{labels.next}</button>
      </div>
    </nav> : null}
  </section>
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="min-w-0 bg-card/80 p-3 sm:p-4"><div className="flex min-w-0 items-start gap-2 text-[11px] uppercase leading-snug tracking-wide text-muted-foreground sm:text-xs">{icon}<span className="min-w-0 break-words">{label}</span></div><p className="mt-2 break-words font-display text-xl font-bold text-primary sm:text-2xl">{value}</p></div>
}

export function PlayerPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).playerPage
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SteamProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selected, setSelected] = useState<SteamProfile | null>(null)
  const [rank, setRank] = useState<DataState<PlayerRank>>({ data: null, error: null, loading: false })
  const [history, setHistory] = useState<DataState<PlayerMatch[]>>({ data: null, error: null, loading: false })
  const [profileLoading, setProfileLoading] = useState(false)

  const selectPlayer = useCallback(async (profile: SteamProfile) => {
    const accountId = Number(profile.account_id)
    if (!Number.isSafeInteger(accountId) || accountId < 0) return
    setSelected(profile)
    setResults([])
    setProfileLoading(true)
    setRank({ data: null, error: null, loading: true })
    setHistory({ data: null, error: null, loading: true })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('id', String(accountId))
      window.history.replaceState({}, '', url)
    }
    const settled = await Promise.allSettled([
      fetchPlayerRank(accountId),
      fetchPlayerMatchHistory(accountId),
    ])
    const [r, h] = settled
    setRank(r.status === 'fulfilled' ? { data: r.value, error: null, loading: false } : { data: null, error: errorMessage(r.reason, t.protected), loading: false })
    setHistory(h.status === 'fulfilled' ? { data: h.value, error: null, loading: false } : { data: null, error: errorMessage(h.reason, t.protected), loading: false })
    setProfileLoading(false)
  }, [t.protected])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id || !/^\d+$/.test(id)) return
    const accountId = Number(id)
    void searchPlayers(id).then((profiles) => {
      const profile = profiles.find((item) => Number(item.account_id) === accountId)
      if (profile) void selectPlayer(profile)
      else setSearchError(t.notFound)
    }).catch(() => setSearchError(t.searchError))
  }, [selectPlayer, t.notFound, t.searchError])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    setSelected(null)
    try {
      const profiles = await searchPlayers(query)
      setResults(profiles)
      if (!profiles.length) setSearchError(t.notFound)
    } catch (error) {
      setSearchError(errorMessage(error, t.searchError))
    } finally {
      setSearching(false)
    }
  }

  const isLoading = profileLoading || rank.loading || history.loading
  const accountId = selected ? String(selected.account_id) : ''
  const rankData = rank.data as (PlayerRank & Record<string, unknown>) | null

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lede={t.lede} />
      <form onSubmit={handleSearch} className="mt-7 flex flex-col gap-2 border border-border bg-card/80 p-3 sm:flex-row">
        <label htmlFor="player-search" className="sr-only">{t.searchLabel}</label>
        <div className="relative min-w-0 flex-1">
          <Search size={18} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input id="player-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} autoComplete="off" className="h-12 w-full border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <button type="submit" disabled={searching || !query.trim()} className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-5 font-display font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
          {searching ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}{t.searchButton}
        </button>
      </form>
      {searchError ? <p role="status" className="mt-3 border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">{searchError}</p> : null}
      {results.length ? <section className="mt-4 border border-border bg-card/80"><h2 className="border-b border-border px-4 py-3 font-display text-lg font-bold uppercase">{t.results}</h2><ul className="divide-y divide-border">{results.map((profile) => (
        <li key={String(profile.account_id)}><button type="button" onClick={() => void selectPlayer(profile)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50">
          {profile.avatar ? <img src={profile.avatar} alt="" className="size-12 rounded-full border border-border object-cover" /> : <span className="grid size-12 place-items-center rounded-full bg-muted"><UserRound /></span>}
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{profile.personaname || t.unknownPlayer}</span><span className="block text-xs text-muted-foreground">SteamID3: {profile.account_id} · {t.matches30d}: {formatNumber(profile.matches_played_last_30d)}</span></span>
          <ExternalLink size={16} className="text-muted-foreground" />
        </button></li>
      ))}</ul></section> : null}
      {selected ? <div className="mt-8 space-y-5">
        <section className="min-w-0 border border-border bg-card/90">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {selected.avatar ? <img src={selected.avatar} alt="" className="size-20 rounded-full border-2 border-primary/50 object-cover" /> : <span className="grid size-20 place-items-center rounded-full bg-muted"><UserRound size={34} /></span>}
            <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.2em] text-primary">{t.profile}</p><h2 className="mt-1 break-words font-display text-3xl font-bold uppercase">{selected.personaname || t.unknownPlayer}</h2><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><p>SteamID3: {accountId}</p><p>{t.accountId}: {accountId}</p></div></div>
            {selected.profileurl ? <a href={selected.profileurl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 self-start border border-border px-3 py-2 text-sm hover:bg-accent">{t.steamProfile}<ExternalLink size={14} /></a> : null}
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label={t.matches30d} value={formatNumber(selected.matches_played_last_30d)} icon={<History size={15} />} />
            <StatCard label={t.lastTeamRank} value={formatNumber(selected.last_team_avg_badge)} icon={<Trophy size={15} />} />
            <StatCard label={t.badge} value={rankData ? formatNumber(rankData.badge ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
            <StatCard label={t.rank} value={rankData ? formatNumber(rankData.rank ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
            <StatCard label={t.subrank} value={rankData ? formatNumber(rankData.subrank ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
          </div>
        </section>
        {rank.error ? <p role="status" className="border border-border px-4 py-3 text-sm text-muted-foreground"><ShieldAlert className="mr-2 inline" size={16} />{rank.error}</p> : null}
        <div className="w-full">
          <MatchHistory matches={history.data} loading={history.loading} error={history.error} empty={t.noData} playerName={selected.personaname || t.unknownPlayer} selectedAccountId={Number(selected.account_id)} labels={t.matchDetails} />
        </div>
        {isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />{t.loading}</p> : null}
        <p className="text-xs text-muted-foreground">{t.dataNote}</p>
      </div> : null}
      {!selected && !results.length && !searchError ? <div className="mt-8 border border-dashed border-border px-6 py-12 text-center"><Users className="mx-auto text-primary" size={30} /><p className="mt-3 font-display text-xl font-bold uppercase">{t.emptyTitle}</p><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t.emptyBody}</p></div> : null}
    </main>
  )
}

function errorMessage(error: unknown, protectedMessage: string) {
  if (error instanceof ApiError && error.status === 403) return protectedMessage
  if (error instanceof ApiError && error.status === 404) return 'Not found'
  return error instanceof Error ? error.message : protectedMessage
}
