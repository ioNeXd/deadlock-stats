# Release validation

This document records the final validation layers that can be executed automatically from GitHub Actions.

## Automated in CI

- deterministic Node test suite;
- live public Deadlock API smoke checks;
- live OpenAPI inventory and operation-classification drift audit;
- Playwright browser route smoke tests;
- Playwright browser E2E checks for:
  - Command Palette;
  - Data Explorer operation selection;
  - hero/build/leaderboard filters;
  - match detail navigation when the live API returns a match;
  - hero/build detail navigation when live data is available;
  - player search surface;
  - keyboard focus;
  - mobile, tablet and desktop viewport rendering;
  - horizontal-overflow regression;
  - page/console error detection;
- browser performance budgets for DOMContentLoaded, TTFB, LCP, CLS, event/INP-style timing when supported, JavaScript transfer and total initial transfer;
- Lighthouse performance, accessibility and best-practices audit;
- dependency vulnerability audit;
- OWASP ZAP baseline scan against the local application;
- optional authenticated API smoke test when the repository secret `DEADLOCK_API_KEY` is configured.

## Intentionally not executed automatically

### All 129 operations

The live contract contains 129 operations, but executing every operation would be unsafe or misleading because the inventory includes deprecated/internal/advanced operations, required parameters, write operations, long-running jobs, live streams and rate-limited capabilities.

CI therefore verifies that all 129 operations are classified and reports the executable public GET candidate count without blindly invoking them.

### Protected endpoints

The authenticated smoke test is skipped when `DEADLOCK_API_KEY` is absent. It must never fabricate credentials. When configured, CI fails if the credential is rejected.

### Binary/protobuf, SSE, GraphQL, demos and async jobs

The client and contract have support/coverage for these protocols where documented, but production execution requires endpoint-specific parameters and/or operational conditions. They are not mass-executed as part of the release gate.

### External penetration testing

OWASP ZAP is an automated baseline assessment, not a substitute for an independent penetration test. A true external pentest remains an operational/release activity outside repository CI.

### Human UX validation

Automated browser coverage catches regressions, but final release should still include a short manual pass on a real browser and mobile device for visual hierarchy, interaction feel, accessibility, network-error behavior and data comprehension.

## Release interpretation

A green CI run means the repository passed the automated validation layers available without inventing credentials or unsafe API traffic. It does not claim that every API operation was executed or that an independent security assessment or human usability session occurred.
