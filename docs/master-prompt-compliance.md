# Master Prompt Compliance Audit

Audited: 2026-10-03
Branch: `new-site`
Repository: `ioNeXd/deadlock-stats`

## Source of truth

The current Deadlock API OpenAPI specification is the contract source. The application inventory is maintained from that contract and currently records:

- 129 operations
- 704 parameters
- 232 schemas
- 2 security schemes
- 7 documented content types
- 14 deprecated operations
- 7 internal operations

## Compliance checklist

| Area | Status | Evidence |
| --- | --- | --- |
| API-first architecture | PASS | API client → services → adapters/view models → UI |
| API client | PASS | cache, dedupe, AbortController, timeout, retries, 429/Retry-After, content negotiation, binary and stream handling |
| API Status | PASS | health, HTTP status, latency, endpoint, Retry-After, error, client version, latest patch |
| Data Explorer | PASS | operations, parameters, request bodies, responses, schemas, security, content types, validation and pagination-capable request controls |
| Assets | PASS | official API image fields, WebP preference support, raw preservation |
| Unknown/optional API data | PASS | normalizers preserve raw data and tolerate optional/unknown fields |
| Player Detail | PASS | current rank, derived rank history, forecast, optional data with degraded states |
| Match Detail | PASS | current metadata endpoint, roster/assets/raw API data |
| Hero Detail | PASS | analytics, matchups, builds, ability orders |
| Build Detail | PASS | critical build data survives optional analytics/catalog failures |
| Advanced tools | PASS | Demo, Live Query/SSE, Custom Match, Live URLs, async job polling |
| Accessibility | IMPLEMENTED | skip link, labelled navigation, aria-current, visible focus and browser checks |
| Performance | IMPLEMENTED | lazy route runtimes, deferred non-critical requests, browser budgets and Lighthouse gate |
| Security | IMPLEMENTED | URL validation, sanitization, hardened local headers, dependency audit and ZAP gate |
| Capability matrix | PASS | 129/129 operations and 704/704 parameters classified |
| OpenAPI inventory | PASS | synchronized current contract snapshot |
| Documentation | PASS | architecture, capability, audit, GraphQL boundary and release validation docs |
| CI | RELEASE GATE | final GitHub Actions verification is intentionally performed after implementation work |
| main protection | PASS | development remains on `new-site`; PR target is `main` |

## API-only and advanced coverage

Capabilities without dedicated product pages remain reachable through the OpenAPI-driven Data Explorer. This intentionally includes resources such as NPC units, build tags, miscellaneous entities, generic data, loot tables, accolades, Steam information, colors and other API contract surfaces.

No unsupported endpoint, schema or GraphQL contract is invented.

## API Status contract

The status service probes:

- `GET /v1/info/health` — service health
- `GET /v1/info` — API information

Health remains authoritative for online/healthy state. API info is optional and does not make an otherwise healthy health probe fail.

The UI also surfaces latest patch and client-version context.

## Resilience contract

The API client distinguishes:

- HTTP errors
- retryable statuses
- `Retry-After`
- timeout
- abort
- response parse failures
- binary responses
- SSE streams

Non-idempotent methods are not retried unless explicitly authorized.

## Release validation boundary

GitHub Actions verifies the implementation through:

- Node test suite;
- source syntax checks;
- live API smoke;
- OpenAPI coverage audit;
- browser smoke;
- browser E2E;
- browser performance budgets;
- Lighthouse performance/accessibility/best-practices thresholds;
- dependency audit;
- OWASP ZAP baseline;
- optional authenticated smoke when a repository secret exists.

Not all 129 API operations are mass-executed because the contract includes deprecated/internal operations, required inputs, writes, streams, async jobs and rate-limited endpoints.

## Known limitations

- Automated browser validation is not a replacement for a short manual real-device visual/accessibility pass.
- Independent external penetration testing is outside repository CI.
- GraphQL local schema/query execution is intentionally not invented because the current public OpenAPI does not publish that contract; the official API-hosted GraphiQL remains the runtime discovery surface.

## Final release state

Implementation work is complete. The remaining gate is verification of the final GitHub Actions runs on the final `new-site` HEAD. Only after those gates are green should the project create the PR to `main`.
