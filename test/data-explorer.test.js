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

test("listApiOperations resolves OpenAPI path item refs", () => {
  const contractWithPathRef = {
    components: {
      pathItems: {
        Hero: {
          parameters: [{ name: "hero_id", in: "path", required: true, schema: { type: "integer" } }],
          get: { operationId: "hero_from_ref", responses: { "200": { description: "ok" } } },
        },
      },
    },
    paths: {
      "/v1/heroes/{hero_id}": { $ref: "#/components/pathItems/Hero" },
    },
  };

  const operation = listApiOperations(contractWithPathRef)[0];
  assert.equal(operation.operationId, "hero_from_ref");
  assert.equal(operation.parameters[0].name, "hero_id");
  assert.equal(buildRequest(operation, { hero_id: "7" }).path, "/v1/heroes/7");
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

test("listApiOperations exposes response link metadata and resolves link refs", () => {
  const contract = {
    components: {
      links: {
        NextPage: {
          operationId: "listNext",
          parameters: { cursor: "$response.header.X-Next-Cursor" },
        },
      },
    },
    paths: {
      "/v1/items": {
        get: {
          operationId: "list",
          responses: {
            "200": {
              description: "ok",
              links: { next: { $ref: "#/components/links/NextPage" } },
            },
          },
        },
      },
    },
  };
  const operation = listApiOperations(contract)[0];
  const described = describeOperation(operation, contract);
  assert.equal(described.responseInfo[0].links[0].name, "next");
  assert.equal(described.responseInfo[0].links[0].operationId, "listNext");
  assert.equal(described.responseInfo[0].links[0].parameters.cursor, "$response.header.X-Next-Cursor");
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


test("executeOperation applies an OpenAPI apiKey header security scheme", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const securedContract = {
    components: { securitySchemes: { apiKeyHeader: { type: "apiKey", in: "header", name: "X-API-KEY" } } },
    paths: { "/v1/secure": { get: {
      operationId: "secure",
      security: [{ apiKeyHeader: [] }],
      responses: { "200": { description: "ok" } },
    } } },
  };
  const operation = listApiOperations(securedContract)[0];
  await executeOperation(operation, {}, { apiKey: "secret-key" });
  assert.equal(captured.init.headers.get("X-API-KEY"), "secret-key");
});

test("executeOperation applies an OpenAPI apiKey query security scheme", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const securedContract = {
    components: { securitySchemes: { apiKeyQuery: { type: "apiKey", in: "query", name: "api_key" } } },
    paths: { "/v1/secure": { get: {
      operationId: "secure",
      security: [{ apiKeyQuery: [] }],
      responses: { "200": { description: "ok" } },
    } } },
  };
  const operation = listApiOperations(securedContract)[0];
  await executeOperation(operation, {}, { apiKey: "secret-key" });
  const url = new URL(captured.input);
  assert.equal(url.searchParams.get("api_key"), "secret-key");
  assert.equal(captured.init.headers.get("X-API-KEY"), null);
});

test("executeOperation honors OpenAPI security alternatives and rejects missing credentials", async () => {
  const contract = {
    components: {
      securitySchemes: {
        headerKey: { type: "apiKey", in: "header", name: "X-API-KEY" },
        queryKey: { type: "apiKey", in: "query", name: "api_key" },
      },
    },
    paths: { "/v1/secure": { get: {
      operationId: "secure",
      security: [{ headerKey: [] }, { queryKey: [] }],
      responses: { "200": { description: "ok" } },
    } } },
  };
  const operation = listApiOperations(contract)[0];

  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => executeOperation(operation),
    /Missing or unsupported authentication credentials/,
  );
});

test("executeOperation preserves explicit authentication for operations without security requirements", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const publicOperation = {
    operationId: "public",
    method: "GET",
    path: "/v1/public",
    parameters: [],
    requestBody: null,
  };
  await executeOperation(publicOperation, {}, { apiKey: "secret-key" });
  assert.equal(captured.init.headers.get("X-API-KEY"), "secret-key");
});


test("buildRequest serializes header parameters and rejects browser cookie parameters", () => {
  const operation = {
    method: "GET", path: "/v1/header",
    parameters: [
      { name: "X-Trace-Id", in: "header", schema: { type: "string" } },
      { name: "X-Ids", in: "header", schema: { type: "array", items: { type: "integer" } } },
      { name: "X-Filters", in: "header", schema: { type: "object", properties: { hero: { type: "integer" }, mode: { type: "string" } } } },
    ], requestBody: null,
  };
  const request = buildRequest(operation, { "X-Trace-Id": "trace-1", "X-Ids": [1, 2, 3], "X-Filters": { hero: 7, mode: "ranked" } });
  assert.equal(request.headers.get("X-Trace-Id"), "trace-1");
  assert.equal(request.headers.get("X-Ids"), "1,2,3");
  assert.equal(request.headers.get("X-Filters"), "hero=7,mode=ranked");
  assert.throws(() => buildRequest({
    method: "GET", path: "/v1/cookie",
    parameters: [{ name: "session", in: "cookie", schema: { type: "string" } }], requestBody: null,
  }, { session: "secret" }), /Cookie parameters are not supported/);
});

