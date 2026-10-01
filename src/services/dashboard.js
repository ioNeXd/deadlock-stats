import { getApiInfo } from "./api-status.js";
import { getPatches } from "../api/patches.js";

function asArray(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
}

function normalizeLatestPatch(payload) {
  const items = asArray(payload);
  if (!items.length) return null;

  return [...items]
    .filter(item => item && typeof item === "object")
    .sort((a, b) => Date.parse(b.pub_date ?? 0) - Date.parse(a.pub_date ?? 0))[0] ?? null;
}

export async function getDashboardSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const [infoResult, patchesResult] = await Promise.all([
    getApiInfo({ ...requestOptions, signal }),
    getPatches({ ...requestOptions, signal }),
  ]);

  return {
    info: infoResult,
    patches: patchesResult,
    latestPatch: normalizeLatestPatch(patchesResult?.data),
  };
}
