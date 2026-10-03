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

  const [healthResult, infoResult] = await Promise.allSettled([
    getApiHealth(requestOptions),
    getApiInfo(requestOptions),
  ]);

  const health = healthResult.status === "fulfilled" ? healthResult.value : null;
  const healthError = healthResult.status === "rejected" ? healthResult.reason : null;
  const info = infoResult.status === "fulfilled" ? infoResult.value : null;
  const infoError = infoResult.status === "rejected" ? infoResult.reason : null;

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