test("executeOperation rejects a Content-Type that conflicts with the selected request media type", async () => {
  const operation = {
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: {
      content: {
        "application/json": { schema: { type: "object" } },
        "text/plain": { schema: { type: "string" } },
      },
    },
  };
  await assert.rejects(
    () => executeOperation(operation, { __body: "{\"ok\":true}" }, { headers: { "Content-Type": "text/plain" } }),
    /conflicts with selected request media type/,
  );
});

test("executeOperation redacts security credentials from the returned request", async () => {
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const contract = {
    components: { securitySchemes: { key: { type: "apiKey", in: "header", name: "X-API-KEY" } } },
    paths: { "/v1/secure": { get: { security: [{ key: [] }], responses: { "200": { description: "ok" } } } } },
  };
  const result = await executeOperation(listApiOperations(contract)[0], {}, { apiKey: "super-secret" });
  assert.equal(captured.init.headers.get("X-API-KEY"), "super-secret");
  assert.equal(result.request.headers["x-api-key"], "[REDACTED]");
});

test("executeOperation redacts apiKey query credentials from the returned request", async () => {
  let captured;
  globalThis.fetch = async input => {
    captured = String(input);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const contract = {
    components: { securitySchemes: { key: { type: "apiKey", in: "query", name: "api_key" } } },
    paths: { "/v1/secure": { get: { security: [{ key: [] }], responses: { "200": { description: "ok" } } } } },
  };
  const result = await executeOperation(listApiOperations(contract)[0], {}, { apiKey: "super-secret" });
  assert.equal(new URL(captured).searchParams.get("api_key"), "super-secret");
  assert.equal(result.request.query.api_key, "[REDACTED]");
});

test("buildRequest coerces array items according to their schema", () => {
  const operation = listApiOperations(contract, { includeDeprecated: false })[0];
  const request = buildRequest(operation, { hero_id: "7", ids: "1,2,3" });
  assert.equal(request.query.ids, "1,2,3");
});

test("buildRequest enforces oneOf, anyOf, and allOf parameter schemas", () => {
  const oneOfOperation = {
    method: "GET",
    path: "/v1/test",
    parameters: [{
      name: "value", in: "query",
      schema: { oneOf: [{ type: "integer" }, { type: "string", pattern: "^hero$" }] },
    }],
  };
  assert.equal(buildRequest(oneOfOperation, { value: "42" }).query.value, 42);
  assert.equal(buildRequest(oneOfOperation, { value: "hero" }).query.value, "hero");
  assert.throws(() => buildRequest(oneOfOperation, { value: "her" }), /oneOf/);
  assert.throws(() => buildRequest(oneOfOperation, { value: "other" }), /oneOf/);

  const anyOfOperation = {
    method: "GET",
    path: "/v1/test",
    parameters: [{
      name: "value", in: "query",
      schema: { anyOf: [{ type: "integer" }, { type: "string", minLength: 4 }] },
    }],
  };
  assert.equal(buildRequest(anyOfOperation, { value: "rank" }).query.value, "rank");

  const allOfOperation = {
    method: "GET",
    path: "/v1/test",
    parameters: [{
      name: "value", in: "query",
      schema: { allOf: [{ type: "integer" }, { minimum: 10 }] },
    }],
  };
  assert.equal(buildRequest(allOfOperation, { value: "12" }).query.value, 12);
  assert.throws(() => buildRequest(allOfOperation, { value: "8" }), /minimum/);
});

test("buildRequest rejects undeclared request bodies", () => {
  assert.throws(() => buildRequest({
    method: "GET",
    path: "/v1/no-body",
    parameters: [],
  }, { __body: { value: true } }), /not declared/);
});

test("buildRequest coerces additional object properties from their schema", () => {
  const operation = {
    method: "GET",
    path: "/v1/test",
    parameters: [{
      name: "filters",
      in: "query",
      style: "deepObject",
      explode: true,
      schema: {
        type: "object",
        properties: { mode: { type: "string" } },
        additionalProperties: { type: "integer" },
      },
    }],
    requestBody: null,
  };
  const request = buildRequest(operation, { filters: { mode: "ranked", hero: "7" } });
  assert.deepEqual(request.query, {
    "filters[mode]": "ranked",
    "filters[hero]": 7,
  });
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

test("buildRequest parses string arrays according to OpenAPI query styles", () => {
  const operation = {
    method: "GET",
    path: "/v1/test",
    parameters: [
      { name: "space_ids", in: "query", style: "spaceDelimited", schema: { type: "array", items: { type: "integer" } } },
      { name: "pipe_ids", in: "query", style: "pipeDelimited", schema: { type: "array", items: { type: "integer" } } },
      { name: "form_ids", in: "query", style: "form", explode: false, schema: { type: "array", items: { type: "integer" } } },
      { name: "form_exploded", in: "query", style: "form", explode: true, schema: { type: "array", items: { type: "integer" } } },
    ],
    requestBody: null,
  };
  const request = buildRequest(operation, {
    space_ids: "1 2 3",
    pipe_ids: "4|5|6",
    form_ids: "7,8,9",
    form_exploded: "10",
  });

  assert.deepEqual(request.query, {
    space_ids: "1 2 3",
    pipe_ids: "4|5|6",
    form_ids: "7,8,9",
    form_exploded: [10],
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

test("buildRequest percent-encodes reserved characters inside path parameters", () => {
  const operation = {
    method: "GET",
    path: "/v1/test/{id}/{tags}/{filters}",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
      { name: "tags", in: "path", style: "label", schema: { type: "array", items: { type: "string" } } },
      { name: "filters", in: "path", style: "matrix", schema: { type: "object" } },
    ],
    requestBody: null,
  };
  const request = buildRequest(operation, {
    id: "hero/alpha?mode=ranked#build",
    tags: ["a/b", "x y"],
    filters: { "hero/id": "7", mode: "ranked+street" },
  });
  assert.equal(request.path, "/v1/test/hero%2Falpha%3Fmode%3Dranked%23build/.a%2Fb.x%20y/;hero%2Fid=7,mode=ranked%2Bstreet");
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

test("enumValues deduplicates structural object and array values", () => {
  assert.deepEqual(enumValues({
    oneOf: [
      { enum: [{ mode: "ranked" }, { mode: "ranked" }] },
      { const: { mode: "ranked" } },
      { enum: [[1, 2], [1, 2]] },
    ],
  }), [{ mode: "ranked" }, [1, 2]]);
});

test("buildRequest validates OpenAPI numeric exclusive and multipleOf constraints", () => {
  const operation = {
    method: "GET", path: "/v1/validate", parameters: [
      { name: "score", in: "query", schema: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 10, multipleOf: 0.5 } },
    ], requestBody: null,
  };
  assert.equal(buildRequest(operation, { score: "2.5" }).query.score, 2.5);
  assert.throws(() => buildRequest(operation, { score: "0" }), /exclusiveMinimum/);
  assert.throws(() => buildRequest(operation, { score: "10" }), /exclusiveMaximum/);
  assert.throws(() => buildRequest(operation, { score: "2.3" }), /multipleOf/);
});

test("buildRequest validates numeric, boolean, enum and array constraints", () => {
  const operation = {
    method: "GET",
    path: "/v1/validate",
    parameters: [
      { name: "count", in: "query", schema: { type: "integer", minimum: 1, maximum: 10 } },
      { name: "enabled", in: "query", schema: { type: "boolean" } },
      { name: "mode", in: "query", schema: { type: "string", enum: ["ranked", "normal"] } },
      { name: "ids", in: "query", description: "Comma separated list of ids", schema: { type: "array", minItems: 2, maxItems: 3, items: { type: "integer" } } },
    ],
    requestBody: null,
  };

  assert.equal(buildRequest(operation, { count: "4", enabled: "false", mode: "ranked", ids: "1,2" }).query.count, 4);
  assert.equal(buildRequest(operation, { count: "4", enabled: "false", mode: "ranked", ids: "1,2" }).query.enabled, false);
  assert.throws(() => buildRequest(operation, { count: "1.5" }), /integer/);
  assert.throws(() => buildRequest(operation, { count: "0" }), /minimum/);
  assert.throws(() => buildRequest(operation, { enabled: "yes" }), /boolean/);
  assert.throws(() => buildRequest(operation, { mode: "casual" }), /enum/);
  assert.throws(() => buildRequest(operation, { ids: "1" }), /minItems/);
  assert.throws(() => buildRequest(operation, { ids: "1,2,3,4" }), /maxItems/);
});

test("buildRequest applies OpenAPI parameter defaults", () => {
  const operation = {
    method: "GET",
    path: "/v1/defaults",
    parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 20 } }],
    requestBody: null,
  };
  assert.deepEqual(buildRequest(operation, {}).query, { limit: 20 });
});

test("buildRequest validates JSON request bodies against their schema", () => {
  const operation = {
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["hero_id", "mode"],
            properties: {
              hero_id: { type: "integer", minimum: 1 },
              mode: { type: "string", enum: ["ranked", "normal"] },
              ids: { type: "array", minItems: 1, items: { type: "integer" } },
            },
          },
        },
      },
    },
  };

  assert.deepEqual(
    buildRequest(operation, { __body: '{"hero_id":7,"mode":"ranked","ids":[1,2]}' }).body,
    { hero_id: 7, mode: "ranked", ids: [1, 2] },
  );
  assert.throws(() => buildRequest(operation, { __body: '{"mode":"ranked"}' }), /hero_id/);
  assert.throws(() => buildRequest(operation, { __body: '{"hero_id":0,"mode":"ranked"}' }), /minimum/);
  assert.throws(() => buildRequest(operation, { __body: '{"hero_id":7,"mode":"casual"}' }), /enum/);
  assert.throws(() => buildRequest(operation, { __body: '{"hero_id":7,"mode":"ranked","ids":[]}' }), /minItems/);
});

