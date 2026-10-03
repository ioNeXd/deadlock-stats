import {
  createCustomMatch,
  leaveCustomMatch,
  readyCustomMatch,
  startCustomMatch,
  unreadyCustomMatch,
  getCustomMatchId,
  getLiveQuery,
  submitDemoQuery,
  getDemoQueryStatus,
  getDemoSchema,
  getLiveUrls,
  ingestLiveUrls,
} from "../api/matches.js";

export function normalizeDemoStatus(result) {
  const data = result?.data && typeof result.data === "object" ? result.data : result;
  return {
    jobId: data?.job_id ?? null,
    status: data?.status ?? null,
    matchId: data?.match_id ?? null,
    format: data?.format ?? null,
    estimatedWaitSeconds: data?.estimated_wait_seconds ?? null,
    resultUrl: data?.result_url ?? null,
    error: data?.error ?? null,
    raw: data,
  };
}

export function normalizeLiveUrls(result) {
  const data = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
  return data.map(row => ({
    matchId: row?.match_id ?? null,
    lobbyId: row?.lobby_id ?? null,
    broadcastUrl: row?.broadcast_url ?? null,
    startedAt: row?.started_at ?? null,
    updatedAt: row?.updated_at ?? null,
    raw: row,
  }));
}

export function buildDemoQueryBody({ matchId, query, format } = {}) {
  const id = Number(matchId);
  if (!Number.isInteger(id) || id < 0) throw new RangeError("matchId must be a non-negative integer");
  if (typeof query !== "string" || !query.trim()) throw new TypeError("query must be a non-empty string");
  const body = { match_id: id, query: query.trim() };
  if (format) body.format = format;
  return body;
}

export function buildCustomMatchBody(values = {}) {
  const body = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") body[key] = value;
  }
  return body;
}

export async function loadDemoSchema(matchId, options = {}) {
  return getDemoSchema(matchId === "" ? undefined : matchId, options);
}

export async function submitDemoQueryFromForm(values, options = {}) {
  return submitDemoQuery(buildDemoQueryBody(values), options);
}

export function getDemoQueryStatusSnapshot(jobId, options = {}) {
  return getDemoQueryStatus(jobId, options);
}

export function loadLiveUrls(options = {}) {
  return getLiveUrls(options);
}

export function ingestLiveUrlsFromForm(values, options = {}) {
  const rows = Array.isArray(values) ? values : [values];
  return ingestLiveUrls(rows, options);
}

export function runLiveQuery(options = {}) {
  return getLiveQuery(options);
}

export function createCustomMatchFromForm(values, options = {}) {
  return createCustomMatch(buildCustomMatchBody(values), options);
}

export function customMatchAction(action, lobbyId, options = {}) {
  const actions = { leave: leaveCustomMatch, ready: readyCustomMatch, start: startCustomMatch, unready: unreadyCustomMatch };
  const loader = actions[action];
  if (!loader) throw new RangeError("Unsupported custom match action");
  return loader(lobbyId, options);
}

export function loadCustomMatchId(partyId, options = {}) {
  return getCustomMatchId(partyId, options);
}
