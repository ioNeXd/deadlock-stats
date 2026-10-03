const BASE = process.env.DEADLOCK_API_BASE || "https://api.deadlock-api.com";
const response = await fetch(`${BASE}/openapi.json`, { headers: { Accept: "application/json" } });
if (!response.ok) throw new Error(`OpenAPI fetch failed: ${response.status}`);
const contract = await response.json();

const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
const operations = [];
for (const [path, item] of Object.entries(contract.paths || {})) {
  for (const [method, operation] of Object.entries(item || {})) {
    if (!methods.has(method)) continue;
    operations.push({ path, method: method.toUpperCase(), operation });
  }
}

const classifications = JSON.parse(await (await import("node:fs/promises")).readFile(
  new URL("../docs/api-capability-matrix.json", import.meta.url),
  "utf8",
));
const inventory = classifications.operation_classifications || classifications.operations || [];
const known = new Map(
  inventory.map(operation => [
    `${operation.method} ${operation.path}`,
    operation,
  ]),
);

const liveKeys = new Set(operations.map(operation => `${operation.method} ${operation.path}`));
const missing = operations
  .filter(operation => !known.has(`${operation.method} ${operation.path}`))
  .map(operation => `${operation.method} ${operation.path}`);
const stale = [...known.keys()].filter(key => !liveKeys.has(key));
if (missing.length || stale.length) {
  const details = [
    `coverage classification drift: missing=${missing.length} stale=${stale.length}`,
    missing.length ? `missing: ${missing.join(" | ")}` : "",
    stale.length ? `stale: ${stale.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
  throw new Error(details);
}

const counts = {};
for (const operation of operations) {
  const classification = known.get(`${operation.method} ${operation.path}`).classification;
  counts[classification] = (counts[classification] || 0) + 1;
}
console.log(`PASS operation coverage matrix: ${operations.length} live operations`);
console.log(JSON.stringify({ counts, missing, stale }, null, 2));

const executable = operations.filter(({ method, operation }) =>
  method === "GET" &&
  !operation.deprecated &&
  !(known.get(`${method} ${operation.path}`)?.classification === "INTERNAL")
);
console.log(`INFO executable public GET candidates: ${executable.length}; not invoked automatically to avoid unsafe/high-cost operations.`);
