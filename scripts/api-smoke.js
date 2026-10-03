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

console.log('Deadlock API smoke checks passed.');
