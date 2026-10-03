const BASE = 'https://api.deadlock-api.com';

const checks = [
  ['/v1/assets/heroes', 'heroes'],
  ['/v1/assets/items', 'items'],
  ['/v1/assets/ranks', 'ranks'],
];

async function fetchWithRetry(path, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const started = Date.now();
    try {
      const response = await fetch(BASE + path, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      const elapsedMs = Date.now() - started;
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
      }
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`unexpected content-type: ${contentType}`);
      }
      if (!text.trim()) {
        throw new Error('empty response body');
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('response was not valid JSON');
      }
      return { elapsedMs, contentType, parsed };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

for (const [path, label] of checks) {
  const result = await fetchWithRetry(path);
  if (!Array.isArray(result.parsed)) {
    throw new Error(`${label}: expected an array response`);
  }
  console.log(`PASS ${label}: HTTP 200, JSON array, ${result.parsed.length} records, ${result.elapsedMs}ms`);
}

const openApiResponse = await fetchWithRetry('/openapi.json');
const contract = openApiResponse.parsed;
if (contract.openapi !== '3.1.0') {
  throw new Error(`unexpected OpenAPI version: ${contract.openapi}`);
}
const operations = Object.values(contract.paths || {}).reduce(
  (total, pathItem) => total + Object.keys(pathItem || {}).filter((method) =>
    ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method),
  ).length,
  0,
);
const parameters = Object.values(contract.paths || {}).reduce(
  (total, pathItem) =>
    total +
    Object.values(pathItem || {}).reduce(
      (pathTotal, operation) =>
        pathTotal + (Array.isArray(operation?.parameters) ? operation.parameters.length : 0),
      0,
    ) +
    (Array.isArray(pathItem?.parameters) ? pathItem.parameters.length : 0),
  0,
);
const schemas = Object.keys(contract.components?.schemas || {}).length;
if (operations !== 129 || parameters !== 704) {
  throw new Error(`OpenAPI inventory drift: operations=${operations}, parameters=${parameters}, schemas=${schemas}`);
}
console.log(`PASS OpenAPI contract: 3.1.0, ${operations} operations, ${parameters} operation/path parameters, ${schemas} schemas`);


console.log('Deadlock API smoke checks passed.');
