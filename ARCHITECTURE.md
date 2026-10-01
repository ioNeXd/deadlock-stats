# Architecture

## Overview

Deadlock Stats is deliberately structured as an API-first application.

The architecture is:

```text
Official OpenAPI
      ↓
API Contract
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

Each layer has a specific responsibility. The goal is to prevent transport concerns, API contract details, normalization rules, and presentation logic from becoming coupled.

## 1. Official API / OpenAPI

The Deadlock API is the source of truth.

- Base API: `https://api.deadlock-api.com`
- Documentation: `https://api.deadlock-api.com/docs`
- OpenAPI: `https://api.deadlock-api.com/openapi.json`

The current contract is OpenAPI 3.1.0 with API version 0.1.0.

The application must derive API behavior from the current contract instead of assuming that all endpoints share the same version lifecycle.

### Contract rules

The OpenAPI contract defines:

- paths and HTTP methods;
- operation IDs;
- tags;
- parameters;
- request bodies;
- response schemas;
- status codes;
- content types;
- authentication/security schemes;
- deprecated operations;
- enums and constraints.

The API currently contains both `/v1` and `/v2` public resources. Versioning is therefore evaluated per resource path.

Example:

```text
/v1/assets/heroes   → current documented hero asset resource
/v2/patches         → current documented patch feed
/v1/patches         → deprecated legacy resource
```

Do not replace every `/v1` endpoint simply because `/v2` exists elsewhere.

## 2. API Contract / Inventory

The repository maintains a machine-readable representation of the audited API contract.

Relevant files:

```text
docs/
├── api-capability-matrix.md
├── api-capability-matrix.json
└── api-openapi-inventory.json
```

The inventory exists to answer:

- What operations exist?
- Which operations are UI-facing?
- Which are API-only?
- Which are advanced?
- Which are deprecated?
- Which are internal?
- Which parameters are intended for UI?
- Which parameters remain API-only?
- Which schemas and content types exist?

The inventory must be refreshed when the official OpenAPI changes materially.

## 3. API Client

Location:

```text
src/api/client.js
```

The API client is the single transport boundary for HTTP communication.

It is responsible for:

- constructing API URLs;
- normalizing query parameters;
- generating stable cache keys;
- request deduplication;
- GET caching;
- cache invalidation;
- timeouts;
- AbortController integration;
- HTTP error handling;
- response metadata;
- retry policy;
- `429` handling;
- `Retry-After`;
- authentication headers;
- content negotiation;
- JSON parsing;
- text responses;
- binary responses;
- image responses;
- streaming responses.

### Cache key

Cache identity must include:

```text
HTTP method
+ path
+ normalized/sorted query
+ request body
```

Two requests that differ in meaningful query or body data must not collide.

### Retry policy

Retries are conservative by default.

Automatically retryable methods:

- GET
- HEAD
- OPTIONS

Retryable statuses include:

- 429
- 502
- 503
- 504

Non-idempotent methods are not retried unless explicitly requested with the client option for non-idempotent retries.

This prevents an infrastructure retry from unintentionally repeating a state-changing request.

### Response handling

The client must not assume JSON.

The current API contract includes:

- `application/json`
- `application/octet-stream`
- `image/png`
- `image/webp`
- `text/event-stream`
- `text/html`
- `text/plain`

Explicit `responseType` requests take precedence over automatic content-type detection.

## 4. Services

Services provide semantic API operations to the application.

Examples:

```text
src/services/assets.js
src/services/api-status.js
src/services/versioning.js
```

A service should answer a product-level question without exposing transport implementation details to the UI.

For example:

```js
listHeroes(options)
fetchHero(heroId, options)
probeApiStatus(options)
createVersionMonitor(callbacks)
```

Services may compose multiple client calls when necessary, but they should not become presentation components.

## 5. Adapters / Normalizers

Location:

```text
src/adapters/
```

Adapters transform raw API responses into stable application-facing structures.

They must be defensive because the API can evolve.

Normalizers should:

- tolerate missing optional fields;
- tolerate unknown fields;
- tolerate new enum values;
- preserve useful raw data;
- avoid throwing because an optional field is absent;
- keep API-specific shape differences away from UI code.

Current asset normalization is implemented in:

```text
src/adapters/assets.js
```

The normalized representation can expose common fields such as `id`, `name`, and `images`, while retaining the original response as `raw`.

## 6. Raw + normalized data

When normalization is used, services should preserve both representations where practical:

```text
{
  raw: <original API payload>,
  data: <normalized representation>,
  ...transport metadata
}
```

This provides two benefits:

1. the UI gets a stable structure;
2. newly introduced API fields are not silently destroyed.

Raw data is especially valuable for Data Explorer, debugging, schema inspection, and future adapters.

## 7. Versioning and deprecation

Location:

```text
src/api/versioning.js
src/services/versioning.js
```

Version state is derived from OpenAPI snapshots.

The system recognizes versioned paths using a leading version segment:

```text
/v1/...
/v2/...
```

A resource is compared using its version-independent path.

For example:

```text
/v1/patches  → /patches
/v2/patches  → /patches
```

When a newer version of the same resource appears:

- the previous version enters legacy state;
- a `version_discovered` event is emitted for the new path;
- an `entered_legacy` event is emitted for the previous resource version.

When a resource disappears from the contract:

- a `resource_removed` event is emitted.

Explicit OpenAPI deprecation is also tracked.

The implementation must never hardcode a global rule such as "v1 is deprecated".

## 8. API Status

Location:

```text
src/services/api-status.js
```

The API Status layer uses the documented health endpoints:

