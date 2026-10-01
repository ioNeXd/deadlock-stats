import { searchBuilds, fetchBuildsByAuthor, fetchBuild } from "../api/builds.js";

function normalizeBuilds(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function withBuilds(result) {
  const raw = result?.data;
  return { ...result, raw, data: normalizeBuilds(raw) };
}

function withBuild(result) {
  return { ...result, raw: result?.data, data: result?.data ?? null };
}

export async function listBuilds(options = {}) {
  return withBuilds(await searchBuilds(options));
}

export async function listBuildsByAuthor(accountId, options = {}) {
  return withBuilds(await fetchBuildsByAuthor(accountId, options));
}

export async function getBuild(heroId, buildId, options = {}) {
  return withBuild(await fetchBuild(heroId, buildId, options));
}
