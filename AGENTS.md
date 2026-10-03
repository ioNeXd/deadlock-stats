# AGENTS.md

## Project

**Deadlock Stats** is an API-first web application for exploring, analyzing, and visualizing Deadlock data.

Repository:

```
https://github.com/ioNeXd/deadlock-stats
```

Development branch:

```
new-site
```

### Critical rule

**Never modify `main`.**

All development work must be performed on `new-site`.

---

## Source of truth

The official Deadlock API is the source of truth.

- API: `https://api.deadlock-api.com`
- Docs: `https://api.deadlock-api.com/docs`
- OpenAPI: `https://api.deadlock-api.com/openapi.json`

Before implementing a significant API-related change, consult the current OpenAPI contract.

Priority:

1. Current OpenAPI
2. Current official API documentation
3. Existing project code
4. Project requirements
5. Assumptions only when unavoidable

Never invent an endpoint, parameter, response field, capability, metric, asset, or API behavior.

---

## Required workflow

For every significant implementation:

```text
verify branch
    ↓
read affected files
    ↓
consult current OpenAPI
    ↓
understand the existing architecture
    ↓
map the API contract
    ↓
plan the smallest coherent change
    ↓
implement
    ↓
add/update tests
    ↓
run tests
    ↓
review the implementation again
    ↓
review regressions
    ↓
commit
    ↓
report the result
```

Do not skip the OpenAPI step for API work.

If a requirement is unclear, investigate the contract before choosing an implementation.

---

## Architecture

Maintain this separation:

