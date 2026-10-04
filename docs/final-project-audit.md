# Final Project Audit

Audited: 2026-10-03
Branch: `new-site`
Repository: `ioNeXd/deadlock-stats`

## Scope

This audit closes the implementation checklist against the current Deadlock API contract and the project master requirements. GitHub Actions is intentionally verified separately at the end of the release sequence.

## Checklist

| # | Area | Implementation | Final CI verification |
|---:|---|---|---|
| 1 | API/OpenAPI audit | PASS | Pending release gate |
| 2 | Data Explorer | PASS | Pending release gate |
| 3 | API Client | PASS | Pending release gate |
| 4 | API Status | PASS | Pending release gate |
| 5 | Dashboard | PASS | Pending release gate |
| 6 | Matches | PASS | Pending release gate |
| 7 | Players | PASS | Pending release gate |
| 8 | Heroes | PASS | Pending release gate |
| 9 | Items | PASS | Pending release gate |
| 10 | Builds | PASS | Pending release gate |
| 11 | Analytics | PASS | Pending release gate |
| 12 | Leaderboard | PASS | Pending release gate |
| 13 | Patches / history | PASS | Pending release gate |
| 14 | GraphQL | PASS within documented API boundary | Pending release gate |
| 15 | Demo Explorer | PASS | Pending release gate |
| 16 | Live Query / SSE | PASS | Pending release gate |
| 17 | Custom Match Tools | PASS | Pending release gate |
| 18 | API capability matrix | PASS | Pending release gate |
| 19 | Automated tests | IMPLEMENTED | Pending release gate |
| 20 | Browser performance | IMPLEMENTED | Pending release gate |
| 21 | Accessibility | IMPLEMENTED | Pending release gate |
| 22 | Security | IMPLEMENTED | Pending release gate |
| 23 | Responsiveness / UX | IMPLEMENTED | Pending release gate |
| 24 | Architecture review | PASS | Pending release gate |
| 25 | Documentation | PASS | Pending release gate |
| 26 | Full project audit | PASS | Pending release gate |
| 27 | Full test execution | READY | Pending release gate |
| 28 | GitHub Actions workflows | READY | Pending release gate |
| 29 | Regression review | PASS by source/test review | Pending release gate |
| 30 | Performance verification | READY | Pending release gate |
| 31 | Security verification | READY | Pending release gate |
| 32 | Branch `new-site` | PASS | Verify final HEAD |
| 33 | PR to `main` | NOT YET | Only after all gates are green |

## Contract coverage

The current audited public OpenAPI contract records:

- 129 operations;
- 704 parameters;
- 232 schemas;
- 2 security schemes;
- 7 response/request content types;
- 14 deprecated operations;
- 7 internal operations.

All operations and parameters are classified in the capability inventory.

Capabilities without dedicated UI remain available through Data Explorer. This includes API-only and advanced resources such as NPC units, build tags, miscellaneous entities, generic data, loot tables, accolades, Steam information, colors and other contract surfaces.

## Architecture review

The implementation follows:

```text
OpenAPI
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

Transport concerns remain centralized in `src/api/client.js`. Feature semantics are exposed through services, API-specific normalization is isolated in adapters, and the UI consumes service/view-model results.

Route-specific service modules are lazy-loaded. Critical dashboard and detail paths defer non-critical catalogs, analytics, patch feeds and relationship/history requests.

## Reliability review

The implementation explicitly covers:

- cancellation and route aborts;
- request timeouts;
- deterministic cache keys;
- GET deduplication;
- cache invalidation;
- retryable HTTP statuses;
- `Retry-After`;
- idempotency-aware retry policy;
- response parsing failures;
- JSON, text, binary, image and SSE responses;
- partial/degraded feature states;
- optional API data without collapsing critical views.

## Security review

The application includes:

- external URL validation;
- patch-content sanitization;
- hardened local security-server headers;
- dependency audit;
- OWASP ZAP baseline policy;
- no fabricated credentials;
- no client-side API secret requirement;
- explicit handling of API error and rate-limit metadata.

## Browser quality review

Automated browser coverage is configured for:

- all primary routes;
- command palette navigation;
- filters and detail routes;
- keyboard focus;
- mobile/tablet/desktop rendering;
- horizontal overflow;
- console/page errors;
- browser performance budgets;
- Lighthouse performance, accessibility and best-practices thresholds.

A final manual browser/device pass remains a release-quality recommendation rather than a repository implementation blocker.

## Deliberate API boundaries

### GraphQL

The public OpenAPI currently exposes `/v1/graphql` as an API-hosted GraphiQL playground but does not publish a local GraphQL operation/schema contract. The application therefore does not invent GraphQL queries, mutations, subscriptions, variables or introspection behavior. Runtime schema discovery is delegated to the official playground.

### Demo / Live Query

Demo schema, asynchronous query jobs and SSE live queries are implemented according to their documented response formats. They are not mass-executed during release validation because they require endpoint-specific query inputs and can be rate-limited or long-running.

### Write operations

Custom-match creation and lifecycle actions are exposed only through their documented contracts. Release validation does not blindly execute write operations.

## Release gate

The remaining work after this audit is verification, not feature implementation:

1. verify the latest test workflow for the final HEAD;
2. verify security workflow for the same HEAD;
3. inspect artifacts/logs for browser, Lighthouse and API smoke checks;
4. fix only regressions found by those gates;
5. re-run until green;
6. verify `new-site` HEAD and compare against `main`;
7. only then create the PR targeting `main`.

No PR to `main` is considered complete before the release gate is green.
