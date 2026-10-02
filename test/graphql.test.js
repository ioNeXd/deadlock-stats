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
    assert.match(result, /GraphiQL/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
