const BASE = process.env.DEADLOCK_API_BASE || "https://api.deadlock-api.com";
const key = process.env.DEADLOCK_API_KEY;
if (!key) {
  console.log("SKIP protected API smoke: DEADLOCK_API_KEY is not configured.");
  process.exit(0);
}

const contract = await (await fetch(`${BASE}/openapi.json`, { headers: { Accept: "application/json" } })).json();
const secured = [];
for (const [path, item] of Object.entries(contract.paths || {})) {
  for (const [method, operation] of Object.entries(item || {})) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    if (operation?.security?.length || contract.security?.length) {
      secured.push({ path, method, operation });
    }
  }
}
if (!secured.length) {
  console.log("SKIP protected API smoke: current OpenAPI exposes no secured operation.");
  process.exit(0);
}

const preferred = secured.find(item => item.method === "get" && !item.operation.deprecated) || secured[0];
const url = new URL(preferred.path.replace(/\{[^}]+\}/g, "0"), BASE);
const response = await fetch(url, {
  headers: { Accept: "application/json", "X-API-KEY": key },
});
const body = await response.text();

if (response.status === 401 || response.status === 403) {
  throw new Error(`protected endpoint rejected configured credential: ${response.status} ${preferred.method.toUpperCase()} ${preferred.path}`);
}
if (!response.ok) {
  throw new Error(`protected endpoint smoke failed: ${response.status} ${preferred.method.toUpperCase()} ${preferred.path}: ${body.slice(0, 300)}`);
}
console.log(`PASS protected API: ${preferred.method.toUpperCase()} ${preferred.path} HTTP ${response.status}`);
