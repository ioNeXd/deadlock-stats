# AGENTS.md

Read this first. It is the handover document for anyone, human or AI agent, taking over or contributing to **Almanaque (Deadlock-Stats)**. It states what the project is, the rules that must not be broken, the API traps that already cost us thinking time, and what is still undecided.

For the full design read [ARCHITECTURE.md](ARCHITECTURE.md). For the user-facing summary read [README.md](README.md).

## 1. Project in one paragraph

A static website on GitHub Pages that presents the data of the community-run Deadlock API (`https://api.deadlock-api.com`, OpenAPI 3.1, MIT) as fast, honest, mobile-friendly pages. No backend, no accounts, no tracking. Launch feature: **tier lists by rank** (heroes and items; win rate, pick rate, tier S to F; sortable, searchable). Later: hero pages, builds, player tracker, Games tab, leaderboard, map. Default language English, Brazilian Portuguese at `/pt-br/`.

## 2. Current state

- **Phase: planning.** Design is settled, **no code exists yet**. Do not describe unbuilt features as working.
- Next step: milestone **M0**, the spikes in ARCHITECTURE.md section 18, then one vertical slice.
- Open maintainer decisions are listed in section 10.

## 3. Stack

TypeScript (strict), Astro (static output), Preact with `@preact/signals`, `openapi-typescript`, `openapi-fetch`, uPlot, Biome, Vitest, Playwright, Lighthouse CI, pnpm, GitHub Actions, GitHub Pages.

Commands (planned, confirm against `package.json` once the scaffold exists):

```bash
pnpm install
pnpm gen:api        # regenerate types from the OpenAPI spec
pnpm gen:inventory  # regenerate the API inventory skeleton from the spec
pnpm dev:mock       # fixtures, no network
pnpm dev            # live API
pnpm test
pnpm build
pnpm lighthouse
```

## 4. Hard rules (do not break)

1. **No direct `fetch` in UI or page code.** All data goes through the service layer in `packages/api`. If a function you need is missing, add it there and register it in the inventory.
2. **Types come from the spec.** Never hand-write response types for API data. Regenerate with `pnpm gen:api`.
3. **Every API endpoint has an inventory entry** (`docs/API_INVENTORY.md` and the registry): id (`operationId`), path, group, flags (deprecated, unstable, patreon, internal), rate limit, API cache, site strategy (`snapshot`, `runtime`, `build`), where it is used, implementation status. CI fails if the spec has an endpoint missing from the inventory.
4. **Do not commit Valve assets** (images, icons, video, sounds, fonts from the game). Load them from the API CDN at runtime. The MIT license does not cover them.
5. **No secrets in the client.** Never embed an API key. Patreon-only endpoints stay out of scope unless the user supplies their own key, kept only in their browser.
6. **Third-party content is untrusted.** `/v2/patches` is HTML from external sources: sanitize at build time, never `innerHTML`. Player names and leaderboard names are text only.
7. **Never commit generated snapshots to `main`.** They are produced by workflows and published as part of the Pages artifact.
8. **Every user-visible string goes through i18n.** English is the source of truth. No hard-coded UI text.
9. **Statistics always show context:** sample size, period (patch window), rank band, mode. A number without context does not ship.
10. **Performance budgets are law.** If a change breaks a budget, it goes behind a flag or is redesigned. Do not raise a budget to make CI pass without an ADR.
11. **Do not add dependencies casually.** Check bundle impact first. Prefer platform features. Heavy libraries (map libraries, ICU, full table or chart suites) need an ADR.
12. **Never add analytics or tracking** without an explicit maintainer decision.
13. **Be a good API citizen:** respect cache lifetimes, de-duplicate in-flight requests, no polling faster than 30 to 60 seconds, prefer snapshots for common views.
14. **Unfinished modules live behind a flag** and are not in the main navigation.
15. **Record decisions.** Anything that changes architecture gets an ADR in `docs/adr/`. Do not reopen decided topics without new evidence.

## 5. API traps (learned from reading the spec)

Keep this list current. When you discover a new trap, add it here.

**Filtering and windows**
- Analytics endpoints **cannot filter by build or patch.** They filter by `min/max_unix_timestamp` and `min/max_match_id`. A patch window is a time window.
- Default analytics window is the **last 30 days**, which mixes patches. Our default is "since the last big patch".
- `steam-info` `version_datetime` has **no timezone**. Do not assume UTC without checking against a forum post `pub_date`.
- `/v1/patches/big-days` is **maintained by hand** and can lag hours behind a release.
- `badge-distribution` clamps `min_unix_timestamp` to the start of the first ranked season: ranks only exist from there.

