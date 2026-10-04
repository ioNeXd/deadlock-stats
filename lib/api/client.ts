import { API_BASE } from '@/lib/config'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class RateLimitError extends ApiError {
  constructor(public retryAfterSeconds: number) {
    super(429, 'Rate limited by the Deadlock API')
    this.name = 'RateLimitError'
  }
}

export class NotFoundError extends ApiError {
  constructor(path: string) {
    super(404, `Not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

/** Deterministic: keys sorted, empty values dropped, so {a,b} and {b,a} share a cache key. */
export function serializeParams(params: QueryParams) {
  const search = new URLSearchParams()
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  return search.toString()
}

const inFlight = new Map<string, Promise<unknown>>()

export function apiGet<T>(path: string, params: QueryParams = {}, init?: RequestInit): Promise<T> {
  const query = serializeParams(params)
  const url = `${API_BASE}${path}${query ? `?${query}` : ''}`
  const pending = inFlight.get(url)
  if (pending) return pending as Promise<T>

  const request = fetch(url, { ...init, headers: { accept: 'application/json', ...init?.headers } })
    .then(async (res) => {
      if (res.status === 429) throw new RateLimitError(Number(res.headers.get('retry-after') ?? 0))
      if (res.status === 404) throw new NotFoundError(path)
      if (!res.ok) throw new ApiError(res.status, `Deadlock API ${res.status} on ${path}`)
      return (await res.json()) as T
    })
    .finally(() => inFlight.delete(url))

  inFlight.set(url, request)
  return request
}
