# Deadlock Stats

Deadlock Stats is an API-first web application for exploring, analyzing, and visualizing data from the Deadlock API.

The project is designed around a simple principle:

> **Deadlock in appearance. Modern product UI in experience.**

It combines a Deadlock-inspired visual language—Art Deco, noir, occult, industrial, old New York, and the "Cursed Apple" aesthetic—with a modern, responsive, accessible data product.

## Project goals

- Make the current Deadlock API easy to explore.
- Turn API capabilities into focused product experiences without hiding the underlying data.
- Preserve access to API-only capabilities through the Data Explorer.
- Build a resilient API client that understands caching, deduplication, retries, rate limits, binary responses, streams, and API evolution.
- Keep the application extensible as the official API changes.
- Prefer real API data and assets over invented or duplicated product data.

The **official Deadlock API is the source of truth** for API capabilities.

- API: https://api.deadlock-api.com
- Documentation: https://api.deadlock-api.com/docs
- OpenAPI: https://api.deadlock-api.com/openapi.json

The current OpenAPI contract is OpenAPI 3.1.0 with API version 0.1.0. The API is mixed-version by resource: current public resources can use different version prefixes, so version lifecycle is evaluated per resource path rather than globally. For example, the current contract exposes `/v2/patches` while `/v1/assets/heroes` remains a documented current resource. 

## Current project status

The repository is being developed incrementally on the `new-site` branch.

Current infrastructure includes:

- API transport client
- normalized query/cache keys
- GET caching and request deduplication
- timeout and abort handling
- `429` / `Retry-After` support
- safe retry defaults for idempotent methods
- optional retries for non-idempotent methods
- JSON, text, binary, image, and stream response handling
- API version/deprecation detection from OpenAPI snapshots
- API health/status service
- tolerant asset normalizers
- raw + normalized service results
- automated unit tests for the core infrastructure
- API capability and parameter inventories under `docs/`

The current API audit records 126 paths, 129 operations, 230 schemas, two security schemes, and seven documented response content types. See `docs/api-capability-matrix.md` and `docs/api-openapi-inventory.json` for the audited contract inventory.

## Product areas

The planned application surface is:

- **Dashboard** — command center for real API activity and health.
- **Matches** — match discovery and match details.
- **Players** — player profiles and player analytics.
- **Heroes** — hero data, assets, builds, and statistics.
- **Items** — item catalog and item analytics.
- **Builds** — build search, details, and performance.
- **Analytics** — historical and aggregated statistics.
- **Leaderboard** — regional and hero leaderboards.
- **Data Explorer** — direct exploration of API resources, parameters, schemas, requests, responses, and errors.
- **API Status** — health, latency, HTTP status, rate-limit information, and API metadata.

Advanced capabilities are added only when supported by the current API contract:

- Demo Explorer
- GraphQL Explorer
- Live Query
- Custom Match Tools

## Architecture

The project follows a strict layered architecture:

```text
Official OpenAPI
      ↓
API Contract / Inventory
      ↓
API Client
      ↓
Services
      ↓
Adapters / Normalizers
      ↓
View Models
      ↓
UI
```

The UI should not contain complex HTTP, API-version, normalization, or transport logic.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture and engineering rules.

## Repository layout

```text
.
├── index.html
├── src/
│   ├── app.js
│   ├── styles.css
│   ├── api/
│   │   ├── client.js
│   │   ├── assets.js
│   │   └── versioning.js
│   ├── adapters/
│   │   └── assets.js
│   └── services/
│       ├── api-status.js
│       ├── assets.js
│       └── versioning.js
├── test/
│   ├── api-client.test.js
│   ├── api-status.test.js
│   ├── api-versioning.test.js
│   ├── assets-services.test.js
│   └── versioning-service.test.js
├── docs/
│   ├── api-capability-matrix.md
│   ├── api-capability-matrix.json
│   └── api-openapi-inventory.json
├── AGENTS.md
├── ARCHITECTURE.md
└── package.json
```

## Development rules

1. Work on `new-site`. Never modify `main`.
2. Consult the current official OpenAPI before significant API implementation.
3. Do not invent endpoints, fields, capabilities, assets, or metrics.
4. Keep API logic outside UI components.
5. Preserve raw API payloads when normalization is useful.
6. Make normalizers tolerant of unknown fields, new enum values, and optional fields.
7. Treat API versioning and deprecation as dynamic contract information.
8. Keep API-only capabilities available through the Data Explorer.
9. Add tests for meaningful behavior and failure modes.
10. Prefer small, focused commits.

## API-first policy

When a requirement conflicts with the current API contract, the API contract wins.

Before implementing a feature:

```text
Consult OpenAPI
    ↓
Inspect current code
    ↓
Map the contract
    ↓
Design the service/adapter/view model
    ↓
Implement
    ↓
Test
    ↓
Review regressions
    ↓
Commit
```

If the API does not provide a requested capability, document the limitation instead of fabricating data.

## Running tests

The project uses Node's built-in test runner:

```bash
npm test
```

Node.js 20 or newer is required.

The test suite is intended to run without requiring live API access by mocking HTTP responses where appropriate. Integration/live API checks should be treated separately from deterministic unit tests.

## API capability inventory

The API audit is maintained from the official OpenAPI contract.

Capability classifications:

- `UI`
- `API-ONLY`
- `ADVANCED`
- `DEPRECATED`
- `INTERNAL`
- `UNAVAILABLE`

Parameter classifications:

- `SUPPORTED_UI`
- `SUPPORTED_API_ONLY`
- `DEPRECATED`
- `INTERNAL`
- `NOT_APPLICABLE`

The machine-readable inventory exists so future tooling can detect unclassified operations, parameters, schemas, content types, and other contract changes.

## Contributing

Contributions should preserve the API-first architecture and should be made against `new-site`.

For any API-related change:

1. verify the current OpenAPI contract;
2. identify the exact endpoint, parameters, response schemas, and content types;
3. update the appropriate client/service/adapter layer;
4. add or update tests;
5. update API inventory documentation when the contract changes;
6. review the UI for regressions;
7. commit the smallest coherent change.

## Disclaimer

Deadlock Stats is an independent project. The Deadlock API states that `deadlock-api.com` is not endorsed by Valve and does not reflect the views or opinions of Valve or anyone officially involved in producing or managing Valve properties.

Deadlock and associated properties are trademarks or registered trademarks of Valve Corporation.