```text
OpenAPI
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

### API client

The API client is responsible for:

- HTTP requests;
- URL/query construction;
- cache keys;
- caching;
- deduplication;
- AbortController;
- timeouts;
- retries;
- `429`;
- `Retry-After`;
- HTTP errors;
- authentication headers;
- content negotiation;
- JSON;
- text;
- binary;
- image;
- stream responses.

Do not duplicate this logic in services or UI components.

### Services

Services expose semantic application operations.

Examples:

```text
src/services/assets.js
src/services/api-status.js
src/services/versioning.js
```

Services may compose client operations but should not contain presentation logic.

### Adapters

Adapters normalize API responses.

Normalizers must tolerate:

- optional fields;
- missing fields;
- unknown fields;
- new enum values;
- API shape changes that remain backward-compatible.

Preserve raw data when useful.

### UI

UI code is responsible for presentation and interaction.

Do not put complex API logic in:

- `src/app.js`;
- components;
- event handlers;
- templates.

---

## API versioning

Do not assume that API versions are globally current or deprecated.

The current API is mixed-version by resource.

For example, a current contract may contain:

```text
/v1/assets/heroes
/v2/patches
```

A version transition must be evaluated against the same resource path.

Use the existing versioning infrastructure rather than hardcoding version rules.

Relevant files:

```text
src/api/versioning.js
src/services/versioning.js
```

Respect OpenAPI `deprecated` metadata.

---

## API capabilities

The project maintains an API capability inventory in:

```text
docs/api-capability-matrix.md
docs/api-capability-matrix.json
docs/api-openapi-inventory.json
```

Capabilities are classified as:

- `UI`
- `API-ONLY`
- `ADVANCED`
- `DEPRECATED`
- `INTERNAL`
- `UNAVAILABLE`

Parameters are classified as:

- `SUPPORTED_UI`
- `SUPPORTED_API_ONLY`
- `DEPRECATED`
- `INTERNAL`
- `NOT_APPLICABLE`

If a capability has no dedicated page, it should remain accessible through Data Explorer when the API exposes it.

---

## Data Explorer

The Data Explorer is required for API capabilities without dedicated UI.

Do not hide API-only functionality simply because there is no specialized page.

When implementing the Data Explorer, prefer contract-driven generation for:

- operations;
- HTTP methods;
- parameters;
- request bodies;
- schemas;
- content types;
- response status codes;
- deprecated operations;
- authentication requirements.

---

## Assets

Prefer assets supplied by the official API.

Do not create fictional hero/item/rank/map artwork when an appropriate API asset exists.

For heroes, preserve and expose documented asset fields when useful, including:

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

---

## Data integrity

Never create fictitious:

- metrics;
- match counts;
- player counts;
- win rates;
- rankings;
- patch data;
- API health values;
- asset URLs;
- API responses.

If the API does not provide a requested value, state that limitation.

Do not silently substitute made-up defaults for missing data.

---

## API client rules

Cache keys must account for:

```text
method + path + normalized query + request body
```

Query parameter ordering must not create different cache identities for equivalent requests.

GET/HEAD/OPTIONS are the default retryable methods.

Do not automatically retry POST/PUT/PATCH/DELETE unless the caller explicitly opts into non-idempotent retries.

Honor `Retry-After` when present.

Do not assume every response is JSON.

The current API contract includes JSON, text, images, binary, and event-stream content.

---

## Normalization rules

Normalizers should be defensive.

Good:

```js
const name = entity?.name ?? entity?.display_name ?? null;
```

Avoid:

```js
const name = entity.name.toUpperCase();
```

unless the API contract guarantees the value and the operation is safe for missing data.

Unknown fields should not cause a normalization failure.

When practical:

```text
raw API payload
+
normalized application payload
```

should both remain available.

---

## API Status

Use the documented endpoints:

```text
GET /v1/info
GET /v1/info/health
```

Health information must distinguish:

- reachable;
- unavailable;
- healthy;
- unhealthy;
- unknown/incomplete.

An incomplete service map is not proof of health.

Preserve status, latency, URL, headers, content type, and error metadata when available.

---

## Testing

Tests use Node's built-in test runner.

Run:

```bash
npm test
```

Node.js 20+ is required.

Every meaningful feature should have tests for relevant:

- success paths;
- failure paths;
- optional fields;
- unknown fields;
- invalid parameters;
- HTTP status handling;
- rate limits;
- retries;
- cancellation;
- cache;
- deduplication;
- version transitions;
- deprecation.

Do not claim tests passed unless they were actually executed.

If the environment prevents test execution, report the limitation explicitly.

---

## Documentation

Documentation is part of the implementation.

When the API contract changes materially, update the appropriate inventory/documentation.

Keep:

```text
README.md
ARCHITECTURE.md
AGENTS.md
docs/api-capability-matrix.md
docs/api-capability-matrix.json
docs/api-openapi-inventory.json
```

consistent with the current project state.

Do not duplicate the full OpenAPI contract manually into documentation.

---

## Commits

Prefer small, descriptive commits.

Examples:

```text
docs: add project architecture guide
docs: add agent instructions
feat(api): add endpoint catalog
test(api): cover retry behavior
fix(api): preserve stream response handling
```

A commit should contain one coherent change.

Never commit unrelated cleanup with a feature unless required.

---

## Review requirements

After implementation:

1. inspect the changed files again;
2. compare behavior against the OpenAPI contract;
3. check error paths;
4. check empty/incomplete API responses;
5. check compatibility with unknown fields;
6. check caching/retry side effects;
7. run tests;
8. review the final diff;
9. verify `main` was not modified.

If a review finds an issue, fix it and perform the review again.

---

## UI principles

The visual direction is:

> **Deadlock in appearance. Modern product UI in experience.**

Use:

- Art Deco;
- noir;
- occult/mystical;
- industrial;
- old New York;
- "Cursed Apple".

But prioritize:

- readability;
- hierarchy;
- responsive layouts;
- accessibility;
- keyboard navigation;
- clear loading states;
- clear error states;
- clear empty states;
- consistent spacing;
- restrained microinteractions.

The application should feel like a modern data product, not a static themed website.

---

## Scope discipline

Avoid:

- restoring legacy code automatically;
- unnecessary dependencies;
- duplicated API logic;
- speculative endpoints;
- invented data;
- premature abstractions;
- broad refactors unrelated to the task;
- modifying `main`.

Prefer the smallest architecture-compatible change that solves the actual requirement.

---

## Completion report

At the end of each meaningful stage, report:

- what was done;
- files changed;
- API endpoints/contracts consulted;
- tests actually run;
- limitations;
- commit SHA;
- current project stage;
- approximate number of major steps remaining.

The status report must distinguish verified facts from assumptions and must never claim a test or implementation that was not actually performed.
