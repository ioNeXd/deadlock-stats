# Architecture

Status: **design reference + active implementation.** The original design below is preserved for rationale. The current code is a Next.js 16/React 19 static-export implementation. Items marked **[validate]** are assumptions that still require confirmation before new code depends on them.

## 1. Goals and non-goals

**Goals**
- A static site on GitHub Pages that presents everything the Deadlock API offers, fast and readable.
- Lighthouse performance 95+ on mobile, enforced by budgets in CI.
- Open, approachable, maintainable by a small group.

**Non-goals**
- No backend, no user accounts, no server-side secrets.
- No MMR (deprecated upstream) and no direct SQL access (deprecated upstream).
- No Valve assets committed to the repository.
- No real-time streaming beyond light polling.
- Nothing the API does not provide.

## 2. System overview

```
Deadlock API + asset CDN
        ↓
lib/api client + services
        ↓
Next.js server components / static data routes
        ↓
Next.js static export (`out/`)
        ↓
GitHub Pages
```

Three layers in the current implementation:

1. **Build**: Next.js static export calls the existing services and produces HTML/JSON in `out/`.
2. **Application**: Next.js server components and route handlers compose pages and static data.
3. **API layer**: `lib/api` centralizes HTTP, query serialization, in-flight de-duplication and transient retries.

The original Astro/Preact and scheduled-pipeline design remains documented below as future architecture, not as a description of code that already exists.

### 2.1 Current implementation boundary

Implemented:
- Next.js 16 + React 19 static export.
- Hero and item tier-list pages.
- EN/PT-BR i18n structure.
- API services for assets, analytics and patch windows.
- Static `/data/stats/...` JSON routes generated during production build.
- Generated OpenAPI types and API inventory.

Not yet implemented:
- GitHub Actions CI/deploy pipeline beyond build validation.
- Automated snapshot/patch workflows.
- Unit/contract/E2E test suite.
- Broader M2+ modules.

`out/` is a build artifact only and must never be committed to `main`.

## 3. Data strategy

| Domain | Endpoints | Strategy | Freshness |
|---|---|---|---|
| Assets (heroes, items, ranks, map, generic-data) | `/v1/assets/*` | Build time, static JSON per `client_version` | per patch |
| Tier lists, global hero/item stats | `hero-stats`, `item-stats`, `hero-ban-stats` | Snapshot per rank band, runtime for fine filters | ~6 h |
| Builds | `/v1/builds`, `hero-build-stats/{id}` | Snapshot of top builds, runtime for search | ~6 h |
| Leaderboard | `/v1/leaderboard/*` | Hourly snapshot (Valve refreshes hourly) | 1 h |
| Games (aggregates) | `game-stats`, `badge-distribution`, `buff-stats` | Snapshot plus runtime | ~6 h |
| Player | `/v1/players/*`, analytics with `account_ids` | Runtime with cache | on demand |
| Live | `/v1/matches/active` | Runtime, polling every 30 to 60 s | ~30 to 60 s |
| Map | `/v1/assets/map`, `kill-death-stats` | Build for map, runtime for heatmap | per patch |
| Patches | `/v2/patches` | Build, sanitized | daily |

Rate limits are **per IP** and analytics endpoints share one bucket (documented: 200 req/min per IP). Shared networks and CGNAT can exhaust it for unrelated users, which is one reason snapshots are the default path for common views.

### Degradation levels

Every view must know which level it is in and show it.

1. **Live:** snapshots fresh, API reachable.
2. **Throttled:** API slow or 429. Serve cache, show "data from X ago".
3. **Offline API:** snapshots only, global banner.
4. **Stale snapshot:** snapshot older than its freshness window, explicit warning.

## 4. Patches and seasons

Two independent axes. Never merge them in the UI.

- **Patch (balance window):** affects tier lists, items, builds and all game stats.
- **Season (ranked):** affects leaderboards (`leaderboard_id`), rank distribution and the countdown.

Sources: `/v1/assets/client-versions`, `/v1/assets/steam-info/all`, `/v1/patches/big-days` (hand-maintained, may lag hours), `/v2/patches` (forum plus Steam news), `/v1/assets/ranked-seasons`.

