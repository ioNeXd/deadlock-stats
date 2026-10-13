'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Search, UserRound, ExternalLink, LoaderCircle, ShieldAlert, Users, History, Trophy, ChevronDown } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { fetchMatchMetadata } from '@/lib/api/matches'
import {
  fetchPlayerEnemies,
  fetchPlayerMatchHistory,
  fetchPlayerMates,
  fetchPlayerRank,
  searchPlayers,
  type PlayerEnemy,
  type PlayerMatch,
  type PlayerMate,
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

function DataTable({ title, data, empty, accountNick, accountIdLabel }: { title: string; data: unknown[] | null; empty: string; accountNick?: string; accountIdLabel?: string }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => (data ?? []).map((value, index) => ({
    index,
    record: value && typeof value === 'object' ? value as Record<string, unknown> : { value },
  })), [data])

  return (
    <section className="border border-border bg-card/80">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-display text-lg font-bold uppercase tracking-wide transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span>{title}</span>
          <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      {open ? (
        <div className="border-t border-border">
          {!rows.length ? <p className="px-4 py-5 text-sm text-muted-foreground">{empty}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Field</th><th className="px-4 py-2">Value</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ index, record }) => Object.entries(record).map(([key, value], fieldIndex) => (
                    <tr key={`${index}-${key}`} className="border-t border-border/70 align-top">
                      {fieldIndex === 0 ? <td rowSpan={Object.keys(record).length} className="px-4 py-2 font-mono text-muted-foreground">{index + 1}</td> : null}
                      <th scope="row" className="whitespace-nowrap px-4 py-2 font-medium text-muted-foreground">{key.replaceAll('_', ' ')}</th>
                      <td className="max-w-[34rem] break-words px-4 py-2 font-mono text-xs">{key === 'account_id' && accountIdLabel === key ? (accountNick || formatNumber(value)) : formatNumber(value)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
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
  }
}) {
  const [openedMatchId, setOpenedMatchId] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState('')

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
    {matches?.length ? <ul className="divide-y divide-border">{matches.map((match) => {
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
  </section>
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="border border-border bg-card/80 p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div><p className="mt-2 font-display text-2xl font-bold text-primary">{value}</p></div>
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
  const [mates, setMates] = useState<DataState<PlayerMate[]>>({ data: null, error: null, loading: false })
  const [enemies, setEnemies] = useState<DataState<PlayerEnemy[]>>({ data: null, error: null, loading: false })
  const [profileLoading, setProfileLoading] = useState(false)

  const selectPlayer = useCallback(async (profile: SteamProfile) => {
    const accountId = Number(profile.account_id)
    if (!Number.isSafeInteger(accountId) || accountId < 0) return
    setSelected(profile)
    setResults([])
    setProfileLoading(true)
    setRank({ data: null, error: null, loading: true })
    setHistory({ data: null, error: null, loading: true })
    setMates({ data: null, error: null, loading: true })
    setEnemies({ data: null, error: null, loading: true })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('id', String(accountId))
      window.history.replaceState({}, '', url)
    }
    const settled = await Promise.allSettled([
      fetchPlayerRank(accountId),
      fetchPlayerMatchHistory(accountId),
      fetchPlayerMates(accountId),
      fetchPlayerEnemies(accountId),
    ])
    const [r, h, m, e] = settled
    setRank(r.status === 'fulfilled' ? { data: r.value, error: null, loading: false } : { data: null, error: errorMessage(r.reason, t.protected), loading: false })
    setHistory(h.status === 'fulfilled' ? { data: h.value, error: null, loading: false } : { data: null, error: errorMessage(h.reason, t.protected), loading: false })
    setMates(m.status === 'fulfilled' ? { data: m.value, error: null, loading: false } : { data: null, error: errorMessage(m.reason, t.protected), loading: false })
    setEnemies(e.status === 'fulfilled' ? { data: e.value, error: null, loading: false } : { data: null, error: errorMessage(e.reason, t.protected), loading: false })
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

  const isLoading = profileLoading || rank.loading || history.loading || mates.loading || enemies.loading
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="border border-border bg-card/90">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {selected.avatar ? <img src={selected.avatar} alt="" className="size-20 rounded-full border-2 border-primary/50 object-cover" /> : <span className="grid size-20 place-items-center rounded-full bg-muted"><UserRound size={34} /></span>}
            <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.2em] text-primary">{t.profile}</p><h2 className="mt-1 break-words font-display text-3xl font-bold uppercase">{selected.personaname || t.unknownPlayer}</h2><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><p>SteamID3: {accountId}</p><p>{t.accountId}: {accountId}</p></div></div>
            {selected.profileurl ? <a href={selected.profileurl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 self-start border border-border px-3 py-2 text-sm hover:bg-accent">{t.steamProfile}<ExternalLink size={14} /></a> : null}
          </div>
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
            <StatCard label={t.matches30d} value={formatNumber(selected.matches_played_last_30d)} icon={<History size={15} />} />
            <StatCard label={t.lastTeamRank} value={formatNumber(selected.last_team_avg_badge)} icon={<Trophy size={15} />} />
            <StatCard label="Badge" value={rankData ? formatNumber(rankData.badge ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
            <StatCard label={t.rank} value={rankData ? formatNumber(rankData.rank ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
            <StatCard label="Subrank" value={rankData ? formatNumber(rankData.subrank ?? '—') : (rank.loading ? t.loading : '—')} icon={<Trophy size={15} />} />
          </div>
        </section>
        </div>
        {rank.error ? <p role="status" className="border border-border px-4 py-3 text-sm text-muted-foreground"><ShieldAlert className="mr-2 inline" size={16} />{rank.error}</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <MatchHistory matches={history.data} loading={history.loading} error={history.error} empty={t.noData} playerName={selected.personaname || t.unknownPlayer} selectedAccountId={Number(selected.account_id)} labels={t.matchDetails} />
          <DataTable title={t.mates} data={mates.data as unknown[] | null} empty={mates.loading ? t.loading : mates.error || t.noData} />
          <DataTable title={t.enemies} data={enemies.data as unknown[] | null} empty={enemies.loading ? t.loading : enemies.error || t.noData} />
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
