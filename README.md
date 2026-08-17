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
| `translations/` | JSON translation files (`en.json`, `pt-br.json`) |
| `scripts/validate-translations.js` | Checks translation keys stay in sync |
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

## License

Open source — feel free to fork, use, and contribute.
