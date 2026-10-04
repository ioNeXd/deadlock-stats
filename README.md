# Almanaque

**Deadlock-Stats**: a fast, open-source stats almanac for [Deadlock](https://store.steampowered.com/app/1422450/), built on the community-run [Deadlock API](https://api.deadlock-api.com).

> **Disclaimer.** Almanaque is a fan project. It is not affiliated with or endorsed by Valve. *Deadlock* and all related names, images and assets are trademarks or property of Valve Corporation. Game assets are loaded at runtime from the Deadlock API CDN and are **not** part of this repository or its license.

> **Status: active implementation.** The repository currently contains a working Next.js/React implementation of the M1 tier-list slice. The production build exports a static site for GitHub Pages.

---

## What it is

A fully static website, hosted on GitHub Pages, that turns the Deadlock API into fast, readable pages. No backend, no accounts, no tracking.

### Launch feature (M1)

**Tier lists by rank**, with two tabs:

- **Heroes**: name, tier (S to F), win rate, pick rate, ban rate, matches, trend.
- **Items**: name, slot, item tier, tier (S to F), win rate, pick rate, matches, average buy time.

Every column is sortable, the table is searchable by name and filterable (slot, item tier, rank band, patch). All state lives in the URL, so every view is a shareable link.

### Planned modules

| Module | What it shows |
|---|---|
| Hero pages | Lore, abilities, popular builds, highest win-rate builds, matchups, synergies |
| Builds | Community builds and per-build win rates |
| Player tracker | Rank, match history, per-hero stats, percentiles vs. the population, mates and enemies |
| Games | Global stats: rank distribution, heroes, items, buffs, live matches, match explorer |
| Leaderboard | Valve leaderboards per region/hero/season, plus stat scoreboards |
| Map | Layered interactive map: objectives, ziplines, neutral camps, entities, kill/death heatmap, community routes |
| Reference | Economy and rules, bestiary, crosshair converter, ranks and seasons |

Everything the Deadlock API offers is tracked in [`docs/API_INVENTORY.md`](docs/API_INVENTORY.md) (to be generated), including what is deliberately **not** implemented and why (for example the deprecated MMR and SQL endpoints).

## Principles

1. **Fast by default.** Performance budgets are enforced in CI. A feature that breaks the budget goes behind a flag or does not ship.
2. **Honest numbers.** Every statistic shows its sample size, period, rank band and patch. Methodology is documented.
3. **Degrades gracefully.** API down, stale data, brand new hero: the page still works and says what is going on.
4. **Open.** Easy to run, easy to understand, easy to contribute to.
5. **Respectful of the API.** Caching, de-duplication and pre-built snapshots instead of hammering a volunteer-run service.

## Tech stack

- **TypeScript** (strict), one language for site and build pipeline
- **Next.js 16** with **React 19** and static export (`output: 'export'`)
- **openapi-typescript** for generated API types
- A small typed service layer in `lib/api`, with deterministic query serialization, in-flight de-duplication and transient-error retries
- **pnpm** and **GitHub Pages** as the package/deployment targets

The original architecture document describes the intended product architecture and remains the design reference; where it differs from the current implementation, the current implementation status is recorded there explicitly.

Why this stack and what was rejected: [ARCHITECTURE.md](ARCHITECTURE.md#decision-log).

## Quick start

```bash
pnpm install
pnpm gen:api        # regenerate API types from the OpenAPI spec
pnpm dev:mock       # develop against recorded fixtures, no network needed
pnpm dev            # develop against the live API
pnpm test           # unit and contract tests
pnpm build          # static build
pnpm lighthouse     # performance budget check
```

## Repository layout

```
app/                Next.js routes and static-export data routes
components/         Page and UI components
lib/api/            API client, services, generated OpenAPI types and snapshots
lib/i18n/           Locale dictionaries and routing helpers
scripts/            API inventory generation
docs/               API inventory, methodology and architecture notes
out/                Local/build artifact; never commit
```

## Languages

English is the default (`/`). Brazilian Portuguese is available at `/pt-br/`. UI strings live in per-locale JSON files; hero and item names come from the API already localized. Translations are very welcome.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) (to be written) and [AGENTS.md](AGENTS.md), which is the fastest way to learn the rules of this codebase whether you are a human or an AI agent. Good first contributions: translations, entity icons for the map, community routes, methodology review, accessibility fixes.

## License

Code and documentation: **MIT** (see `LICENSE`). Game assets, names and trademarks belong to Valve and are not covered by this license.

## Credits and support

- Data: the [Deadlock API](https://github.com/deadlock-api/deadlock-api) (MIT). Almanaque would not exist without it. Please consider sponsoring it on [Patreon](https://www.patreon.com/c/user?u=68961896) or [GitHub](https://github.com/sponsors/raimannma) and joining its [Discord](https://discord.gg/XMF9Xrgfqu).
- Generated API clients exist at [deadlock-api/openapi-clients](https://github.com/deadlock-api/openapi-clients). Almanaque deliberately does not use them (see the decision log) because they add runtime weight.
