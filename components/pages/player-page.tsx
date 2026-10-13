'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Search, UserRound, ExternalLink, LoaderCircle, ShieldAlert, Users, History, Trophy, ChevronDown, Plus, Minus } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { getHeroes, getItemCatalog } from '@/lib/api/assets'
import type { HeroEntity, ItemAsset } from '@/lib/api/types'
import { fetchMatchMetadata } from '@/lib/api/matches'
import {
  fetchPlayerMatchHistory,
  fetchPlayerRank,
  searchPlayers,
  fetchSteamProfiles,
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

function MatchHistory({ matches, loading, error, empty, playerName, selectedAccountId, labels, locale }: {
  matches: PlayerMatch[] | null
  loading: boolean
  error: string | null
  empty: string
  playerName: string
  selectedAccountId: number
  locale: Locale
  labels: {
    title: string; team0: string; team1: string; player: string; hero: string
    netWorth: string; damage: string; duration: string; unavailable: string
    loading: string; result: string; win: string; loss: string
    showing: string; previous: string; next: string; page: string
    gameMode: string; matchId: string; souls: string; lastHits: string
    items: string; unknownHero: string; today: string; yesterday: string; daysAgo: string
  }
}) {
  const [openedMatchId, setOpenedMatchId] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState('')
  const [steamNames, setSteamNames] = useState<Record<number, string>>({})
  const [matchSummaries, setMatchSummaries] = useState<Record<string, Record<string, unknown>[]>>({})
  const [summaryNames, setSummaryNames] = useState<Record<number, string>>({})
  const [heroes, setHeroes] = useState<HeroEntity[]>([])
  const [itemAssets, setItemAssets] = useState<ItemAsset[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    void getHeroes(locale).then((items) => {
      if (!cancelled) setHeroes(items)
    }).catch(() => {
      if (!cancelled) setHeroes([])
    })
    return () => { cancelled = true }
  }, [locale])

  useEffect(() => {
    let cancelled = false
    void getItemCatalog(locale).then((items) => {
      if (!cancelled) setItemAssets(items)
    }).catch(() => {
      if (!cancelled) setItemAssets([])
    })
    return () => { cancelled = true }
  }, [locale])

  const heroById = new Map(heroes.map((hero) => [hero.id, hero]))
  // /v1/assets/items is a union of abilities, weapons and shop upgrades. Only
  // shopable upgrades with a real Deadlock item slot are valid inventory entries.
  // This allowlist prevents ability IDs (or unknown metadata IDs) from rendering
  // as fake items in the match scoreboard.
  const inventoryItems = itemAssets.filter((item) => {
    const raw = item as unknown as Record<string, unknown>
    return raw.shopable === true
      && raw.disabled !== true
      && (raw.item_slot_type === 'weapon' || raw.item_slot_type === 'vitality' || raw.item_slot_type === 'spirit')
  })
  const itemById = new Map(inventoryItems.map((item) => [item.id, item]))
  const pageSize = 10
  const visibleMatches = (matches ?? []).slice(0, 100)
  const pageCount = Math.max(1, Math.ceil(visibleMatches.length / pageSize))
  const pageMatches = visibleMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = visibleMatches.length ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, visibleMatches.length)

  useEffect(() => { setCurrentPage(1) }, [matches])

  useEffect(() => {
    let cancelled = false
    const pending = pageMatches.filter((match) => !matchSummaries[String(match.match_id)])
    if (!pending.length) return () => { cancelled = true }

    void (async () => {
      const found: Record<string, Record<string, unknown>[]> = {}
      const accountIds = new Set<number>()
      let cursor = 0
      const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
        while (cursor < pending.length && !cancelled) {
          const match = pending[cursor++]
          try {
            const response = asRecord(await fetchMatchMetadata(match.match_id))
            const info = asRecord(response?.match_info)
            const matchPlayers = Array.isArray(info?.players)
              ? info.players.map(asRecord).filter((player): player is Record<string, unknown> => player !== null)
              : []
            found[String(match.match_id)] = matchPlayers
            for (const player of matchPlayers) {
              if (typeof player.account_id === 'number' && Number.isSafeInteger(player.account_id) && player.account_id > 0) accountIds.add(player.account_id)
            }
          } catch {
            // Remember unavailable metadata so a failed match does not trigger an endless retry loop.
            found[String(match.match_id)] = []
          }
        }
      })
      await Promise.all(workers)
      if (cancelled) return
      const ids = [...accountIds]
      const profiles = await Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => fetchSteamProfiles(ids.slice(index * 100, (index + 1) * 100)).catch(() => [])))
      if (cancelled) return
      const names: Record<number, string> = {}
      for (const profile of profiles.flat()) {
        if (typeof profile.account_id === 'number' && typeof profile.personaname === 'string' && profile.personaname.trim()) names[profile.account_id] = profile.personaname.trim()
      }
      if (Object.keys(found).length) setMatchSummaries((current) => ({ ...current, ...found }))
      if (Object.keys(names).length) setSummaryNames((current) => ({ ...current, ...names }))
    })()
    return () => { cancelled = true }
  }, [pageMatches, matchSummaries])


  async function toggleMatch(match: PlayerMatch) {
    const id = String(match.match_id)
    if (openedMatchId === id) { setOpenedMatchId(null); return }
    setOpenedMatchId(id)
    setMetadata(null)
    setMetadataError('')
    setSteamNames({})
    setMetadataLoading(true)
    try {
      const response = asRecord(await fetchMatchMetadata(Number(id)))
      setMetadata(response)
      if (!response) {
        setMetadataError(labels.unavailable)
      } else {
        const info = asRecord(response.match_info)
        const matchPlayers = Array.isArray(info?.players)
          ? info.players.map(asRecord).filter((player): player is Record<string, unknown> => player !== null)
          : []
        const accountIds = [...new Set(matchPlayers
          .map((player) => player.account_id)
          .filter((accountId): accountId is number => typeof accountId === 'number' && Number.isSafeInteger(accountId) && accountId > 0))]
        if (accountIds.length) {
          try {
            const profiles = await fetchSteamProfiles(accountIds)
            const names: Record<number, string> = {}
            for (const profile of profiles) {
              if (typeof profile.account_id === 'number' && typeof profile.personaname === 'string' && profile.personaname.trim()) {
                names[profile.account_id] = profile.personaname.trim()
              }
            }
            setSteamNames(names)
          } catch {
            // Match metadata remains usable if Steam profile lookup is unavailable.
          }
        }
      }
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
    return <section key={team} className="min-w-0 overflow-hidden border border-border bg-card/70">
      <h4 className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-3 font-display font-bold uppercase tracking-wide">
        <span>{title}</span><span className="font-mono text-xs text-muted-foreground">{members.length}</span>
      </h4>
      {!members.length ? <p className="px-3 py-4 text-sm text-muted-foreground">{labels.unavailable}</p> : <ol className="divide-y divide-border/80">
        {members.map((player, index) => {
          const accountId = typeof player.account_id === 'number' ? player.account_id : null
          const snapshots = Array.isArray(player.stats) ? player.stats : []
          const finalStats = snapshots.length ? asRecord(snapshots[snapshots.length - 1]) : null
          const kills = typeof player.kills === 'number' ? player.kills : finalStats?.kills
          const deaths = typeof player.deaths === 'number' ? player.deaths : finalStats?.deaths
          const assists = typeof player.assists === 'number' ? player.assists : finalStats?.assists
          const netWorth = typeof player.net_worth === 'number' ? player.net_worth : finalStats?.net_worth
          const damage = finalStats?.player_damage ?? player.player_damage
          const heroId = typeof player.hero_id === 'number' ? player.hero_id : null
          const hero = heroId === null ? null : heroById.get(heroId)
          const label = accountId === selectedAccountId ? playerName : accountId === null ? labels.player : steamNames[accountId] ?? (typeof player.name === 'string' && player.name.trim() ? player.name.trim() : `#${accountId}`)
          // Match metadata records every item purchase with its game time and sale time.
          // Build the final inventory from those purchase events, not periodic player stats
          // (which may contain ability/upgrades data with a similar shape).
          const rawItems = Array.isArray(player.items) ? player.items : []
          const purchases = rawItems.map((value, sourceIndex) => {
            const record = asRecord(value)
            if (!record) return null

            // Metadata variants may expose both item_id and upgrade_id. Accept
            // only an ID that resolves to a known shopable upgrade; never render
            // the raw numeric ID as a fallback, because it may identify an ability.
            const toId = (value: unknown) => {
              const id = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
              return Number.isSafeInteger(id) && id > 0 ? id : null
            }
            const itemId = [toId(record.upgrade_id), toId(record.item_id)]
              .find((candidate): candidate is number => candidate !== null && itemById.has(candidate))
            if (itemId === undefined) return null

            const rawGameTime = record.game_time_s
            const gameTime = typeof rawGameTime === 'number' ? rawGameTime : typeof rawGameTime === 'string' ? Number(rawGameTime) : NaN
            const rawSoldTime = record.sold_time_s
            const soldTime = typeof rawSoldTime === 'number' ? rawSoldTime : typeof rawSoldTime === 'string' ? Number(rawSoldTime) : 0
            return { itemId, gameTime: Number.isFinite(gameTime) ? gameTime : sourceIndex, soldTime, sourceIndex }
          }).filter((purchase): purchase is { itemId: number; gameTime: number; soldTime: number; sourceIndex: number } => purchase !== null)
            .filter((purchase) => purchase.soldTime <= 0)
            .sort((a, b) => a.gameTime - b.gameTime || a.sourceIndex - b.sourceIndex)
          const inventorySlots = purchases.slice(-10).map((purchase) => purchase.itemId)
          const visibleInventory = Array.from({ length: 10 }, (_, slotIndex) => inventorySlots[slotIndex] ?? null)
          return <li key={accountId ?? index} className={accountId === selectedAccountId ? 'bg-primary/5' : ''}>
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted-foreground">{index + 1}</span>
              {hero?.icon ? <img src={hero.icon} alt="" loading="lazy" className="size-12 shrink-0 border border-border bg-background object-cover" /> : <span className="grid size-12 shrink-0 place-items-center border border-border bg-background font-mono text-xs text-muted-foreground">{heroId ?? '—'}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate font-semibold">{hero?.name ?? (heroId === null ? labels.unknownHero : `${labels.hero} #${heroId}`)}</span>
                  <span className="truncate text-xs font-semibold text-primary">{label}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{formatNumber(kills)} / {formatNumber(deaths)} / {formatNumber(assists)}</span>
                  <span>{labels.souls}: <span className="font-mono text-foreground">{formatNumber(netWorth)}</span></span>
                  <span>{labels.damage}: <span className="font-mono text-foreground">{formatNumber(damage)}</span></span>
                </div>
                <div className="mt-2 grid w-fit grid-cols-5 gap-1.5" aria-label={labels.items}>{visibleInventory.map((itemId, itemIndex) => {
                  const item = itemId === null ? undefined : itemById.get(itemId)
                  const rawItem = item as unknown as Record<string, unknown> | undefined
                  const itemName = typeof rawItem?.name === 'string' ? rawItem.name : ''
                  const itemSlot = rawItem?.item_slot_type
                  const itemImage = [rawItem?.shop_image_small_webp, rawItem?.shop_image_webp, rawItem?.image_webp, rawItem?.shop_image_small, rawItem?.shop_image, rawItem?.image].find((value): value is string => typeof value === 'string' && value.length > 0)
                  const hasValidItem = itemId !== null && item !== undefined
                  const tone = itemSlot === 'vitality'
                    ? { frame: 'border-emerald-400/65', glow: 'bg-emerald-400/15' }
                    : itemSlot === 'weapon'
                      ? { frame: 'border-orange-400/65', glow: 'bg-orange-400/15' }
                      : { frame: 'border-violet-400/65', glow: 'bg-violet-400/15' }
                  const slotClass = "group relative grid size-10 shrink-0 place-items-center overflow-hidden border shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-transform duration-200 sm:size-11 " + (hasValidItem ? `${tone.frame} ${tone.glow} hover:-translate-y-0.5` : "border-dashed border-border/50 bg-background/30")
                  return <span key={`inventory-${itemIndex}`} title={hasValidItem ? itemName : `Slot ${itemIndex + 1}`} aria-label={hasValidItem ? itemName : `Slot ${itemIndex + 1}`} className={slotClass}>
                    {hasValidItem ? <>
                      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_62%)]" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15" />
                      {itemImage ? <img src={itemImage} alt="" loading="lazy" className="absolute inset-0 size-full object-contain p-0.5 drop-shadow-[0_5px_8px_rgba(0,0,0,0.75)] transition-transform duration-200 group-hover:scale-105" /> : <span className="relative font-mono text-[10px] text-foreground">{itemName.slice(0, 3)}</span>}
                    </> : <span className="font-mono text-[10px] text-muted-foreground/40">{itemIndex + 1}</span>}
                  </span>
                })}</div>
              </div>
            </div>
          </li>
        })}
      </ol>}
    </section>
  }

  return <section className="w-full border border-border bg-card/80">
    <h3 className="border-b border-border px-4 py-3 font-display text-lg font-bold uppercase tracking-wide">{labels.title}</h3>
    {loading && !matches ? <p className="px-4 py-5 text-sm text-muted-foreground">{labels.loading}</p> : null}
    {error ? <p className="px-4 py-5 text-sm text-muted-foreground">{error}</p> : null}
    {!loading && !error && !matches?.length ? <p className="px-4 py-5 text-sm text-muted-foreground">{empty}</p> : null}
    {visibleMatches.length ? <ul className="divide-y divide-border">{pageMatches.map((match) => {
      const id = String(match.match_id)
      const isOpen = openedMatchId === id
      return <li key={id}>
        <button type="button" aria-expanded={isOpen} onClick={() => void toggleMatch(match)} className="group flex h-[110px] w-full items-stretch gap-0 overflow-hidden text-left transition-colors hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span aria-hidden className={`w-1 shrink-0 sm:w-1.5 ${match.player_match_outcome === 1 ? 'bg-emerald-500' : match.player_match_outcome === 2 ? 'bg-rose-500' : 'bg-muted-foreground/50'}`} />
          <span className="flex w-[40%] min-w-0 shrink-0 flex-col justify-center gap-1.5 border-r border-border px-2 py-2 sm:px-3">
            <span className="flex min-w-0 items-center gap-2">
              {heroById.get(match.hero_id)?.icon ? <img src={heroById.get(match.hero_id)?.icon ?? ''} alt="" loading="lazy" className="size-10 shrink-0 border border-border bg-background object-cover sm:size-11" /> : <span className="grid size-10 shrink-0 place-items-center border border-border bg-background font-mono text-xs sm:size-11">{match.hero_id}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-bold tabular-nums text-foreground">{Math.floor(match.match_duration_s / 60)}:{String(match.match_duration_s % 60).padStart(2, '0')}</span>
                <span className="block truncate text-[10px] font-semibold text-muted-foreground">{heroById.get(match.hero_id)?.name ?? `${labels.hero} #${match.hero_id}`}</span>
              </span>
              <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-sm border border-border bg-card/90 text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary ${isOpen ? 'border-primary/50 text-primary' : ''}`}>{isOpen ? <Minus size={13} /> : <Plus size={13} />}</span>
            </span>
            <span className="grid grid-cols-4 gap-1">
              {([{ label: 'K', value: match.player_kills }, { label: 'D', value: match.player_deaths }, { label: 'A', value: match.player_assists }] as const).map((stat) => <span key={stat.label} className="min-w-0 border border-border/70 bg-background/50 px-1 py-0.5 text-center"><span className="block text-[8px] font-bold leading-tight text-muted-foreground">{stat.label}</span><span className="block truncate font-mono text-xs font-bold leading-tight tabular-nums text-foreground sm:text-sm">{formatNumber(stat.value)}</span></span>)}
              <span className="min-w-0 border border-primary/30 bg-primary/5 px-1 py-0.5 text-center"><span className="block text-[8px] font-bold leading-tight text-primary">◈</span><span className="block truncate font-mono text-[10px] font-bold leading-tight tabular-nums text-foreground sm:text-xs">{new Intl.NumberFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(match.net_worth)}</span></span>
            </span>
            <span className="flex min-w-0 items-center justify-between gap-1 text-[9px] text-muted-foreground">
              <span className="truncate">{new Intl.DateTimeFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit' }).format(new Date(match.start_time * 1000))}</span>
              <span className="shrink-0 font-mono">#{id}</span>
            </span>
            <span className="truncate text-[9px] leading-none text-muted-foreground">
              {(() => {
                const elapsedDays = Math.max(0, Math.floor((Date.now() / 1000 - match.start_time) / 86400))
                return elapsedDays === 0 ? labels.today : elapsedDays === 1 ? labels.yesterday : labels.daysAgo.replace('{count}', String(elapsedDays))
              })()}
            </span>
          </span>
          <span className="flex w-[60%] min-w-0 items-stretch">
          {[0, 1].map((team) => {
            const members = (matchSummaries[id] ?? []).filter((player) => player.team === team).slice(0, 6)
            return <span key={team} className={`flex min-w-0 flex-1 flex-col justify-center px-1 sm:px-1.5 ${team === 0 ? 'border-r border-border' : 'pr-4'}`}>
              <span className={`mb-0.5 truncate border-b pb-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${team === 0 ? 'border-emerald-500/40 text-emerald-400' : 'border-rose-500/40 text-rose-400'}`}>{team === 0 ? labels.team0 : labels.team1}</span>
              {members.length ? members.map((player, index) => {
                const accountId = typeof player.account_id === 'number' ? player.account_id : null
                const heroId = typeof player.hero_id === 'number' ? player.hero_id : null
                const hero = heroId === null ? null : heroById.get(heroId)
                const name = accountId === selectedAccountId ? playerName : accountId === null ? labels.player : summaryNames[accountId] ?? (typeof player.name === 'string' && player.name.trim() ? player.name.trim() : `#${accountId}`)
                const kills = typeof player.kills === 'number' ? player.kills : undefined
                const deaths = typeof player.deaths === 'number' ? player.deaths : undefined
                const assists = typeof player.assists === 'number' ? player.assists : undefined
                const stats = Array.isArray(player.stats) ? player.stats : []
                const finalStats = stats.length ? asRecord(stats[stats.length - 1]) : null
                const kd = [kills ?? finalStats?.kills, deaths ?? finalStats?.deaths, assists ?? finalStats?.assists].map((value) => typeof value === 'number' ? formatNumber(value) : '—').join('/')
                return <span key={accountId ?? index} className={`flex h-[15px] min-w-0 items-center gap-1 ${accountId === selectedAccountId ? 'font-bold text-primary' : 'text-foreground/90'}`}>
                  {hero?.icon ? <img src={hero.icon} alt="" loading="lazy" className="size-[14px] shrink-0 border border-border/70 object-cover sm:size-[15px]" /> : <span className="grid size-[14px] shrink-0 place-items-center border border-border/70 font-mono text-[7px]">{heroId ?? '·'}</span>}
                  <span title={name} className="min-w-0 flex-1 truncate text-[10px] leading-none sm:text-[11px]">{name}</span>
                  <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground sm:text-[10px]">{kd}</span>
                </span>
              }) : <span className="text-[10px] text-muted-foreground">{labels.loading}</span>}
            </span>
          })}
          </span>
        </button>
        {isOpen ? <div className="space-y-4 border-t border-border bg-background/40 p-3 sm:p-4">
          {metadataLoading ? <p role="status" className="py-3 text-sm text-muted-foreground"><LoaderCircle size={15} className="mr-2 inline animate-spin" />{labels.loading}</p> : null}
          {metadataError ? <p role="status" className="py-3 text-sm text-muted-foreground">{metadataError}</p> : null}
          {!metadataLoading && !metadataError && matchInfo ? <>
            <div className={match.player_match_outcome === 1 ? 'border border-emerald-500/30 bg-emerald-500/5 p-4' : 'border border-rose-500/25 bg-rose-500/5 p-4'}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {heroById.get(match.hero_id)?.icon ? <img src={heroById.get(match.hero_id)?.icon ?? ''} alt="" className="size-20 shrink-0 border border-border bg-background object-cover" /> : <div className="grid size-20 shrink-0 place-items-center border border-border bg-background font-mono text-sm">{match.hero_id}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{labels.matchId} #{id}</span><span>·</span><span>{labels.gameMode} {match.game_mode}</span>
                  </div>
                  <h4 className="mt-1 font-display text-2xl font-bold uppercase">{match.player_match_outcome === 1 ? labels.win : labels.loss}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{heroById.get(match.hero_id)?.name ?? `${labels.hero} #${match.hero_id}`} <span className="px-1">·</span> {new Intl.DateTimeFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(match.start_time * 1000))} <span className="px-1">·</span> {labels.duration} {duration === null ? '—' : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-border/70 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">K</p><p className="font-mono text-lg font-bold">{formatNumber(match.player_kills)}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">D</p><p className="font-mono text-lg font-bold">{formatNumber(match.player_deaths)}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">A</p><p className="font-mono text-lg font-bold">{formatNumber(match.player_assists)}</p></div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-px border border-border/70 bg-border sm:grid-cols-4">
                <div className="bg-background/80 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.souls}</p><p className="mt-1 font-mono font-bold">{formatNumber(match.net_worth)}</p></div>
                <div className="bg-background/80 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.lastHits}</p><p className="mt-1 font-mono font-bold">{formatNumber(match.last_hits)}</p></div>
                <div className="bg-background/80 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.hero}</p><p className="mt-1 font-mono font-bold">{formatNumber(match.hero_level)}</p></div>
                <div className="bg-background/80 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels.player}</p><p className="mt-1 font-mono font-bold">{players.length}</p></div>
              </div>
            </div>
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
          <MatchHistory matches={history.data} loading={history.loading} error={history.error} empty={t.noData} playerName={selected.personaname || t.unknownPlayer} selectedAccountId={Number(selected.account_id)} labels={t.matchDetails} locale={locale} />
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
