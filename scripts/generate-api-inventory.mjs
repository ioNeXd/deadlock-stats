#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";

const SPEC_URL = process.env.DEADLOCK_OPENAPI_URL ?? "https://api.deadlock-api.com/openapi.json";
const OUT_JSON = "docs/API_INVENTORY.json";
const OUT_MD = "docs/API_INVENTORY.md";

const response = await fetch(SPEC_URL, {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(120_000),
});
if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
}

const spec = await response.json();
if (!spec || typeof spec !== "object" || !spec.paths || typeof spec.paths !== "object") {
  throw new Error("OpenAPI document has no valid paths object");
}

const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
const rows = [];
const IMPLEMENTED_ENDPOINTS = {
  hero_build_stats: ["components/pages/hero-page.tsx", "lib/api/builds.ts"],
  fetch_build_live: ["lib/api/builds.ts"],
  get_items_by_hero_id: ["lib/api/builds.ts"],
};

for (const [path, pathItem] of Object.entries(spec.paths)) {
  if (!pathItem || typeof pathItem !== "object") continue;
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation || typeof operation !== "object") continue;
    const operationId = operation.operationId;
    if (!operationId) {
      throw new Error(`Missing operationId for ${method.toUpperCase()} ${path}`);
    }

    const description = String(operation.description ?? operation.summary ?? "")
      .replace(/\s+/g, " ")
      .trim();

    const tags = Array.isArray(operation.tags) ? operation.tags.map(String) : [];
    const deprecated = operation.deprecated === true;
    const text = `${operation.summary ?? ""} ${description}`.toLowerCase();
    const flags = {
      deprecated,
      unstable: /subject to change|unstable|experimental/.test(text),
      patreon: /patreon/.test(text),
      internal: /internal/.test(text),
    };

    rows.push({
      operationId: String(operationId),
      method: method.toUpperCase(),
      path,
      group: tags[0] ?? "ungrouped",
      tags,
      flags,
      rateLimit: extractRateLimit(text),
      apiCache: extractCache(text),
      siteStrategy: deprecated ? "ignore" : "runtime",
      usedBy: IMPLEMENTED_ENDPOINTS[String(operationId)] ?? [],
      implementationStatus: IMPLEMENTED_ENDPOINTS[String(operationId)] ? "implemented" : "planned",
    });
  }
}

rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const generatedAt = new Date().toISOString();
const payload = {
  schema_version: 1,
  generated_at: generatedAt,
  source: SPEC_URL,
  endpoint_count: rows.length,
  endpoints: rows,
};

await mkdir("docs", { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

const md = [
  "# API Inventory",
  "",
  `Generated from \`${SPEC_URL}\` at ${generatedAt}. Do not edit generated rows by hand.`,
  "",
  `Endpoint count: **${rows.length}**`,
  "",
  "| Method | Path | operationId | Group | Flags | Strategy | Status |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((row) => {
    const flags = Object.entries(row.flags).filter(([, value]) => value).map(([key]) => key).join(", ") || "—";
    return `| ${row.method} | \`${row.path}\` | \`${row.operationId}\` | ${row.group} | ${flags} | ${row.siteStrategy} | ${row.implementationStatus} |`;
  }),
  "",
].join("\n");

await writeFile(OUT_MD, md, "utf8");

function extractRateLimit(text) {
  const ip = text.match(/ip\s*\|\s*([\d,]+)\s*req\s*\/\s*min/i)?.[1];
  const key = text.match(/key\s*\|\s*([\d,]+)\s*req\s*\/\s*min/i)?.[1];
  const global = text.match(/global\s*\|\s*([\d,]+)\s*req\s*\/\s*min/i)?.[1];
  return { ip: ip ? `${ip}req/min` : null, key: key ? `${key}req/min` : null, global: global ? `${global}req/min` : null };
}

function extractCache(text) {
  const match = text.match(/cached for \*\*(\d+)\s+(hour|hours|minute|minutes|day|days)\*\*/i);
  return match ? `${match[1]} ${match[2]}` : null;
}