**Key constraint:** analytics endpoints cannot filter by build. They filter only by `min/max_unix_timestamp` and `min/max_match_id`. A "patch window" is therefore a time window (or a match-id window) from the patch start to the next patch.

- `version_datetime` in `steam-info` is a naive ISO string with no timezone. **[validate]** the timezone by comparing with the `pub_date` of the matching forum post.
- Matches that started before a patch can end on the new version. Apply a margin after the patch start, or use `min_match_id`. **[validate]** which is more accurate.
- Linking a build to its patch notes has no shared id. Use date proximity, with a manual exceptions file.
- Default window: "since the last big patch" (from `big-days`). Options: last build, free range.

### Patch index (`patches.json`)

Generated at build time by merging the four sources:

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-10-04T12:00:00Z",
  "patches": [
    {
      "client_version": 6712,
      "server_version": 6712,
      "datetime": "2026-09-29T00:00:00Z",   // normalized to UTC after validation
      "is_big": true,
      "season": "<ranked season class_name>",
      "leaderboard_id": 0,
      "notes_url": "https://...",
      "window_start": 1790000000,
      "window_end": null                     // null for the current patch
    }
  ]
}
```

### Automated patch pipeline (the "patch policy")

A scheduled workflow:

1. Compares `client-versions` with the last processed version.
2. On a new version: fetches `/assets/*` for it, generates a **diff** (heroes, items, camps, map entities added/removed/changed), updates `patches.json`.
3. Recomputes snapshots with the new window.
4. Opens an **automatic PR** containing the diff and contract-test results. A human reviews.
5. If assets for the new version are not yet published (the API returns 404 for unavailable versions), retries later without breaking the site.

## 5. Snapshots

### Layout

```
data/
  manifest.json                       single mutable pointer file (small)
  patches.json
  assets/<client_version>/<locale>/   heroes, items, ranks, map, generic-data
  stats/<patch>/<mode>/<rank-band>/   hero-stats, item-stats, ban-stats, ...
  leaderboard/<season>/<region>[/<hero>]
  history/                            small daily series per hero
```

### File format

Header plus positional columns and rows (column names once, not repeated per row):

```jsonc
{
  "schema_version": 1,
  "generated_at": "...",
  "source": "hero_stats",
  "window": { "start": 0, "end": null },
  "filters": { "game_mode": "normal", "min_average_badge": 0, "max_average_badge": 116 },
  "total_matches": 0,
  "columns": ["hero_id", "wins", "losses", "matches", "bans"],
  "rows": [[1, 100, 90, 190, 12]]
}
```

### Rules

- **Content-hashed filenames**, with `manifest.json` as the only mutable file.
- **Keep the previous generation** in each new Pages artifact. Pages replaces the whole site on deploy, so a cached page pointing to an old hash would otherwise 404. The client falls back to the live API on a 404.
- **Last known good:** if validation fails (schema mismatch, empty rows, sudden drop in total matches), keep the previous snapshot and open an issue instead of publishing bad data.
- **Never commit snapshots to `main`.** Generate in the workflow and publish as a Pages artifact (or a throwaway data branch). Frequent data commits bloat git history.
- **Rank bands** are defined in one config file (ranges of `average_badge`), not scattered in code.
- **Size budget** per file (tens of KB), checked in CI.
- The client refuses a `schema_version` newer than it knows and falls back to the runtime path.
- Incremental history: the build downloads the previously published history JSON, appends the new point and republishes, so no data is committed.

## 6. Service layer (`packages/api`)

The single rule: **UI code never calls `fetch` directly.** It calls typed functions from the service layer, which are generated from and tracked by the API inventory.

```
client.ts       openapi-fetch configured with base URL and headers
cache.ts        stale-while-revalidate, IndexedDB, in-flight de-duplication
scheduler.ts    prioritized request queue, token bucket tuned to documented limits
snapshots.ts    reads static JSON through manifest.json
heroes.ts items.ts analytics.ts players.ts leaderboard.ts map.ts builds.ts
index.ts
```

Behavior every function follows:

- One signature, normalized output (never raw responses).
- Resolution order: memory, snapshot (when filters are the defaults), IndexedDB (SWR), network.
- Concurrent identical requests collapse into one in-flight promise.
- Deterministic cache keys: parameters sorted and serialized, so `{a:1,b:2}` equals `{b:2,a:1}`.
- Defaults are centralized (30-day window fallback, `match_mode`, `game_mode`, `min_matches`).
- 429 and errors return cached data with a flag instead of breaking the screen. Typed errors: `ApiError`, `RateLimitError`, `NotFoundError`.
- Asset functions take `client_version` and `language`.

### Cache keys and TTLs

```
assets:{client_version}:{name}:{locale}
stats:{endpoint}:{hash(sorted params)}
player:{account_id}:{resource}:{hash}
```

TTL classes: static (per patch), 1 h, 6 h, 12 h, live (30 to 60 s). Always with a stale-while-revalidate window. Respect the cache lifetimes the API already applies.

### Normalizers (with tests)

`parseBadge` (`badge = tier * 10 + subrank`), `formatRank`, spread-penalty values that may be a list or a string, ICU-style plural strings in pickup labels, Steam ID conversion (SteamID64 minus `76561197960265728` gives SteamID3).

### UI state

Shared filters (mode, rank band, patch, locale) are global signals mirrored to the URL. Hooks such as `useHeroStats(filters)` return `{ data, loading, error, stale }` and call only the service layer.

## 7. Tier list methodology (launch feature)

Documented on a public Methodology page. Rationale: small samples and confounders are where stats sites usually mislead.

1. **Smoothed win rate:** empirical-Bayes shrinkage toward the mean, plus a Wilson interval for display.
2. **Pick rate:** hero matches divided by the sum over all heroes; item pick rate defined against the same filtered population. **[validate]** the exact meaning of `matches` vs `players` in `item-stats` before fixing the formula.
3. **Score:** composite with win rate weighted above pick rate (ban rate shown, not scored initially).
4. **Tiers S, A, B, C, D, F** by configurable **quantile cutoffs** so the letter distribution stays stable between patches.
5. **Minimum matches** above the API default (20): below it, show the row with no tier ("low data").
6. Tiers are never conveyed by color alone (letter plus shape or icon).

Known caveats to state on the page: selection bias (strong players pick strong builds), wealth confounding for items (the leading team buys more items), survivorship in late-game items, and that rank band and patch change everything.

Data notes:
- `hero-stats` supports `bucket=avg_badge`, so one request returns heroes per badge and rank bands are summed client-side or in the pipeline.
- `item-stats` has **no** `avg_badge` bucket. The pipeline makes one request per rank band using `min_average_badge` and `max_average_badge`.
- Corrupted items (build 6711+) are excluded by default (`corrupted_items=exclude`) and get their own view later.
- Snapshots store ids and numbers only. Names and icons are joined from the assets per locale.

## 8. Internationalization

- English default at `/`, Brazilian Portuguese at `/pt-br/` (Astro i18n routing, `hreflang`, language switcher).
- UI strings in per-locale JSON, English as the source of truth and fallback.
- Entity names come from the API with `language=english` and `language=brazilian`, generated at build time.
- Suggest a language with a discreet banner. No automatic redirect (protects SEO, caching and shared links).

## 9. Performance

Targets (to be turned into enforced budgets once measured): Lighthouse mobile 95+, small initial JS per route, good LCP, INP and CLS.

- The default tier-list view is prerendered into the HTML. The island hydrates only for sorting and filtering.
- Tables with dozens of heroes and a few hundred items need no virtualization; use `content-visibility: auto`.
- Images: fixed `width`/`height` (measured at build and stored in a manifest, without copying Valve assets), lazy below the fold, `preconnect` to the CDN.
- Charts with uPlot. The map and heatmap use `<canvas>` (OffscreenCanvas and a Web Worker for heavy work).
- Fonts self-hosted, subset woff2, `font-display: swap`.
- Prefetch on hover or visibility for hero links.
- **Compression [validate]:** do not assume GitHub Pages serves brotli (it may serve gzip only). Check with `curl -sI -H "Accept-Encoding: br" <url>`. Prefer compact formats (positional rows). Cloudflare in front is the optional fix.
- Measure real devices and real-user Web Vitals after launch, not only lab Lighthouse.

## 10. Security and privacy

- Content from `/v2/patches` is third-party HTML. Sanitize at build time (or convert to Markdown). Never `innerHTML` it.
- Player and leaderboard names are untrusted input: render as text.
- CSP through a `<meta>` tag (Pages cannot set headers), restricting `connect-src` and `img-src` to the API and CDN.
- No secrets in the client. Patreon-only endpoints are out of scope unless a user pastes their own key, stored only in their browser.
- Protected accounts return 403: treat as a normal state with a respectful message.
- Recent and favorite players live only in `localStorage`. No server-side search history. No invasive analytics. If usage is ever measured, use a cookieless tool.
- Localized strings contain markup and ICU plural patterns: use a small, tested renderer, not a full ICU library.

## 11. Map (later module)

Source: `/v1/assets/map` plus `generic-data`, baked at build time per `client_version`.

- Image layers: base street mask, mid tunnels, rat tunnels, frame (`background` exists only before build 6711).
- **Objective positions are the top-left corner of the marker** (Core 30% x 8%, icons 10% x 10%); camps and entities give the point itself.
- Before build 6711 objective positions are the HUD's schematic layout, not real positions.
- From 6711 the `minimap` and `plain` images are a street mask intended to be drawn over a base color.
- Zipline splines are in **world coordinates**. Calibrate world to minimap by regressing over entities that have both `position` and `left_relative`/`top_relative`, and cross-check with `radius`. **[validate]** the spline interpolation against the in-game map.
- `entities` is optional (only for builds with the map-entity extract). Handle absence.
- Rendering: single `<canvas>`, offscreen cached layers, spatial-grid hit testing, own sprite icons (the API has none for entities).
- Layers and view state are encoded in the URL. Heatmap queries are debounced and cached.
- Routes are not provided by the API. Routes are project data (`data/routes/*.json`, schema-validated in CI, contributed by PR).

## 12. Repository layout (planned)

```
apps/site/            Astro app: pages, islands, styles, i18n
packages/api/         Service layer, cache, scheduler (publishable on its own)
packages/pipeline/    Build jobs: snapshots, tiers, patch index, diffs, validation
packages/ui/          Shared components and design tokens
data/                 Generated at build, not committed to main
data/routes/          Community routes (committed, schema-validated)
docs/                 API_INVENTORY.md, METHODOLOGY.md, RUNBOOK.md, adr/
.github/workflows/    ci, deploy, snapshots (cron), patch-watch (cron), contract-test (cron)
```

## 13. CI/CD and operations

- **ci:** lint (Biome), typecheck, unit tests, API-inventory check (fails if the spec has an endpoint missing from the inventory), build, Lighthouse CI against budgets, Playwright smoke tests with a mocked API.
- **snapshots (cron):** regenerate data, validate, publish. Open an issue after repeated failure.
- **patch-watch (cron):** detect a new `client_version`, open the diff PR.
- **contract-test (cron):** call the main endpoints and validate response shapes, so API drift is caught before users do.
- **Actions pitfalls:** scheduled workflows in public repos are disabled after 60 days without repository activity, and cron can run late or skip. Add a keepalive, and always show the real snapshot date in the UI.
- **Pages limits [validate]:** site size and bandwidth limits, cache headers not controllable (hence hashed filenames).
- **Runbook:** `docs/RUNBOOK.md` covers snapshot failure, upstream schema change, patch with missing assets, and API outage.

## 14. Testing

- Unit: normalizers, tier math, cache keys, patch-window logic.
- Contract: scheduled shape checks against the live API.
- Fixtures: record real responses once, reuse in tests and in `dev:mock`.
- E2E and visual: Playwright with a mocked API, including canvas regression for the map.

## 15. Design system

- Concept: a ledger or almanac fused with the game's look. Dark theme, condensed headings, tabular numerals, chamfered borders, restrained glow, minimal motion.
- All styling through CSS tokens (color, type, spacing, shadow) so a fork re-themes from one file. Hero accent colors and team/lane colors come from `heroes[].colors`, `/assets/colors` and `generic-data`.
- Adaptive density: tables on desktop, cards on mobile.
- Designed states: loading skeleton, empty ("not enough data for this filter"), error, stale.
- Accessibility: contrast, visible focus, `prefers-reduced-motion`, text alternatives for charts and the map, no color-only meaning.

## 16. Definition of done

**Global:** data through the inventory and service layer, typed from the spec; loading/empty/error/stale states; mobile and budgets pass; sample size, period, rank and patch visible wherever stats appear; strings through i18n; tests; inventory and methodology updated; unfinished modules behind a flag.

**Per module:** see [AGENTS.md](AGENTS.md#definition-of-done-per-module).

## 17. Milestones (draft)

- **M0 vertical prototype:** spikes, then one end-to-end slice (spec to types to service layer to snapshot to prerendered page to Lighthouse CI to Pages deploy).
- **M1 launch:** tier lists (heroes and items) by rank band, EN and PT-BR, methodology page, patch selector, `/status`.
- **M2:** hero pages, builds, leaderboard, player tracker basics.
- **M3:** Games tab, map, patch diff.
- **M4:** extras (crosshair, bestiary, economy reference, overlays, experimental demo queries).

## 18. Spikes to run first

Each is under an hour and can change the architecture.

1. **CORS** from a `github.io` origin: `curl -I -H "Origin: https://<user>.github.io" https://api.deadlock-api.com/v1/info` and look for `access-control-allow-origin`. If absent, snapshots become the only path.
2. CORS on the **image CDN** (affects Service Worker caching of images).
3. **Real response sizes** of `hero-stats`, `item-stats` and `/assets/items` (defines snapshot budget).
4. Rate-limit **headers** (`Retry-After`, etc.) readable by the client.
5. **Compression** served by Pages (gzip vs brotli).
6. **Timezone** of `version_datetime`, and time vs `min_match_id` for patch start.
7. **Map:** world to minimap transform, zipline interpolation.
8. Meaning of `matches` vs `players` in `item-stats`.
9. How long the API takes to publish assets for a new version.
10. Spec stability: how often fields change between patches.

## Decision log

Short ADR-style records. Move each into `docs/adr/` when the repo exists.

| # | Decision | Status | Why |
|---|---|---|---|
| 1 | TypeScript (strict) | Decided (delegated to maintainer's recommendation) | Spec has hundreds of schemas and changes per patch; generated types catch drift; one language for site and pipeline |
| 2 | Astro (static) with Preact islands and signals | Historical design decision | The initial design selected Astro/Preact, but the implemented application uses Next.js 16/React 19 static export. New work must follow the current implementation unless a migration is explicitly approved |
| 3 | `openapi-typescript` + `openapi-fetch`, not the official generated clients | Decided | Generated clients carry runtime weight and classes; we need types only |
| 4 | Hybrid data: build-time snapshots plus runtime API | Decided | Instant common views, resilience to API outage, respect for rate limits |
| 5 | Rank bands from `bucket=avg_badge` (heroes) and per-band requests (items) | Decided | `item-stats` has no rank bucket |
| 6 | Patch window = time/match-id window, not a build filter | Decided (constraint of the API) | Analytics cannot filter by build |
| 7 | Patch and season are separate selectors | Decided | Different axes |
| 8 | MIT license for code and docs; assets and marks are Valve's | Recommended, pending explicit confirmation | Simple, matches the API's license, no network-use clause needed for a static site |
| 9 | Project page URL `user.github.io/almanaque/` with configurable `site` and `base` | Decided | No custom domain for now; one-line switch later |
| 10 | English default, PT-BR at `/pt-br/` | Decided | Maintainer's choice |
| 11 | Launch feature: tier lists by rank (heroes and items) | Decided | Maintainer's choice |
| 12 | Snapshots not committed to `main` | Decided | Avoid git history bloat |
| 13 | Personal GitHub account first, no usage analytics, only the API sponsor link for donations | Default, pending confirmation | Reversible later |
| 14 | MMR and SQL endpoints not implemented | Decided | Deprecated upstream |
