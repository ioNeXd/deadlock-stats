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

export async function probeApiStatus(options = {}) {
  const started = performance.now();

  try {
    const result = await getApiHealth({
      ...options,
      cache: false,
      dedupe: false,
      retries: options.retries ?? 0,
    });

    const services = normalizeServices(result.data);
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
      latencyMs: result.latencyMs ?? Math.round(performance.now() - started),
      status: result.status,
      url: result.url,
      headers: result.headers,
      contentType: result.contentType,
      data: result.data,
      error: null,
    };
  } catch (error) {
    if (error?.code === "ABORTED" || error?.name === "AbortError") throw error;

    return {
      online: false,
      healthy: false,
      services: null,
      latencyMs: error.latencyMs ?? Math.round(performance.now() - started),
      status: error.status ?? null,
      url: error.url ?? null,
      headers: error.headers ?? {},
      contentType: null,
      data: null,
      error,
    };
  }
}
