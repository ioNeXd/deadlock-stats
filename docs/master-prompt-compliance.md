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
| Data Explorer | PASS | operations, parameters, request bodies, responses, schemas, security, content types, validation, pagination-capable request controls |
| Assets | PASS | official API image fields, WebP preference support, raw preservation |
| Unknown/optional API data | PASS | normalizers preserve raw data and tolerate optional/unknown fields |
| Player Detail | PASS | current rank, derived rank history, forecast, optional Patreon data with degraded states |
| Match Detail | PASS | current metadata endpoint, roster/assets/raw API data |
| Hero Detail | PASS | analytics, matchups, builds, ability orders |
| Build Detail | PASS | build detail remains available when optional performance analytics fail |
| Advanced tools | PASS | Demo, Live Query/SSE, Custom Match, Live URLs, async job polling |
| Accessibility | PASS | skip link, labelled navigation, aria-current, visible focus |
| Performance | PASS | route-level/deferred loading, dashboard/player/detail request isolation |
| Security | PASS | URL validation, sanitization, no credentials/secrets in source |
| Capability matrix | PASS | 129/129 operations and 704/704 parameters classified |
| OpenAPI inventory | PASS | current timestamp defaults synchronized |
| CI | PASS | Node 22 + `npm test` through GitHub Actions |
| main protection | PASS | development remains on `new-site`; PR targets `main` |

## API Status contract

The status service probes both:

- `GET /v1/info/health` — service health
- `GET /v1/info` — API information

Health remains authoritative for online/healthy state. API info is optional and does not make an otherwise healthy health probe fail.

The UI also surfaces the latest available patch feed and client version context.

## Resilience contract

The API client continues to distinguish:

- HTTP errors
- retryable status codes
- `Retry-After`
- timeout
- abort
- deterministic response parsing errors
- binary responses
- SSE streams

Non-idempotent methods are not retried unless explicitly authorized.

## Known limitations

- No browser/e2e runner is configured in the repository.
- Visual verification is therefore represented by source-level accessibility/performance contracts and GitHub Actions tests.
- The API may expose capabilities classified as API-only, advanced, internal or deprecated; these remain documented rather than being invented as dedicated UI.

## Validation

The compliance suite is enforced by `test/master-compliance.test.js` and runs through the existing GitHub Actions test workflow.
