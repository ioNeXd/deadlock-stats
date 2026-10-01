import { apiGet } from "../api/client.js";

export function getApiInfo(options = {}) {
  return apiGet("/v1/info", options);
}

export function getApiHealth(options = {}) {
  return apiGet("/v1/info/health", options);
}

export async function probeApiStatus(options = {}) {
  const started = performance.now();

  try {
    const result = await getApiHealth({
      cache: false,
      dedupe: false,
      retries: options.retries ?? 0,
      ...options,
    });

    return {
      online: true,
      latencyMs: result.latencyMs ?? Math.round(performance.now() - started),
      status: result.status,
      url: result.url,
      headers: result.headers,
      contentType: result.contentType,
      data: result.data,
      error: null,
    };
  } catch (error) {
    return {
      online: false,
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
