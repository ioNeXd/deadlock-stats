# Deadlock API Capability Matrix

> Audit baseline generated from the current official OpenAPI document on 2026-10-01.
>
> Source of truth: https://api.deadlock-api.com/openapi.json
>
> This document classifies capabilities at the product level. Exact endpoint/parameter inventory must remain derived from the OpenAPI document rather than duplicated manually.

## Classification
- UI — dedicated product surface is justified by the current API.
- API-ONLY — useful capability without a dedicated surface yet; exposed through Data Explorer.
- ADVANCED — specialized protocol, binary format, long-running job, live stream, or technical workflow.
- DEPRECATED — documented by the API but explicitly deprecated.
- INTERNAL — ingestion/admin/internal capability; not a public product surface.
- UNAVAILABLE — required project capability not currently evidenced by the OpenAPI contract.

## Capability matrix

| Domain | Capability | Classification | Planned surface | Notes |
|---|---|---|---|---|
| Analytics | Ability order stats | UI | Analytics / Hero | Rich filters; hero-scoped |
| Analytics | Badge distribution | UI | Analytics | Player and match distribution |
| Analytics | Buff stats | UI | Analytics | Build 6712+ timing/stat caveats |
| Analytics | Build item stats | UI | Builds / Analytics | Cached by API |
| Analytics | Game stats | UI | Analytics | Bucketed temporal aggregation |
| Analytics | Hero ban stats | UI | Analytics | Depends on extracted demo ban data |
| Analytics | Hero build stats | UI | Hero / Builds | Hero build performance |
| Analytics | Hero combinations | UI | Analytics | Expensive combination queries |
| Analytics | Hero counters | UI | Hero / Analytics | Hero-vs-hero |
| Analytics | Hero stats | UI | Heroes / Analytics | Historical performance |
| Analytics | Hero synergy | UI | Heroes / Analytics | Same-team pair stats |
| Analytics | Item flow | UI | Builds / Items | Flow graph capability |
| Analytics | Item permutations | UI | Items / Analytics | Combination analysis |
| Analytics | Item stats | UI | Items / Analytics | Historical item performance |
| Analytics | Kill/death stats | UI | Analytics / Maps | Spatial and temporal filters |
| Analytics | Lane matchup stats | ADVANCED | Analytics | Explicitly marked subject to change |
| Analytics | Lane soul curve | ADVANCED | Analytics | Time-series lane data |
| Analytics | Player performance curve | UI | Players / Analytics | Time-series performance |
| Analytics | Player stats metrics | UI | Players / Analytics | Quantiles/DDSketch |
| Analytics | Hero scoreboard | UI | Leaderboard / Analytics | Large sort-field contract |
| Assets | Accolades | API-ONLY | Data / future catalog | Versioned + localized |
| Assets | Build tags | API-ONLY | Data Explorer | Versioned |
| Assets | Client versions | UI | API Status / Data | Version inventory |
| Assets | Colors | UI | Design system / Data | Versioned Panorama palette |
| Assets | Fonts index | API-ONLY | Data Explorer | CDN file tree |
| Assets | Generic data | API-ONLY | Data Explorer | Large game configuration |
| Assets | Heroes | UI | Heroes | Versioned/localized; active filter |
| Assets | Items | UI | Items | Versioned/localized |
| Assets | Loot tables | DEPRECATED | Data Explorer | Explicitly deprecated from build 6711 |
| Assets | Map | UI | Maps | Objectives, towers, splines, camps |
| Assets | Misc entities | API-ONLY | Data Explorer / Analytics | Buff metadata, units, colors |
| Assets | Modifiers | API-ONLY | Data Explorer | Published from build 6712+ |
| Assets | NPC units | API-ONLY | Data Explorer / Maps | Versioned/localized |
| Builds | Build search | UI | Builds | Game Coordinator-backed |
| Builds | Build by author | ADVANCED | Builds / Player | Live GC fetch; rate-limited |
| Builds | Build detail/live fetch | UI | Build detail | Can force refetch |
| Demo | Demo query | ADVANCED | Demo Explorer | Async SQL; result artifact |
| Demo | Demo query status | ADVANCED | Demo Explorer | Polling/job state |
| Demo | Demo schema | ADVANCED | Demo Explorer | Entity/event tables + Arrow types |
| GraphQL | GraphQL Playground | ADVANCED | GraphQL Explorer | Current OpenAPI exposes GraphQL route |
| Leaderboard | Leaderboard JSON | UI | Leaderboard | Region + leaderboard id |
| Leaderboard | Hero leaderboard JSON | UI | Leaderboard | Region + hero |
| Leaderboard | Leaderboard protobuf | ADVANCED | Data Explorer / Leaderboard | Binary protobuf |
| Leaderboard | Hero leaderboard protobuf | ADVANCED | Data Explorer / Leaderboard | Binary protobuf |
| Matches | Match metadata | UI | Match detail | Includes demo-derived hero build id when available |
| Matches | Recent matches/fetched | UI | Matches | Operational feed; recently fetched matches are shown on the Matches surface |
| Matches | Live broadcast URLs | ADVANCED | Live Query | Live ingestion/spectating |
| Matches | Match live URL | ADVANCED | Live Query / Demo | Very rate-limited |
| Matches | Match salts ingest | INTERNAL | — | Data ingestion capability |
| Players | Hero stats | UI | Player profile | Account-based |
| Players | Rank batch | UI | Players | Up to 1000 account IDs |
| Players | Rank distribution | UI | Leaderboard / Analytics | Ranked-match population |
| Players | Rank image | UI | Player profile | Binary PNG/WebP |
| Players | Rank prediction aliases | DEPRECATED | — | Explicit deprecated aliases |
| Players | Player rank | UI | Player profile | Account-wide rank |
| SQL | Direct SQL | DEPRECATED | — | API says to use public data lake / MCP instead |
| Patches | Unified patch feed | UI | Patches / History | /v2/patches; forum + Steam sources |
| Internal | Website feedback | INTERNAL | — | Not a public analytics surface |
| Patron | Steam account management | INTERNAL | — | Requires patron authentication |