```text
GET /v1/info
GET /v1/info/health
```

Health status distinguishes:

- API reachable;
- API unavailable;
- service health known;
- service health incomplete/unknown;
- individual dependency health.

The current documented health services include:

- clickhouse
- postgres
- redis

An incomplete health payload must not be interpreted as healthy.

The status result also preserves transport information such as:

- HTTP status;
- latency;
- URL;
- headers;
- content type;
- API error.

## 9. Assets

Assets should come from the official API whenever the API exposes the required asset.

For hero data, the application can consume documented fields such as:

- `background_image`
- `background_image_webp`
- `hero_card_critical`
- `hero_card_critical_webp`
- `hero_card_gloat`
- `hero_card_gloat_webp`
- `icon_hero_card`
- `icon_hero_card_webp`
- `icon_image_small`
- `icon_image_small_webp`
- `minimap_image`
- `minimap_image_webp`
- `name_image`
- `top_bar_vertical_image`
- `top_bar_vertical_image_webp`
- `vote_sticker`
- `vote_sticker_webp`
- `weapon_image`
- `weapon_image_webp`

The asset layer should not invent replacement artwork when the API provides the corresponding asset.

## 10. Map Explorer / Coordinate Transformation Debt

The Map Explorer consumes the documented `/v1/assets/map` contract and currently renders the official map image, objective positions, neutral camps, entities, and zipline data.

The API contract distinguishes two coordinate representations:

- objective positions are already expressed as relative percentages suitable for CSS placement;
- neutral camps/entities expose world `[x,y,z]` positions and, where applicable, relative `left`/`top` coordinates;
- zipline paths expose cubic-spline control-point arrays (`P0_points`, `P1_points`, `P2_points`) in world coordinates.

### Explicit pending item

**Map world-coordinate → minimap-coordinate transformation remains unresolved.**

The current UI must not invent a mathematically incorrect projection. In particular:

- do not treat cubic-spline control points as a simple polyline unless the rendering is explicitly documented as an approximation;
- do not infer an arbitrary world-to-image transform from `radius` alone;
- do not silently assume axis orientation, origin, scale, or image bounds.

The next implementation step for the Map Explorer is therefore to determine and verify the coordinate transform from the official API contract/data before making zipline geometry visually authoritative.

If the official contract does not expose enough information for a deterministic transform, keep the raw zipline geometry available and document the limitation instead of fabricating a projection.

## 11. UI / View Models

The UI consumes view-oriented data rather than raw transport responses.

UI responsibilities include:

- layout;
- navigation;
- interaction;
- accessibility;
- loading states;
- error states;
- empty states;
- responsive behavior;
- keyboard navigation;
- visual presentation.

The UI should not:

- construct arbitrary fetch requests;
- implement retry algorithms;
- parse HTTP responses;
- determine API version policy;
- duplicate normalization logic;
- hardcode API capabilities that belong in the contract/inventory.

## 12. Data Explorer

The Data Explorer is the escape hatch for capabilities without a dedicated page.

It should be driven from the API inventory rather than a manually duplicated endpoint list.

A mature Data Explorer should expose, where applicable:

- resource selection;
- operation selection;
- HTTP method;
- path parameters;
- query parameters;
- request body;
- authentication requirements;
- request preview;
- response;
- schema;
- raw JSON;
- status code;
- latency;
- response headers;
- content type;
- errors;
- pagination;
- binary/raw response handling.

API-only capabilities should remain discoverable here even when they do not justify a dedicated UI.

## 13. Error handling

Errors should retain enough context for debugging and product feedback.

Where available, preserve:

- HTTP status;
- status text;
- request URL;
- method;
- latency;
- Retry-After;
- response headers;
- response text;
- original error/cause.

UI code should convert these into user-facing states without destroying the underlying diagnostic information.

## 14. Testing architecture

Tests live under:

```text
test/
```

The current suite covers:

- API client behavior;
- cache and deduplication;
- retry behavior;
- `Retry-After`;
- binary and stream handling;
- version detection;
- deprecation;
- version transitions;
- resource removal;
- asset normalization;
- raw payload preservation;
- API health/status.

Tests should prioritize deterministic mocks for unit behavior.

When adding a feature, test:

1. normal response;
2. missing/optional data;
3. unexpected data;
4. HTTP errors;
5. relevant rate-limit behavior;
6. cancellation/timeout where applicable;
7. cache/dedupe behavior where applicable;
8. version/deprecation behavior where applicable.

## 15. Dependency policy

Prefer platform APIs and the existing project structure.

Add a dependency only when it provides clear value that cannot be achieved cleanly with the current stack.

Avoid dependencies that duplicate:

- HTTP transport;
- state handling;
- API normalization;
- simple UI primitives.

## 16. Change workflow

Every significant change should follow:

```text
1. Verify branch
2. Read affected files
3. Consult current OpenAPI
4. Understand the existing contract
5. Plan the smallest change
6. Implement
7. Add/update tests
8. Run tests
9. Review the diff
10. Check for regressions
11. Commit
12. Document limitations
```

Never modify `main`.

## 17. Architectural invariants

The following are project invariants:

- The official API is the source of truth.
- UI does not own API transport logic.
- Services own semantic API operations.
- Adapters own normalization.
- Raw data is preserved where useful.
- Unknown API fields must not break normalization.
- Version policy is contract-driven.
- Deprecated endpoints must not become accidental first-class dependencies.
- API-only capabilities remain accessible through Data Explorer.
- Real API assets are preferred over invented assets.
- No fictitious metrics are displayed.
- Significant API changes require OpenAPI review.
