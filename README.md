# Deadlock Stats

Deadlock Stats is an API-first web application for exploring, analyzing, and visualizing data from the Deadlock API.

The current development branch is **`new-site`**. The project is being rebuilt incrementally around the current API contract rather than around a fixed set of hardcoded endpoints.

> **Deadlock in appearance. Modern product UI in experience.**

The visual direction combines Deadlock-inspired Art Deco, noir, occult, industrial, old New York, and “Cursed Apple” elements with a modern, responsive and accessible product interface.

## Current status

The project is in active incremental development.

The current branch already contains:

- a contract-driven API client;
- domain API modules for assets, analytics, builds, GraphQL, leaderboard, matches, patches, players, and versioning;
- service layers for dashboard, analytics, API status, assets, builds, matches, players, versioning, and Data Explorer;
- defensive asset adapters and raw-payload preservation;
- API version/deprecation tracking derived from OpenAPI snapshots;
- a Data Explorer with OpenAPI operation discovery;
- schema inspection and a reusable schema viewer;
- schema-driven request body editing;
- request/response inspection;
- request validation against documented schemas and constraints;
- request-body media type handling;
- documented request examples/defaults with OpenAPI-aware precedence;
- validated best-effort generated request examples when documented examples are unavailable;
- API status and transport diagnostics;
- deterministic unit tests for the client, services, adapters, versioning, analytics, and Data Explorer.

The application shell currently exposes these routes:

| Area | Route | Current role |
| --- | --- | --- |
| Dashboard | `#/` | Command center |
| Matches | `#/matches` | Match exploration |
| Players | `#/players` | Player exploration |
| Heroes | `#/heroes` | Hero data and assets |
| Maps | `#/maps` | Map exploration |
| Items | `#/items` | Item catalog |
| Builds | `#/builds` | Build exploration |
| Leaderboard | `#/leaderboard` | Leaderboard data |
| Analytics | `#/analytics` | Analytics views |
| Item Intelligence | `#/item-analytics` | Item analytics |
| Data Explorer | `#/data` | Direct API/OpenAPI exploration |
| GraphQL | `#/graphql` | GraphQL endpoint playground |
| API Status | `#/api` | API health and transport status |

These routes should be understood as the **current application surface**, not a promise that every planned feature is complete or that every API capability has a dedicated UI.

## API source of truth

The official Deadlock API is the source of truth for endpoints, parameters, schemas, content types, examples, assets, and supported capabilities.

- API: https://api.deadlock-api.com
- Documentation: https://api.deadlock-api.com/docs
- OpenAPI: https://api.deadlock-api.com/openapi.json

The current audited contract is OpenAPI 3.1.0 with API version 0.1.0.

The API uses a mixed version lifecycle. Versioning is evaluated **per resource**, not globally. A `/v1` path is not automatically deprecated merely because another resource has a `/v2` path.

For example, the current contract contains both:

```text
/v1/assets/heroes
/v2/patches
```

while older resources may explicitly be deprecated. The application derives this state from the contract instead of hardcoding a global “v1 is deprecated” rule.

## API-first architecture

The project follows this dependency direction:

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

### API client

`src/api/client.js` is the transport boundary.

It currently handles:

- URL and query normalization;
- stable cache keys;
- GET caching;
- request deduplication;
- AbortController integration;
- timeouts;
- HTTP errors;
- retries and backoff;
- `429` and `Retry-After`;
- conservative retry rules for idempotent methods;
- optional retries for non-idempotent methods;
- authentication headers;
- content negotiation;
- JSON, text, binary, image, response, and stream handling.

Cache identity includes the HTTP method, normalized path/query, request body, response type, and relevant headers.

### Services

Services expose semantic operations to the application without making UI components responsible for transport details.

Current service modules include:

```text
src/services/
├── analytics.js
├── api-status.js
├── asset-version.js
├── assets.js
├── builds.js
├── dashboard.js
├── data-explorer.js
├── graphql.js
├── leaderboard.js
├── matches.js
├── players.js
└── versioning.js
```