test("buildRequest validates oneOf and additionalProperties in JSON bodies", () => {
  const operation = {
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            oneOf: [
              { type: "object", required: ["id"], properties: { id: { type: "integer" } }, additionalProperties: false },
              { type: "object", required: ["name"], properties: { name: { type: "string" } }, additionalProperties: false },
            ],
          },
        },
      },
    },
  };

  assert.equal(buildRequest(operation, { __body: '{"id":7}' }).body.id, 7);
  assert.throws(() => buildRequest(operation, { __body: '{"unknown":true}' }), /oneOf/);
  assert.throws(() => buildRequest(operation, { __body: '{"id":7,"unknown":true}' }), /oneOf/);
});

test("request body validation separates oneOf and anyOf", () => {
  const oneOf = {
    method: "POST", path: "/v1/body", parameters: [],
    requestBody: { content: { "application/json": { schema: {
      oneOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "object", properties: { b: { type: "string" } } }],
    } } } },
  };
  assert.throws(() => buildRequest(oneOf, { __body: { a: "x", b: "y" } }), /oneOf requires exactly one/);

  const anyOf = {
    ...oneOf,
    requestBody: { content: { "application/json": { schema: {
      anyOf: [{ type: "object", required: ["a"], properties: { a: { type: "string" } } }, { type: "object", required: ["b"], properties: { b: { type: "string" } } }],
    } } } },
  };
  assert.doesNotThrow(() => buildRequest(anyOf, { __body: { a: "x", b: "y" } }));
});

