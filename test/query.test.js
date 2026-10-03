import test from "node:test";
import assert from "node:assert/strict";

import { queryToObject } from "../src/api/query.js";

test("queryToObject preserves repeated URLSearchParams values", () => {
  const query = new URLSearchParams();
  query.append("account_ids", "7");
  query.append("account_ids", "8");
  query.append("language", "en");

  assert.deepEqual(queryToObject(query), {
    account_ids: ["7", "8"],
    language: "en",
  });
});

test("queryToObject returns ordinary query objects unchanged", () => {
  const query = { account_ids: [7, 8], limit: 20 };
  assert.strictEqual(queryToObject(query), query);
});