### Adapters and raw data

Adapters normalize API-specific structures for the UI while remaining tolerant of:

- missing optional fields;
- unknown fields;
- new enum values;
- API shape changes.

Where normalization is used, the original API payload is preserved when useful for debugging, Data Explorer, and future compatibility.

## Data Explorer

The Data Explorer is the project's API escape hatch. It exists so an API capability does not need to be discarded merely because it does not have a dedicated product page.

The current implementation is contract-driven and includes:

- OpenAPI operation discovery;
- operation and parameter inspection;
- request path/query/path-parameter handling;
- request body content types;
- schema-driven request forms;
- nested object and array fields;
- enum and constraint metadata;
- nullable/default/example metadata;
- schema composition such as `oneOf`, `anyOf`, and `allOf`;
- reusable Schema Viewer rendering;
- request previews;
- request validation;
- response inspection;
- response examples;
- HTTP status and latency information;
- response headers/content type;
- raw response/data inspection.

### Request examples

Request examples start with documented OpenAPI metadata and may fall back to a validated generated example when no documented value is available.

The documented-value precedence is:

1. Media Type `example`;
2. Media Type `examples`;
3. Schema `example`;
4. Schema `examples`;
5. Schema `default`;
6. generated schema example, only when the generator can build a payload that passes the existing request-body validator.

Generated values are intentionally conservative. The generator currently uses supported schema constraints such as required properties, defaults, enums, consts, primitive formats, array minimums, and simple compositions. If it cannot produce a validated value, no generated preset is exposed.

The current implementation does **not** provide persistent user-created preset storage. Generated values and user presets should remain distinguishable from values explicitly documented by the API.

## Schema support

The Data Explorer preserves schema metadata needed by both inspection and request editing, including:

- type;
- format;
- title;
- description;
- required;
- nullable;
- `$ref`;
- `const`;
- `default`;
- `example`;
- `examples`;
- `enum`;
- object properties;
- additional properties;
- array items;
- `oneOf`;
- `anyOf`;
- `allOf`;
- numeric, string, array, and object constraints.

Schema rendering is isolated in:

```text
src/ui/schema-viewer.js
```

This keeps presentation concerns out of the Data Explorer service.

## API status and versioning

API status uses documented health resources and preserves transport diagnostics such as:

- HTTP status;
- latency;
- URL;
- response headers;
- content type;
- API errors.

Version/deprecation behavior is derived from OpenAPI snapshots. The versioning layer can identify newer versions of the same resource, legacy versions, explicit OpenAPI deprecation, and removed resources.

Relevant modules:

```text
src/api/versioning.js
src/services/versioning.js
src/services/api-status.js
```

## Assets

Real assets from the official API are preferred whenever available.

The asset layer supports documented hero and other game assets rather than creating replacement artwork when the API already provides the corresponding resource.

Relevant modules:

```text
src/api/assets.js
src/services/assets.js
src/adapters/assets.js
src/services/asset-version.js
```

## API capability inventory

The API audit is maintained under `docs/`:

```text
docs/
├── api-capability-matrix.md
├── api-capability-matrix.json
├── api-classification-audit.md
├── api-openapi-inventory.md
└── api-openapi-inventory.json
```

The capability matrix uses:

- `UI`
- `API-ONLY`
- `ADVANCED`
- `DEPRECATED`
- `INTERNAL`
- `UNAVAILABLE`

Parameter classifications use:

- `SUPPORTED_UI`
- `SUPPORTED_API_ONLY`
- `DEPRECATED`
- `INTERNAL`
- `NOT_APPLICABLE`

The inventory is intended to make unclassified operations, parameters, schemas, content types, and other contract changes visible instead of silently ignoring them.

## Repository layout

The current source tree is intentionally small and modular:

