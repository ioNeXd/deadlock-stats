import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function has(source, marker) {
  assert.ok(source.includes(marker), "missing compliance marker: " + marker);
}

test("master compliance: API status exposes health, transport, retry, version and patch context", () => {
  const app = read("src/app.js");
  const service = read("src/services/api-status.js");

  has(service, '"/v1/info/health"');
  has(service, '"/v1/info"');
  has(service, "Promise.allSettled");
  for (const marker of ["HTTP status", "Latency", "Endpoint", "Retry-After", "Client version", "Latest patch", "Error", 'services/patches.js']) {
    has(app, marker);
  }
});

test("master compliance: Data Explorer covers OpenAPI contract surfaces", () => {
  const source = read("src/services/data-explorer.js");
  for (const marker of [
    "listApiOperations", "describeOperation", "parameterSummary", "requestBodyInfo",
    "responseInfo", "security", "enumValues", "minItems", "maxItems",
    "oneOf", "anyOf", "allOf", "contentType",
  ]) has(source, marker);
});

test("master compliance: asset adapter preserves raw data and official image fields", () => {
  const source = read("src/adapters/assets.js");
  for (const field of [
    "background_image", "background_image_webp", "hero_card_critical", "hero_card_critical_webp",
    "hero_card_gloat", "hero_card_gloat_webp", "icon_hero_card", "icon_hero_card_webp",
    "icon_image_small", "icon_image_small_webp", "minimap_image", "minimap_image_webp",
    "name_image", "top_bar_vertical_image", "top_bar_vertical_image_webp",
    "vote_sticker", "vote_sticker_webp", "weapon_image", "weapon_image_webp",
  ]) has(source, field);
  has(source, "raw: entity");
});

test("master compliance: API client covers transport failures and retry metadata", () => {
  const source = read("src/api/client.js");
  for (const marker of [
    "AbortController", "Retry-After", "retryAfterMs", "408", "429", "500", "502",
    "503", "504", "TIMEOUT", "RESPONSE_PARSE_ERROR", "application/x-protobuf",
    "text/event-stream",
  ]) has(source, marker);
});

test("master compliance: capability inventory remains complete", () => {
  const matrix = JSON.parse(read("docs/api-capability-matrix.json"));
  const inventory = JSON.parse(read("docs/api-openapi-inventory.json"));
  const audit = read("docs/api-classification-audit.md");

  assert.equal(matrix.inventory.operation_count, 129);
  assert.equal(matrix.operation_classifications.length, 129);
  assert.equal(inventory.operation_count, 129);
  has(audit, "129/129");
  has(audit, "704/704");
  has(audit, "SUPPORTED_UI");
  has(audit, "SUPPORTED_API_ONLY");
  has(audit, "DEPRECATED");
  has(audit, "INTERNAL");
});

test("master compliance: CI remains GitHub Actions based on new-site", () => {
  const workflow = read(".github/workflows/test.yml");
  const packageJson = JSON.parse(read("package.json"));

  has(workflow, "new-site");
  has(workflow, "npm test");
  assert.equal(packageJson.engines.node, ">=22");
});
