# API classification audit

Generated from `docs/api-openapi-inventory.json`.

## Result

- Operations classified: 129/129
- Parameters classified: 704/704
- UI operations: 85
- API-only operations: 18
- Advanced operations: 5
- Deprecated operations: 14
- Internal operations: 7

## Parameter classifications

- SUPPORTED_UI: 640
- SUPPORTED_API_ONLY: 25
- DEPRECATED: 36
- INTERNAL: 3

## Rule

The classification is derived from the current OpenAPI contract. Deprecated and internal operations override product-surface classification. Advanced operations are explicitly identified where their protocol/workflow requires a specialized tool; remaining tagged game-data and gameplay operations are UI candidates, while unmatched operations remain API-only.

The complete operation/parameter mapping is machine-readable in `docs/api-capability-matrix.json`.