```text
.
├── index.html
├── src/
│   ├── app.js
│   ├── styles.css
│   ├── adapters/
│   │   └── assets.js
│   ├── api/
│   │   ├── analytics.js
│   │   ├── assets.js
│   │   ├── builds.js
│   │   ├── client.js
│   │   ├── graphql.js
│   │   ├── leaderboard.js
│   │   ├── matches.js
│   │   ├── patches.js
│   │   ├── players.js
│   │   ├── query.js
│   │   └── versioning.js
│   ├── services/
│   │   ├── analytics.js
│   │   ├── api-status.js
│   │   ├── asset-version.js
│   │   ├── assets.js
│   │   ├── builds.js
│   │   ├── dashboard.js
│   │   ├── data-explorer.js
│   │   ├── graphql.js
│   │   ├── leaderboard.js
│   │   ├── matches.js
│   │   ├── players.js
│   │   └── versioning.js
│   └── ui/
│       ├── schema-viewer.js
│       └── security.js
├── test/
├── docs/
├── AGENTS.md
├── ARCHITECTURE.md
├── package.json
└── sw.js
```

The exact implementation surface is expected to evolve as the API and product mature. Documentation should describe committed behavior rather than future architecture.

## Testing

The project uses Node's built-in test runner.

```bash
npm test
```

Requirements:

- Node.js 20 or newer;
- no live API access is required for the deterministic unit suite.

The test suite currently covers API client behavior, API status, versioning, assets, analytics, builds, dashboard behavior, matches, players, GraphQL, query handling, security, and Data Explorer behavior.

For Data Explorer specifically, tests cover schema/form models, request construction, media types, validation, examples, constraints, composition, and response metadata.

When adding behavior, tests should include normal responses as well as incomplete, unexpected, invalid, or error cases relevant to the feature.

## Development workflow

All development must happen on `new-site`.

Never modify `main`.

For meaningful API or product changes:

```text
Verify branch
    ↓
Read affected files
    ↓
Consult current OpenAPI
    ↓
Map the contract
    ↓
Plan the smallest coherent change
    ↓
Implement
    ↓
Test
    ↓
Review regressions
    ↓
Commit
```

Small, focused commits are preferred.

If the official API does not provide a requested capability, document the limitation rather than inventing data or endpoints.

## Engineering rules

1. The official OpenAPI is the API source of truth.
2. Never invent endpoints, fields, assets, metrics, or capabilities.
3. Do not treat all `/v1` resources as deprecated by default.
4. Keep HTTP and transport logic inside the API client.
5. Keep semantic API behavior inside services.
6. Keep normalization out of UI components.
7. Preserve raw API data when useful.
8. Make adapters tolerant of API evolution.
9. Keep API-only capabilities accessible through Data Explorer.
10. Prefer real API assets over fabricated replacements.
11. Add deterministic tests for meaningful behavior and failure modes.
12. Review the final diff before committing.
13. Keep changes focused and avoid unnecessary dependencies.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [AGENTS.md](AGENTS.md) for the detailed engineering contract.

## Known scope boundaries

The project intentionally does not claim that every planned capability is finished.

In particular:

- the Data Explorer is the primary generic surface for API capabilities that do not yet have dedicated product UI;
- generated request examples are best-effort and intentionally conservative rather than a complete JSON Schema example generator;
- persistent user-created request presets are not yet implemented;
- advanced API capabilities are exposed only where the current contract and implementation support them;
- the API inventory must be refreshed when the official OpenAPI changes materially.

These boundaries prevent the README from presenting planned behavior as completed behavior.

## Contributing

Changes should target `new-site` and preserve the API-first architecture.

For API-related work:

1. verify the current OpenAPI contract;
2. identify the exact operation, parameters, schemas, content types, and response behavior;
3. update the appropriate client/service/adapter layer;
4. add or update tests;
5. update API inventory documentation when the contract changes;
6. review UI behavior and regressions;
7. make a small, descriptive commit.

## Disclaimer

Deadlock Stats is an independent project. The Deadlock API states that `deadlock-api.com` is not endorsed by Valve and does not reflect the views or opinions of Valve or anyone officially involved in producing or managing Valve properties.

Deadlock and associated properties are trademarks or registered trademarks of Valve Corporation.
