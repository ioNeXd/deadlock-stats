# Deadlock Stats

A lightweight, static website that displays live statistics for [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/) by Valve — hero and item win rates, pick rates, and more — powered by the community-run [Deadlock API](https://api.deadlock-api.com).

Built with plain **HTML, CSS, and JavaScript** — no frameworks, no build step. Just clone and serve.

🔗 **Live data source:** [api.deadlock-api.com](https://api.deadlock-api.com/docs)

---

## Features

- **Hero stats table** — win rate and pick rate for every hero, with icons, pulled live from the API.
- **Item stats table** — the same stats for in-game items, with pick rate correctly normalized for the fact that up to 12 items are bought per match.
- **Search, sorting & pagination** — filter by name, sort by win rate / pick rate / alphabetically, and page through the results without reloading.
- **Tab navigation** — switch between Heroes and Items without reloading the page.
- **Hero detail page** — opens at `#hero=<id>` and shows:
  - **Most popular and highest win rate builds**, falling back to all-time favorite builds (clearly badged) when analytics are unavailable;
  - **Build cards** — author name, build ID (with a one-click copy button and toast feedback), win rate, and total matches, with a tooltip when the name is truncated;
  - **Build breakdown** — items grouped by category (weapon / vitality / spirit / utility) with tier-colored cards and optional/active badges;
  - **Skill path** — a 16-column timeline showing when each ability was unlocked (1–4) and leveled up, with per-level markers;
  - **Ability tooltips** — hover any skill to see its icon, name, key cooldowns, description, and stats organized into property sections (range, casting, damage, duration, weapon, movement, health & healing, resistances).
- **"Last updated" indicator** — shows the timestamp of the most recently processed match, so you know how fresh the data is.
- **Built-in translation system (i18n)** — all interface text is decoupled from the HTML via `data-i18n` attributes and JSON translation files. Adding a language means creating a single file, no HTML/JS changes required.
- **No backend required** — 100% static, deployable for free on GitHub Pages.

## Getting started

1. Clone this repository.
2. Open the project folder in a code editor (e.g. VS Code).
3. Serve it locally with any static server — e.g. the VS Code **Live Server** extension.

> Opening `index.html` directly via `file://` will **not** work: browsers block local `fetch` requests in that mode.

## Setting up the development environment

The website itself is plain static HTML/CSS/JS — it only needs a static server and **does not require Node.js**. The Node toolchain is an optional safety net that powers the automated checks (syntax, translations, unit tests).

1. **Install Node.js** (v20 or newer — LTS recommended) from [nodejs.org](https://nodejs.org). `npm` is bundled with it.
2. **Verify the install**:
   ```bash
   node --version
   npm --version
   ```
3. **Clone the repository**:
   ```bash
   git clone https://github.com/ionexd/deadlock-stats.git
   cd deadlock-stats
   ```
4. **Skip `npm install`** — the project has zero dependencies; every check uses Node's built-in tooling (`node:test`, `node --check`).
5. **Run the full check suite** to confirm the codebase is healthy:
   ```bash
   npm run check
   ```
   This validates the syntax of every JS module, keeps translation files in sync with `en.json`, and runs the unit tests. Use `npm test` to run only the tests.
6. **Serve the site** with any static server (e.g. the VS Code Live Server extension) and open it in your browser.

## Development & checks

The project ships a small Node-based toolchain (no dependencies, built-in `node:test`) to keep the codebase healthy:

- `npm run check` — runs everything below in one pass.
- `npm run check:syntax` — `node --check` on every module in `js/`.
- `npm run validate:translations` — ensures all translation files stay in sync with `en.json`.
- `npm test` — unit tests for the pure logic (utils, API normalization, i18n, skill-section data).

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs these three checks automatically on every push and pull request, so translation drift or a broken test never reaches `main` unnoticed.


## Project structure

| Path | Purpose |
|---|---|
| `index.html` | Single-page shell (hash routing) |
| `js/api.js` | API client — caching, retries, normalization, asset URL mapping |
| `js/table.js` | Main table: heroes/items, search, sort, pagination, tabs |
| `js/hero-detail.js` | Hero detail: builds, item categories, skill path, ability tooltips |
| `js/router.js` | Hash routing (`#hero=<id>` / `#table`) |
| `js/i18n.js` | Translation loader and `data-i18n` binding |
| `js/utils.js` | Shared helpers (formatting, safe access, caching) |
| `js/constants.js` | Shared constants |
| `js/skill-sections-data.js` | Skill tooltip data: property sections and manual key overrides |
| `translations/` | JSON translation files (`en.json`, `pt-br.json`) |
| `scripts/validate-translations.js` | Checks translation keys stay in sync |
| `scripts/check-syntax.js` | Runs `node --check` on every module in `js/` |
| `tests/` | Unit tests (`node:test`, no dependencies) |
| `package.json` | npm scripts for checks and tests (`npm run check`) |
| `.github/workflows/ci.yml` | CI: syntax + translations + tests on every push/PR |
| `assets/` | Local SVGs and fonts (rest is served by the API CDN) |
| `css/style.css` | Dark theme, responsive layout, shop/build styling |

## Contributing a translation

1. Copy `translations/en.json`.
2. Rename it to your language code (e.g. `es.json`, `fr.json`).
3. Translate the values — keep the keys exactly as they are.
4. Run `node scripts/validate-translations.js` to confirm the new file is in sync.
5. Open a pull request.

## Tech stack

- Vanilla HTML / CSS / JavaScript (no frameworks, no build tools)
- [Deadlock API](https://api.deadlock-api.com) (community-run, open source) — see its [docs](https://api.deadlock-api.com/docs)
- Hosted on GitHub Pages
- Zero-dependency Node toolchain (`node:test`) for syntax checks, translation validation, and unit tests — CI runs it automatically

## License

Open source — feel free to fork, use, and contribute.
