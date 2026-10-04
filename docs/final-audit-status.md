# Deadlock Stats — Final Audit Status

Audited: 2026-10-03
Branch: `new-site`
PR: #1

## Final API/OpenAPI audit — CLOSED

The current public contract was rechecked against the repository inventory using the official API contract and its published OpenAPI mirror.

- Live contract: `https://api.deadlock-api.com/openapi.json`
- Published mirror: `https://github.com/deadlock-api/openapi-clients/blob/master/openapi.json`
- OpenAPI version: `3.1.0`
- API version: `0.1.0`
- Server: `https://api.deadlock-api.com`
- Paths: **126 / 126**
- Operations: **129 / 129**
- Parameters: **704 / 704**
- Schemas: **232 / 232**
- Security schemes: **2 / 2**
- Deprecated operations: **14**
- Documented content types: **7**
- Operation drift: **0 added / 0 removed / 0 changed**
- Schema drift: **0 added / 0 removed**
- Unclassified current operations: **0**
- Unclassified current parameters: **0**

Parameter classification reconciliation is complete: **626 `SUPPORTED_UI`**, **25 `SUPPORTED_API_ONLY`**, **50 `DEPRECATED`**, **3 `INTERNAL`**.

Operation classification reconciliation is complete: **85 `UI`**, **18 `API-ONLY`**, **5 `ADVANCED`**, **14 `DEPRECATED`**, **7 `INTERNAL`**.

The current contract also confirms the seven response content types tracked by the inventory:
`application/json`, `application/octet-stream`, `image/png`, `image/webp`, `text/event-stream`, `text/html`, and `text/plain`. Current request bodies are documented as JSON.

No API contract changes were required by this final audit. The repository inventory and capability matrix already match the current published contract exactly.

## Evidence

- Current public OpenAPI was consulted at `https://api.deadlock-api.com/openapi.json`.
- Repository capability inventory currently records 129 operations, 704 parameters and 232 schemas.
- Capability and parameter classifications are complete in the generated inventory.
- GitHub Actions run #156 passed: 213 tests, 213 passed, 0 failed, 0 skipped, 0 todo, plus live API smoke and Chromium browser smoke.
- The branch under review is `new-site`; `main` was not modified.

## Closed by code/tests

| Area | Status | Evidence |
| --- | --- | --- |
| Final API/OpenAPI audit | CLOSED | Current public contract reconciled with repository inventory: 126 paths, 129 operations, 704 parameters, 232 schemas, zero drift |
| API client | CLOSED | cache/dedupe, retries, Retry-After, timeout, abort, auth headers, content-type parsing and binary/SSE handling covered by tests |
| API Status | CLOSED | health/info composition, latency/status/error/rate-limit extraction and UI covered; live `/v1/info/health` and `/v1/info` probes pass in CI |
| Data Explorer | CLOSED | OpenAPI operation discovery, refs, schemas, request bodies, response headers/links, auth inputs, request copy and error display covered |
| Assets | CLOSED | current asset service/adapters, versioned asset queries and binary rank images covered |
| Normalization/adapters | CLOSED | adapter layer and tolerant API-facing code are covered by domain tests; no separate generic normalizer module exists because normalization is service/adapter specific |
| Pagination/filtering | CLOSED | contract-driven parameter handling, typed coercion, repeated query values and endpoint-specific services covered |
| Errors | CLOSED | HTTP error metadata, retries, Retry-After, parse errors, abort/timeout behavior covered |
| Content types | CLOSED | JSON, text, image/blob, arrayBuffer, protobuf/binary, SSE stream and raw response handling covered |
| Authentication/headers | CLOSED WITH RUNTIME LIMITATION | security metadata and request header injection are covered; protected live API calls still require real credentials |
| Advanced resources | CLOSED | Demo, Live Query/SSE, Custom Match, live URLs and polling UI/services/tests are present |
| Capability matrix | CLOSED | 129/129 operations and 704/704 parameters classified; inventory includes schemas/content types/security |
| Documentation | CLOSED | OpenAPI inventory, capability matrix, classification audit, master compliance and this final audit are present |
| Tests | CLOSED | 213/213 passing plus browser smoke in Chromium in GitHub Actions |
| Performance | CLOSED WITH BROWSER SMOKE | lazy-load/deferred request regression tests pass; Chromium smoke records dashboard DOMContentLoaded and mobile overflow; no Lighthouse/WebPageTest run |
| Security | CLOSED AT SOURCE-TEST LEVEL | external URL sanitization, auth/cache isolation and request handling are tested; no external penetration/browser security scan was run |
| PR review | READY, NOT MERGED | PR remains open/draft; final merge decision is intentionally not performed by this audit |

## Explicit limitations

This audit now includes Chromium browser smoke/E2E validation in GitHub Actions. It does **not** claim Lighthouse/WebPageTest measurements, authenticated protected-endpoint execution, or a penetration test.

No fictional API capability was added to compensate for those limitations.

## Current gate

The technical implementation gate is green at repository tests, live public-API smoke, and Chromium browser smoke level. Remaining validation is authenticated protected endpoints, Lighthouse/WebPageTest, external security testing, and human/release review.
