# GraphQL capability

## Current API contract

The current Deadlock API publishes `GET /v1/graphql` as an **ADVANCED** operation. The current OpenAPI contract describes it as the official GraphiQL playground response and does not publish a GraphQL query/mutation/subscription schema or a documented GraphQL transport operation for the application to call directly.

Therefore Deadlock Stats intentionally does **not** invent a local GraphQL schema, POST contract, introspection URL, query examples, or variable format.

## UI behavior

The GraphQL Explorer:

- probes the official `GET /v1/graphql` endpoint;
- reports endpoint availability;
- exposes the official API-hosted GraphiQL playground in a new tab;
- identifies the integration as API-hosted GraphiQL;
- keeps the local application free of undocumented GraphQL assumptions.

Schema discovery and query execution are delegated to the official GraphiQL interface, which is the authoritative runtime surface for this capability.

## Classification

| Capability | Classification | Reason |
| --- | --- | --- |
| `GET /v1/graphql` playground | ADVANCED | Published by OpenAPI, intended for interactive GraphiQL use |
| Local GraphQL schema | UNAVAILABLE | Not published by the current OpenAPI contract |
| Local GraphQL query execution | UNAVAILABLE | No documented transport operation/contract in the current OpenAPI |
| Runtime schema discovery | API-ONLY | Available through the official GraphiQL runtime |

This boundary must be revisited if the API publishes a machine-readable GraphQL schema or documented GraphQL transport contract.