test("request body validation supports structural enum, exclusive bounds, multipleOf, and pattern", () => {
  const operation = {
    method: "POST", path: "/v1/body", parameters: [],
    requestBody: { content: { "application/json": { schema: {
      type: "object",
      properties: {
        mode: { enum: [{ kind: "ranked" }] },
        score: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 10, multipleOf: 0.5 },
        name: { type: "string", pattern: "^[A-Z]+$" },
      },
    } } } },
  };

  assert.doesNotThrow(() => buildRequest(operation, {
    __body: { mode: { kind: "ranked" }, score: 2.5, name: "OK" },
  }));
  assert.throws(() => buildRequest(operation, {
    __body: { mode: { kind: "other" }, score: 2.5, name: "OK" },
  }), /enum/);
  assert.throws(() => buildRequest(operation, {
    __body: { mode: { kind: "ranked" }, score: 0, name: "OK" },
  }), /exclusiveMinimum/);
  assert.throws(() => buildRequest(operation, {
    __body: { mode: { kind: "ranked" }, score: 2.3, name: "OK" },
  }), /multipleOf/);
  assert.throws(() => buildRequest(operation, {
    __body: { mode: { kind: "ranked" }, score: 2.5, name: "bad" },
  }), /pattern/);
});

test("buildRequest rejects unsupported request content types", () => {
  const operation = {
    method: "POST",
    path: "/v1/body",
    parameters: [],
    requestBody: { content: { "application/json": { schema: { type: "object" } } } },
  };
  assert.throws(
    () => buildRequest(operation, { __contentType: "text/plain", __body: "plain" }),
    /Unsupported request content type/,
  );
});

test("response metadata resolves example refs", () => {
  const contractWithExample = {
    components: { examples: { Result: { value: { ok: true } } } },
    paths: { "/v1/result": { get: {
      responses: { "200": {
        description: "ok",
        content: { "application/json": { examples: { result: { $ref: "#/components/examples/Result" } } } },
      } },
    } } },
  };
  const operation = listApiOperations(contractWithExample)[0];
  const described = describeOperation(operation);
  assert.deepEqual(described.responseInfo[0].content[0].examples.result.value, { ok: true });
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
