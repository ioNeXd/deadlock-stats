# Deadlock API — OpenAPI Inventory

Generated from the current official OpenAPI contract on 2026-10-03.

Source: https://api.deadlock-api.com/openapi.json
Mirror used for machine parsing: https://github.com/deadlock-api/openapi-clients/blob/master/openapi.json

## Contract totals

- OpenAPI: 3.1.0
- API version: 0.1.0
- Paths: 126
- Operations: 129
- Schemas: 230
- Security schemes: 2
- Deprecated operations: 14
- Distinct content types: 7

## Operations by tag

- Analytics: 21
- Players: 14
- Matches: 10
- Internal: 7
- Custom Matches: 6
- MMR: 6
- Items: 5
- Assets Bucket: 4
- Commands: 4
- Crosshair: 4
- Leaderboard: 4
- Demo: 4
- Accolades: 3
- Build Tags: 3
- Heroes: 3
- Ranks: 3
- Builds: 3
- Patches: 3
- SQL: 3
- Misc Entities: 2
- Modifiers: 2
- NPC Units: 2
- Steam Info: 2
- Info: 2
- Steam: 2
- Client Versions: 1
- Colors: 1
- Generic Data: 1
- Loot Tables: 1
- Map: 1
- Ranked Seasons: 1
- GraphQL: 1

## Content types

- `application/json`
- `application/octet-stream`
- `image/png`
- `image/webp`
- `text/event-stream`
- `text/html`
- `text/plain`

## Deprecated operations

- `GET /v1/assets/loot-tables` — list_loot_tables
- `GET /v1/patches` — feed
- `GET /v1/players/mmr` — mmr
- `GET /v1/players/mmr/distribution` — mmr_distribution
- `GET /v1/players/mmr/distribution/{hero_id}` — hero_mmr_distribution
- `GET /v1/players/mmr/{hero_id}` — hero_mmr
- `GET /v1/players/rank-predict/image` — rank_predict_avg_image
- `GET /v1/players/{account_id}/mmr-history` — mmr_history
- `GET /v1/players/{account_id}/mmr-history/{hero_id}` — hero_mmr_history
- `GET /v1/players/{account_id}/rank-predict` — rank_predict
- `GET /v1/players/{account_id}/rank-predict/image` — rank_predict_image
- `GET /v1/sql` — sql
- `GET /v1/sql/tables` — list_tables
- `GET /v1/sql/tables/{table}/schema` — table_schema

## Notes

- This inventory is generated from the OpenAPI contract; it is not a hand-maintained duplicate.
- The full machine-readable endpoint, parameter, response, schema and content-type details live in `docs/api-openapi-inventory.json`.
- Capability and parameter classifications remain a separate product-layer concern.
- Unknown fields and future enum values must be tolerated by adapters/normalizers.
