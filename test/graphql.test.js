import test from "node:test";
import assert from "node:assert/strict";
import { getGraphqlPlayground } from "../src/api/graphql.js";

test("GraphQL playground targets the official API endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async input => {
    request = new URL(input);
    return new Response("<!doctype html><title>GraphiQL</title>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  try {
    const result = await getGraphqlPlayground();
    assert.equal(request.pathname, "/v1/graphql");
    assert.match(result.data, /GraphiQL/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GraphQL explorer does not invent an undocumented local query schema", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function renderGraphql(signal)");
  const end = source.indexOf("\nasync function renderHeroDetail", start);
  const route = source.slice(start, end);
  assert.match(route, /Official API-hosted GraphiQL/);
  assert.match(route, /does not describe GraphQL operations/);
  assert.doesNotMatch(route, /graphql-frame/);
});

test("GraphQL capability is explicitly bounded by the published contract", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../docs/graphql-capability.md", import.meta.url), "utf8");
  assert.match(source, /GET \/v1\/graphql/);
  assert.match(source, /ADVANCED/);
  assert.match(source, /does\s+not\s+publish a GraphQL query[\\/]mutation[\\/]subscription schema/);
  assert.match(source, /does\s+not\s+invent a local GraphQL schema/);
  assert.match(source, /official GraphiQL/);
});