**Ranks**
- Badge encoding: `badge = tier * 10 + subrank` (tier from the first digits, subrank the last digit). Filters use `min_average_badge`/`max_average_badge`, range 0 to 116.
- Eternus subranks are percentile-based and recomputed daily by Valve; within Eternus the badge is the one the player entered the match with.
- All **MMR endpoints are deprecated**. Use `/v1/players/{id}/rank`, `/v1/players/rank?account_ids=`, `/v1/players/rank/distribution`, and `ranked_display_badge` / `ranked_delta` in match history. Do not implement `/mmr*` or `rank-predict*`.

**Analytics specifics**
- `hero-stats` supports `bucket=avg_badge`: one request returns heroes per badge.
- `item-stats` has **no** `avg_badge` bucket. Rank bands require one request per band.
- Corrupted items (build 6711+) share the normal item id. Default `corrupted_items=exclude`. Corrupted items only exist in matches from 2026-09-29.
- Pick-rate math must be defined once and documented. `matches` vs `players` in `item-stats` still needs verification.
- `item-flow-stats` provides `adjusted_win_rate` because raw item win rate is confounded by wealth. Use it for items where possible.
- `lane-matchup-stats` and `lane-soul-curve` are marked **subject to change**. Keep them behind a flag.
- Several buff and timing fields only exist for matches since build 6712 (2026-09-29). Do not average them over older matches.
- Quantiles in `player-stats/metrics` are approximate (DDSketch, ~1% relative error).

**Players and matches**
- Account IDs are **SteamID3**. SteamID64 minus `76561197960265728` gives SteamID3.
- `steam-search` hides inactive profiles by default (needs 5 matches in 30 days).
- `players/{id}/card` and `account-stats` are **Patreon-only** and need the account to be friends with a bot. Out of scope.
- `match-history` `force_refetch` is very strictly rate limited (about 1 per hour per IP). Hide it behind an explicit button.
- Protected accounts return **403**. Treat as a normal state with a respectful message.
- `matches/active` covers only the top 200 matches in the watch tab. Absence does not mean "not playing".
- Leaderboard `possible_account_ids` **can be wrong** (names are not unique). Always confirm before linking to a profile.
- Demo queries are asynchronous (about 55 s) and heavily limited. Experimental only.

**Assets and map**
- Every `/assets/*` endpoint accepts `client_version` (default latest) and most accept `language` (`english`, `brazilian`, ...). `loot-tables` is deprecated (404 from build 6711).
- Objective positions are the **top-left corner** of the marker, not the center. Camps and entities give the point itself.
- Before build 6711 objective positions are a schematic HUD layout. From 6711 they are real map positions.
- From build 6711 `minimap` and `plain` are a street **mask** to draw over a base color.
- Zipline splines and entity `position` are in **world coordinates**. Calibrate world to minimap using entities that carry both forms.
- `entities` may be absent for some builds. Handle it.
- Distances in game data are often in inches (39.37 per meter). Verify units before showing meters.
- Player-selectable and in-development heroes: use `only_active` and `development_state`. A hero without data or art is a normal state.

**Rate limits**
- Limits are **per IP**. Analytics endpoints share one bucket (documented 200 req/min per IP, 400 per key, 2000 global). Shared networks can exhaust it for unrelated users.
- Analytics results are cached by the API for 1 to 12 hours. Re-requesting inside that window gains nothing.

## 6. Conventions

- **Patch window** and **season** are separate selectors. A patch can fall inside a season and a season spans many patches.
- **Cache keys:** `assets:{client_version}:{name}:{locale}`, `stats:{endpoint}:{hash(sorted params)}`, `player:{id}:{resource}:{hash}`.
- **Snapshots:** content-hashed filenames, `manifest.json` as the only mutable pointer, header plus positional columns and rows, `schema_version` in every file, previous generation kept in each artifact.
- **URL state:** filters, tab, sort and search are in the query string so every view is shareable. Dynamic pages use query parameters (`/player/?id=123`), because Pages has no rewrites.
- **Config:** `site` and `base` come from environment variables. All internal links and asset URLs go through a helper that respects `base`.
- **Style:** Biome for lint and format. Strict TypeScript. Small modules. Pure functions for math (tiers, smoothing, patch windows) with unit tests.
- **Commits:** Conventional Commits.
- **Design tokens:** all colors, type and spacing are CSS variables. No hard-coded hex values in components.
- **Accessibility:** never color-only meaning (tiers use a letter plus shape), visible focus, `prefers-reduced-motion`, text alternatives for charts and the map.

