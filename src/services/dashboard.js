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

export async function getDashboardCoreSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  return {
    info: await getApiInfo({ ...requestOptions, signal }),
  };
}

export async function getDashboardPatchSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const patches = await getPatches({ ...requestOptions, signal });
  return {
    patches,
    latestPatch: normalizeLatestPatch(patches?.data),
  };
}

export async function getDashboardSnapshot(options = {}) {
  const [core, patch] = await Promise.all([
    getDashboardCoreSnapshot(options),
    getDashboardPatchSnapshot(options),
  ]);
  return { ...core, ...patch };
}
