import test from "node:test";
import assert from "node:assert/strict";

import {
  listApiOperations,
  describeOperation,
  buildRequest,
  executeOperation,
  enumValues,
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

test("schema helpers support OpenAPI 3.1 nullable, composition and const types", () => {
  assert.equal(schemaType({ type: ["integer", "null"] }), "integer");
  assert.equal(schemaNullable({ type: ["integer", "null"] }), true);
  assert.equal(schemaType({ oneOf: [{ type: "string" }, { type: "null" }] }), "string");
  assert.equal(schemaNullable({ anyOf: [{ type: "integer" }, { const: null }] }), true);
  assert.equal(schemaType({ allOf: [{ type: "object" }, { properties: {} }] }), "object");
  assert.equal(schemaType({ const: 7 }), "number");
  assert.deepEqual(enumValues({ anyOf: [{ enum: ["normal"] }, { const: "ranked" }] }), ["normal", "ranked"]);
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

test("listApiOperations resolves nested schema refs for request and response schemas", () => {
  const nested = {
    components: { schemas: {
      Id: { type: "integer", minimum: 0 },
      Payload: { type: "object", properties: { hero_id: { $ref: "#/components/schemas/Id" }, ids: { type: "array", items: { $ref: "#/components/schemas/Id" } } } },
      Result: { type: "object", properties: { id: { $ref: "#/components/schemas/Id" } } },
    } },
    paths: { "/v1/nested/{hero_id}": { get: {
      operationId: "nested",
      parameters: [{ name: "hero_id", in: "path", required: true, schema: { $ref: "#/components/schemas/Id" } }],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Payload" } } } },
      responses: { "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/Result" } } } } },
    } } },
  };
  const operation = listApiOperations(nested)[0];
  assert.equal(operation.parameters[0].schema.type, "integer");
  assert.equal(operation.requestBody.content["application/json"].schema.properties.hero_id.type, "integer");
  assert.equal(operation.requestBody.content["application/json"].schema.properties.ids.items.type, "integer");
  assert.equal(operation.responses["200"].content["application/json"].schema.properties.id.type, "integer");
  assert.equal(buildRequest(operation, { hero_id: "7" }).path, "/v1/nested/7");
});

test("listApiOperations resolves response header refs and schemas", () => {
  const contractWithHeaders = {
    components: {
      headers: {
        RateLimit: { description: "Requests remaining", schema: { type: "integer", minimum: 0 } },
      },
      schemas: { RequestId: { type: "string", format: "uuid" } },
    },
    paths: {
      "/v1/status": {
        get: {
          responses: {
            "200": {
              description: "ok",
              headers: {
                "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimit" },
                "X-Request-Id": { schema: { $ref: "#/components/schemas/RequestId" } },
              },
            },
          },
        },
      },
    },
  };

  const operation = listApiOperations(contractWithHeaders)[0];
  const described = describeOperation(operation, contractWithHeaders);
  assert.equal(described.responseInfo[0].headers[0].name, "X-RateLimit-Remaining");
  assert.equal(described.responseInfo[0].headers[0].schema.minimum, 0);
  assert.equal(described.responseInfo[0].headers[1].schema.format, "uuid");
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

test("buildRequest honors OpenAPI query serialization styles", () => {
  const operation = {
    method: "GET",
    path: "/v1/test/{id}",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer" } },
      { name: "tags", in: "query", style: "pipeDelimited", schema: { type: "array", items: { type: "string" } } },
      { name: "filters", in: "query", style: "deepObject", explode: true, schema: { type: "object" } },
      { name: "ids", in: "query", schema: { type: "array", items: { type: "integer" } } },
    ],
    requestBody: null,
  };
  const request = buildRequest(operation, {
    id: 7,
    tags: ["a", "b"],
    filters: { hero: "7", mode: "ranked" },
    ids: [1, 2, 3],
  });

  assert.equal(request.path, "/v1/test/7");
  assert.deepEqual(request.query, {
    "filters[hero]": "7",
    "filters[mode]": "ranked",
    ids: [1, 2, 3],
    tags: "a|b",
  });
});

test("buildRequest serializes path arrays and objects", () => {
  const operation = {
    method: "GET",
    path: "/v1/test/{ids}/{filters}",
    parameters: [
      { name: "ids", in: "path", style: "label", schema: { type: "array", items: { type: "integer" } } },
      { name: "filters", in: "path", style: "matrix", schema: { type: "object" } },
    ],
    requestBody: null,
  };
  const request = buildRequest(operation, {
    ids: [1, 2],
    filters: { hero: "7", mode: "ranked" },
  });
  assert.equal(request.path, "/v1/test/.1.2/;hero=7,mode=ranked");
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


test("request body metadata resolves examples and preserves encoding", () => {
  const contractWithBodyMetadata = {
    components: {
      examples: {
        PayloadExample: { summary: "Example", value: { hero_id: 7 } },
      },
    },
    paths: {
      "/v1/body": {
        post: {
          operationId: "body_metadata",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
                examples: { payload: { $ref: "#/components/examples/PayloadExample" } },
                encoding: { payload: { contentType: "application/json" } },
              },
            },
          },
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };
  const operation = listApiOperations(contractWithBodyMetadata)[0];
  const described = describeOperation(operation, contractWithBodyMetadata);
  assert.deepEqual(described.requestBodyInfo[0].examples.payload.value, { hero_id: 7 });
  assert.deepEqual(described.requestBodyInfo[0].encoding.payload, { contentType: "application/json" });
});

test("describeOperation reuses the operation contract for local refs", () => {
  const operation = listApiOperations({
    components: { parameters: { Id: { name: "id", in: "path", required: true, schema: { type: "integer" } } } },
    paths: { "/v1/{id}": { get: { parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "ok" } } } } },
  })[0];
  const described = describeOperation(operation);
  assert.equal(described.parameterSummary[0].type, "integer");
});

test("buildRequest matches structured suffix media type wildcards", () => {
  const operation = {
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: { content: { "application/vnd.deadlock+json": { schema: { type: "object" } } } },
  };
  const request = buildRequest(operation, { __contentType: "application/*+json", __body: '{"ok":true}' });
  assert.equal(request.mediaType, "application/vnd.deadlock+json");
  assert.deepEqual(request.body, { ok: true });
});

test("buildRequest selects compatible JSON media types", () => {
  const operation = {
    operationId: "body_media",
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: {
      content: {
        "application/vnd.deadlock+json": { schema: { type: "object" } },
        "text/plain": { schema: { type: "string" } },
      },
    },
  };
  const request = buildRequest(operation, {
    __contentType: "application/*+json",
    __body: '{"ok":true}',
  });
  assert.equal(request.mediaType, "application/vnd.deadlock+json");
  assert.deepEqual(request.body, { ok: true });
});
