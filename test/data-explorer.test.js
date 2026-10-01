import test from "node:test";
import assert from "node:assert/strict";

import {
  listApiOperations,
  describeOperation,
  buildRequest,
  executeOperation,
  schemaType,
  schemaNullable,
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
          { name: "ids", in: "query", description: "Comma separated list of ids", schema: { type: "array", items: { type: "integer" } } },
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
  assert.equal(described.parameterSummary[3].schema.type, "array");
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
  assert.deepEqual(request.query, { enabled: true, ids: "1,2,3", limit: 10 });
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
  const controller = new AbortController();
  const result = await executeOperation(operation, { hero_id: 7, limit: "5" }, { signal: controller.signal });

  const url = new URL(captured.input);
  assert.equal(url.pathname, "/v1/example/7");
  assert.equal(url.searchParams.get("limit"), "5");
  assert.equal(result.data.ok, true);
  assert.ok(captured.init.signal instanceof AbortSignal);
});


test("schema helpers support nullable and union types", () => {
  assert.equal(schemaType({ type: ["integer", "null"] }), "integer");
  assert.equal(schemaNullable({ type: ["integer", "null"] }), true);
  assert.equal(schemaType({ oneOf: [{ type: "string" }, { type: "null" }] }), "string");
});

test("listApiOperations resolves local parameter refs", () => {
  const contractWithRef = {
    components: {
      parameters: {
        HeroId: { name: "hero_id", in: "path", required: true, schema: { type: "integer" } },
      },
      requestBodies: {
        Body: { required: true, content: { "application/json": { schema: { type: "object" } } } },
      },
      responses: {
        Ok: { description: "ok", content: { "application/json": { schema: { type: "object" } } } },
      },
    },
    paths: {
      "/v1/heroes/{hero_id}": {
        get: {
          operationId: "hero",
          parameters: [{ $ref: "#/components/parameters/HeroId" }],
          requestBody: { $ref: "#/components/requestBodies/Body" },
          responses: { "200": { $ref: "#/components/responses/Ok" } },
        },
      },
    },
  };

  const operation = listApiOperations(contractWithRef)[0];
  assert.equal(operation.parameters[0].name, "hero_id");
  assert.equal(operation.requestBody.required, true);
  assert.equal(operation.responses["200"].description, "ok");
  assert.equal(buildRequest(operation, { hero_id: "7", __body: "{}" }).path, "/v1/heroes/7");
});

test("describeOperation resolves parameter and request body schema refs", () => {
  const contractWithSchemaRef = {
    components: {
      schemas: {
        HeroId: { type: "integer", minimum: 0 },
        Payload: { type: "object", properties: { hero_id: { $ref: "#/components/schemas/HeroId" } } },
      },
    },
    paths: {
      "/v1/heroes/{hero_id}": {
        get: {
          operationId: "hero",
          parameters: [{ name: "hero_id", in: "path", required: true, schema: { $ref: "#/components/schemas/HeroId" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Payload" } } } },
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };
  const operation = listApiOperations(contractWithSchemaRef)[0];
  const described = describeOperation(operation, contractWithSchemaRef);
  assert.equal(described.parameterSummary[0].type, "integer");
  assert.equal(described.parameterSummary[0].constraints.minimum, 0);
  assert.equal(described.requestBodyInfo[0].schema.type, "object");
});

test("listApiOperations merges path-level parameters and preserves security metadata", () => {
  const extended = {
    openapi: "3.1.0",
    security: [{ apiKeyAuth: [] }],
    paths: {
      "/v1/example/{hero_id}": {
        parameters: [{ name: "hero_id", in: "path", required: true, schema: { type: "integer" } }],
        get: {
          operationId: "merged",
          parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };

  const operation = listApiOperations(extended)[0];
  assert.equal(operation.parameters.length, 2);
  assert.deepEqual(operation.security, [{ apiKeyAuth: [] }]);
});

test("buildRequest coerces array items according to their schema", () => {
  const operation = listApiOperations(contract, { includeDeprecated: false })[0];
  const request = buildRequest(operation, { hero_id: "7", ids: "1,2,3" });
  assert.equal(request.query.ids, "1,2,3");
});

test("executeOperation applies the documented request media type", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const operation = {
    operationId: "body",
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": { schema: { type: "object" } },
      },
    },
    responses: { "200": { description: "ok" } },
  };

  await executeOperation(operation, { __body: JSON.stringify({ hello: "world" }) });
  assert.equal(captured.init.headers.get("Content-Type"), "application/json");
});


test("buildRequest rejects missing required parameters and preserves non-JSON bodies", () => {
  assert.throws(
    () => buildRequest({
      path: "/v1/test/{id}",
      method: "GET",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      requestBody: null,
    }, {}),
    /Missing required parameter: id/,
  );

  const request = buildRequest({
    path: "/v1/test",
    method: "POST",
    parameters: [],
    requestBody: {
      required: true,
      content: { "text/plain": { schema: { type: "string" } } },
    },
  }, { __contentType: "text/plain", __body: "plain text" });

  assert.equal(request.body, "plain text");
  assert.equal(request.mediaType, "text/plain");

  assert.throws(
    () => buildRequest({
      path: "/v1/test",
      method: "POST",
      parameters: [],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
    }, { __body: "{broken" }),
    /valid JSON/,
  );
});