## 7. Definition of done

**Global (every module)**
- Data via the service layer, typed from the spec.
- Loading, empty, error and stale states exist and are designed.
- Works on mobile, passes performance and accessibility budgets.
- Sample size, period, rank band and patch visible with every statistic.
- Strings through i18n, both locales.
- Tests for new logic, inventory updated, methodology updated if a metric was added.
- Module behind a flag until complete.

**Per module (additional)**
- **Tier lists:** documented smoothing, minimum-match floor and quantile cutoffs; rank and patch filters in the URL; trend with patch markers; rows below the floor shown as "low data".
- **Hero pages:** works for new or data-less heroes; abilities video loads on demand (`preload="none"` with a poster).
- **Builds:** selection-bias notice; minimum sample before ranking by win rate.
- **Leaderboard:** snapshot date visible; `possible_account_ids` caveat; virtualized list.
- **Player tracker:** opens with at most 2 to 3 requests, the rest per tab; handles 403 and players with no data; nothing stored outside the browser.
- **Games:** sub-tabs load on demand; mode selector (normal, street brawl).
- **Map:** tolerates missing `entities`; layers in the URL; accessible list view; calibrated and validated coordinates.
- **Pipeline:** detects new versions, generates the diff, opens a PR, tolerates missing assets, keeps last known good data.

## 8. Operations cheat sheet

- **Snapshot workflow fails:** the site keeps serving the previous snapshot; check the auto-opened issue; consult `docs/RUNBOOK.md` (to be written).
- **API shape changed:** the scheduled contract test fails first. Run `pnpm gen:api`, fix types, update normalizers, update fixtures.
- **New game patch:** the `patch-watch` workflow opens a PR with the diff. Review heroes, items, camps and entities that changed, then merge. If assets are not published yet, wait for the retry.
- **Scheduled workflows stop:** public repos disable cron after 60 days of inactivity. The keepalive step prevents this; verify it if snapshots go stale.
- **Always display the real snapshot date in the UI.** Cron can run late.

## 9. Where things live (planned)

```
apps/site/            Astro app: pages, islands, styles, i18n
packages/api/         service layer, cache, scheduler
packages/pipeline/    snapshots, tiers, patch index, diffs, validation
packages/ui/          components and design tokens
data/routes/          community map routes (committed, schema-validated)
docs/                 API_INVENTORY.md, METHODOLOGY.md, RUNBOOK.md, adr/
.github/workflows/    ci, deploy, snapshots, patch-watch, contract-test
```

## 10. Open questions (maintainer to decide)

- Confirm the stack (TypeScript, Astro, Preact). It was chosen on the maintainer's delegation and is treated as decided unless changed by an ADR.
- Confirm the MIT license (recommended, not yet explicitly confirmed).
- GitHub account type: personal first (default) or an organization.
- Usage analytics: none by default.
- Donations: only the link to sponsor the Deadlock API by default.
- Time commitment, which sets the realistic size of each milestone.
- Spike results (CORS, response sizes, compression, timezone, map transform) once measured.

## 11. Glossary

- **Badge:** rank code, `tier * 10 + subrank`.
- **Rank band:** range of badges grouped for display (configured in one file).
- **Patch window:** time (or match-id) range that approximates "this patch".
- **Big day:** a major patch date from `/v1/patches/big-days`.
- **Snapshot:** pre-built static JSON of API data, generated by the pipeline.
- **Inventory:** the registry of every API endpoint, its status and where it is used.
- **Island:** an interactive Preact component hydrated inside a static Astro page.
- **Souls:** in-game currency (called gold in some API field names).
- **Corrupted item:** build 6711+ upgrade the Broker swaps for a corrupted version that keeps the normal item's id.

## 12. Disclaimer and credits

Fan project, not affiliated with or endorsed by Valve. *Deadlock* and related assets are Valve's. Data comes from the Deadlock API (`github.com/deadlock-api/deadlock-api`); please support it.
