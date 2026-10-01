import test from "node:test";
import assert from "node:assert/strict";

import {
  listApiOperations,
  describeOperation,
  buildRequest,
  executeOperation,
} from "../src/services/data-explorer.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const contract = {
  paths: {
    "/v1/example/{hero_id}": {
      get: {
        operationId: "example",
        summary: "Example",
        tags: ["Example"],
        parameters: [
          { name: "hero_id", in: "path", required: true, schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "enabled", in: "query", schema: { type: "boolean" } },
          { name: "ids", in: "query", schema: { type: "array", items: { type: "integer" } } },
        ],
        responses: { "200": { description: "ok" } },
      },
    },
    "/v1/deprecated": {
      get: { operationId: "deprecated", deprecated: true },
    },
  },
};

test("listApiOperations enumerates documented HTTP operations", () => {
  const operations = listApiOperations(contract);
  assert.equal(operations.length, 2);
  assert.equal(operations[0].method, "GET");
  assert.equal(operations[0].path, "/v1/deprecated");
  assert.equal(listApiOperations(contract, { includeDeprecated: false }).length, 1);
});

test("describeOperation separates path and query parameters", () => {
  const operation = listApiOperations(contract, { includeDeprecated: false })[0];
  const described = describeOperation(operation);

  assert.equal(described.pathParameters[0].name, "hero_id");
  assert.equal(described.queryParameters[1].name, "enabled");
  assert.deepEqual(described.parameterSummary[2].schema.type, "array");
});

test("buildRequest coerces typed query parameters and encodes path parameters", () => {
  const operation = listApiOperations(contract, { includeDeprecated: false })[0];
  const request = buildRequest(operation, {
    hero_id: 42,
    limit: "10",
    enabled: "true",
    ids: "1,2,3",
  });

  assert.equal(request.path, "/v1/example/42");
  assert.deepEqual(request.query, { enabled: true, ids: ["1", "2", "3"], limit: 10 });
});

test("executeOperation delegates the documented operation to the API client", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const operation = listApiOperations(contract, { includeDeprecated: false })[0];
  const result = await executeOperation(operation, { hero_id: 7, limit: "5" });

  const url = new URL(captured.input);
  assert.equal(url.pathname, "/v1/example/7");
  assert.equal(url.searchParams.get("limit"), "5");
  assert.equal(result.data.ok, true);
});
