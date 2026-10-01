const API_BASE_URL = "https://api.deadlock-api.com";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 10_000;
const MAX_CACHE_ENTRIES = 200;

const cache = new Map();
const inFlight = new Map();

export class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "ApiError";
    Object.assign(this, meta);
  }
}

function normalizeQuery(query) {
  if (!query) return "";

  const params = new URLSearchParams();

  if (query instanceof URLSearchParams) {
    for (const [key, value] of query.entries()) params.append(key, value);
  } else {
    for (const key of Object.keys(query).sort()) {
      const value = query[key];
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) params.append(key, String(item));
        }
      } else {
        params.append(key, String(value));
      }
    }
  }

  return params.toString();
}

function normalizePath(path, query) {
  const url = new URL(path, API_BASE_URL);
  const existing = new URLSearchParams(url.search);

  for (const [key, value] of new URLSearchParams(normalizeQuery(query))) {
    existing.append(key, value);
  }

  const sorted = [...existing.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(sorted).toString();
  return url;
}

function cacheKey(method, url, body) {
  return JSON.stringify({
    method: method.toUpperCase(),
    path: url.pathname,
    query: [...url.searchParams.entries()],
    body: body ?? null,
  });
}

function parseRetryAfter(value) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - Date.now());

  return null;
}

function retryDelay(attempt, retryAfter) {
  if (retryAfter !== null) return Math.min(retryAfter, MAX_RETRY_DELAY_MS);

  const exponential = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

function shouldRetry(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function contentTypeOf(response) {
  return response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
}

async function parseResponse(response, responseType = "auto") {
  const contentType = contentTypeOf(response);

  if (responseType === "response") return response;
  if (responseType === "arrayBuffer" || contentType === "application/octet-stream") {
    return response.arrayBuffer();
  }
  if (responseType === "text" || contentType === "text/plain" || contentType === "text/html") {
    return response.text();
  }
  if (responseType === "stream" || contentType === "text/event-stream") {
    return response.body;
  }
  if (responseType === "blob" || contentType.startsWith("image/")) {
    return response.blob();
  }
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createTimeoutSignal(signal, timeoutMs) {
  const controller = new AbortController();
  let timer;

  const abort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }

  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

async function request(path, {
  method = "GET",
  query,
  body,
  headers = {},
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  cache: useCache = method === "GET",
  dedupe = method === "GET",
  responseType = "auto",
  apiKey,
  authorization,
} = {}) {
  const upperMethod = method.toUpperCase();
  const effectiveUseCache = useCache === undefined ? upperMethod === "GET" : useCache;
  const effectiveDedupe = dedupe === undefined ? upperMethod === "GET" : dedupe;
  const url = normalizePath(path, query);
  const requestBody = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  const key = cacheKey(upperMethod, url, requestBody);
  const now = Date.now();

  if (effectiveUseCache) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
    if (cached) cache.delete(key);
  }

  if (effectiveDedupe && inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const timeout = createTimeoutSignal(signal, timeoutMs);
      const started = performance.now();

      try {
        const requestHeaders = new Headers(headers);
        if (!requestHeaders.has("Accept")) {
          requestHeaders.set(
            "Accept",
            responseType === "stream"
              ? "text/event-stream"
              : responseType === "blob" || responseType === "arrayBuffer"
                ? "*/*"
                : "application/json",
          );
        }

        if (body != null && !requestHeaders.has("Content-Type") && typeof body !== "string") {
          requestHeaders.set("Content-Type", "application/json");
        }
        if (apiKey) requestHeaders.set("X-API-KEY", apiKey);
        if (authorization) requestHeaders.set("Authorization", authorization);

        const response = await fetch(url, {
          method: upperMethod,
          headers: requestHeaders,
          body: requestBody,
          signal: timeout.signal,
        });

        const latencyMs = Math.round(performance.now() - started);
        const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));

        if (!response.ok) {
          const responseText = await response.clone().text().catch(() => "");
          const error = new ApiError(
            `Deadlock API returned ${response.status} ${response.statusText}`,
            {
              status: response.status,
              statusText: response.statusText,
              url: url.toString(),
              method: upperMethod,
              latencyMs,
              retryAfterMs,
              responseText,
              headers: Object.fromEntries(response.headers.entries()),
              attempt,
            },
          );

          if (attempt < retries && shouldRetry(response.status)) {
            await new Promise(resolve => setTimeout(resolve, retryDelay(attempt, retryAfterMs)));
            continue;
          }

          throw error;
        }

        const value = await parseResponse(response, responseType);
        const result = {
          data: value,
          latencyMs,
          status: response.status,
          url: url.toString(),
          headers: Object.fromEntries(response.headers.entries()),
          contentType: contentTypeOf(response),
        };

        if (effectiveUseCache && cacheTtlMs > 0) {
          cache.set(key, { expiresAt: Date.now() + cacheTtlMs, value: result });
    while (cache.size > MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
        }

        return result;
      } catch (error) {
        lastError = error;

        if (error?.name === "AbortError" || error?.name === "TimeoutError") {
          throw new ApiError(error.message || "Request aborted", {
            cause: error,
            url: url.toString(),
            method: upperMethod,
            code: error.name === "TimeoutError" ? "TIMEOUT" : "ABORTED",
          });
        }

        if (error instanceof ApiError) throw error;

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay(attempt, null)));
          continue;
        }

        throw new ApiError(error?.message || "Network request failed", {
          cause: error,
          url: url.toString(),
          method: upperMethod,
        });
      } finally {
        timeout.cleanup();
      }
    }

    throw lastError;
  })();

  if (effectiveDedupe) inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }
}

export function apiRequest(path, options = {}) {
  return request(path, options);
}

export function apiGet(path, options = {}) {
  return request(path, {
    ...options,
    method: "GET",
  });
}

export function clearApiCache() {
  cache.clear();
}

export function invalidateApiCache(path, query) {
  const url = normalizePath(path, query);
  const targetQuery = query === undefined ? null : [...url.searchParams.entries()];

  for (const key of cache.keys()) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.method !== "GET" || parsed.path !== url.pathname) continue;
      if (targetQuery === null || JSON.stringify(parsed.query) === JSON.stringify(targetQuery)) {
        cache.delete(key);
      }
    } catch {
      cache.delete(key);
    }
  }
}

export { API_BASE_URL };