## Cross-cutting contract findings

### Versioning
The public API is currently mixed-version: the OpenAPI contract contains both `/v1/...` and `/v2/...` resources. Version status is therefore determined **per resource path**, never by globally declaring an entire major version current or legacy.

Rules:
- A version is `CURRENT` when it is the highest documented version for that resource path.
- A version enters `LEGACY` only when a newer version of the same resource path appears.
- A newly discovered versioned path emits a `version_discovered` event.
- A resource transition from an older version to a newer version emits an `entered_legacy` event for the previous version.
- Removed resources emit a `resource_removed` event so consumers can react explicitly.
- The transition callbacks are implemented in `src/api/versioning.js` and consume OpenAPI snapshots rather than hardcoded version assumptions.

Example from the current contract:
- `/v1/assets/heroes` remains current because no `/v2/assets/heroes` replacement is documented.
- `/v2/patches` is current for the patch feed; `/v1/patches` is not treated as a current endpoint.

Many source-asset endpoints also accept `client_version` and default to the latest known version. Historical UI must preserve the relationship between data, patch/client version, and assets.

### Localization
Asset endpoints expose a documented language enum including Brazilian Portuguese, Portuguese, English, Japanese, Korean, Simplified/Traditional Chinese and other locales.

### Binary/content types
The contract includes non-JSON responses, including image/png, image/webp, application/octet-stream, text/plain and text/event-stream. The API client therefore cannot remain JSON-only.

### Rate limits
Rate limits are endpoint/domain specific. Analytics documents shared limits of 200 requests/minute per IP, 400/minute per key and 2000/minute globally. Other endpoints have substantially different limits, including very low limits for some player/rank and live/demo operations.

The request manager must therefore consume status codes and Retry-After rather than assuming a single global limit.

### Deprecated surface
The current contract explicitly marks direct SQL and several legacy MMR/rank-prediction routes as deprecated. These must not become first-class UI dependencies.

### Advanced capabilities
The current contract confirms capabilities relevant to the planned advanced tools:
- GraphQL playground
- demo SQL queries
- asynchronous demo jobs
- demo schema introspection
- live match broadcast URLs
- protobuf leaderboard responses
- raw/binary image endpoints

## Parameter classification policy
Parameters are to be classified from the OpenAPI contract using:
- SUPPORTED_UI
- SUPPORTED_API_ONLY
- DEPRECATED
- INTERNAL
- NOT_APPLICABLE

No parameter should be manually assumed to be supported. The Data Explorer should expose API-only parameters without forcing them into specialized pages.

## Audit status
The endpoint, parameter, schema, content-type and authentication inventories are now generated from the official OpenAPI contract and checked into the repository:

- `docs/api-openapi-inventory.json` contains 126 paths, 129 operations and 230 schemas.
- `docs/api-capability-matrix.json` contains classifications for all 129 operations and their 704 parameters.
- Deprecated parameters are classified as `DEPRECATED` rather than being exposed as supported UI inputs.
- The current contract contains one duplicate `operationId`: `feed` is used by both `GET /v1/patches` and `GET /v2/patches`. Operation identity in the Data Explorer therefore uses `METHOD + PATH` via `operationKey`; `operationId` remains display/search metadata.
- The current contract uses OpenAPI 3.1 composition (`oneOf`, `anyOf`, `allOf`), nullable union types, `const`, enums, numeric/string/array/object constraints and `propertyNames`. The latter is currently present in response/data schemas; the documented request-body schemas do not currently require `propertyNames` validation.
- A targeted audit found no current request-body usage of `patternProperties`, `prefixItems`, `contains`, `dependentRequired` or `not`. These are therefore not being implemented speculatively in the Data Explorer validator.
- Current request bodies are JSON in the public contract, including feedback, custom matches, demo queries, live URL ingestion, match-salt ingestion and patron Steam-account operations. No current `multipart/form-data` or `application/x-www-form-urlencoded` request body is documented.

The remaining work in this layer is regression testing and coverage of any newly introduced API schema constructs, not rebuilding the inventory manually.
