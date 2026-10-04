import { apiGet } from "../api/client.js";

export function getApiInfo(options = {}) {
  return apiGet("/v1/info", options);
}

export function getApiHealth(options = {}) {
  return apiGet("/v1/info/health", options);
}

const REQUIRED_SERVICES = ["clickhouse", "postgres", "redis"];

function normalizeServices(data) {
  const services = data?.services;
  if (!services || typeof services !== "object") return null;
  return { ...services };
}

function rateLimitHeaders(headers = {}) {
  const entries = Object.entries(headers).reduce((result, [name, value]) => {
    const key = String(name).toLowerCase();
    if (/^(x-)?ratelimit-(limit|remaining|reset)$/.test(key) || key === "ratelimit-limit" || key === "ratelimit-remaining" || key === "ratelimit-reset") {
      result[key] = value;
    }
    return result;
  }, {});
  return entries;
}

export async function probeApiStatus(options = {}) {
  const started = performance.now();
  const requestOptions = {
    ...options,
    cache: false,
    dedupe: false,
    retries: options.retries ?? 0,
  };

  // Health is the authoritative connectivity signal. Do not make the optional
  // /v1/info request delay the status transition when it is slow or unavailable.
  const infoPromise = getApiInfo(requestOptions).catch(error => error);
  const healthResult = await Promise.allSettled([getApiHealth(requestOptions)]);
  const health = healthResult[0].status === "fulfilled" ? healthResult[0].value : null;
  const healthError = healthResult[0].status === "rejected" ? healthResult[0].reason : null;

  // Keep the extra metadata bounded. The status indicator must not wait for a
  // potentially slow /v1/info response after health has already succeeded.
  const infoResult = await Promise.race([
    infoPromise.then(value => ({ value })),
    new Promise(resolve => setTimeout(() => resolve({ value: null }), 750)),
  ]);
  const infoValue = infoResult.value;
  const info = infoValue instanceof Error ? null : infoValue;
  const infoError = infoValue instanceof Error ? infoValue : null;

  if (healthError && (healthError?.code === "ABORTED" || healthError?.name === "AbortError")) {
    throw healthError;
  }

  if (!health) {
    return {
      online: false,
      healthy: false,
      services: null,
      latencyMs: healthError?.latencyMs ?? Math.round(performance.now() - started),
      status: healthError?.status ?? null,
      url: healthError?.url ?? null,
      headers: healthError?.headers ?? {},
      rateLimit: rateLimitHeaders(healthError?.headers ?? {}),
      contentType: null,
      data: null,
      info: info?.data ?? null,
      infoLatencyMs: info?.latencyMs ?? null,
      infoStatus: info?.status ?? null,
      infoUrl: info?.url ?? null,
      error: healthError ?? infoError,
      infoError,
    };
  }

  const services = normalizeServices(health.data);
  const hasCompleteHealth = services
    ? REQUIRED_SERVICES.every(name => typeof services[name] === "boolean")
    : false;
  const healthy = hasCompleteHealth
    ? REQUIRED_SERVICES.every(name => services[name] === true)
    : null;

  return {
    online: true,
    healthy,
    services,
    latencyMs: health.latencyMs ?? Math.round(performance.now() - started),
    status: health.status,
    url: health.url,
    headers: health.headers,
    rateLimit: rateLimitHeaders(health.headers),
    contentType: health.contentType,
    data: health.data,
    info: info?.data ?? null,
    infoLatencyMs: info?.latencyMs ?? null,
    infoStatus: info?.status ?? null,
    infoUrl: info?.url ?? null,
    error: null,
    infoError,
  };
}
