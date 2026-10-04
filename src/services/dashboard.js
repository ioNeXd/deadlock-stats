import { getApiInfo } from "./api-status.js";
import { getPatches, getBigPatchDays } from "../api/patches.js";
import { getGameStats } from "../api/analytics.js";

function asArray(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
}

function sortByPublicationDate(items) {
  return [...items]
    .filter(item => item && typeof item === "object")
    .sort((a, b) => Date.parse(b.pub_date ?? 0) - Date.parse(a.pub_date ?? 0));
}

function normalizeLatestPatch(payload) {
  return sortByPublicationDate(asArray(payload))[0] ?? null;
}

function calendarDate(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

function normalizeBigPatchDays(payload) {
  return asArray(payload)
    .map(value => calendarDate(value))
    .filter(Boolean)
    .sort()
    .reverse();
}

export function normalizeMajorPatch(patchesPayload, bigPatchDaysPayload, now = Date.now()) {
  const patches = sortByPublicationDate(asArray(patchesPayload));
  const bigDays = normalizeBigPatchDays(bigPatchDaysPayload);
  const today = new Date(now).toISOString().slice(0, 10);
  const latestBigDay = bigDays.find(day => day <= today);
  if (!latestBigDay) return null;

  const forumPatches = patches.filter(patch => patch?.source === "forum");
  const exactMatch = forumPatches.find(patch => calendarDate(patch.pub_date) === latestBigDay);
  if (exactMatch) return exactMatch;

  return forumPatches
    .filter(patch => {
      const date = calendarDate(patch.pub_date);
      return date && date < latestBigDay;
    })
    .sort((a, b) => Math.abs(Date.parse(b.pub_date) - Date.parse(latestBigDay)) - Math.abs(Date.parse(a.pub_date) - Date.parse(latestBigDay)))[0] ?? null;
}

export async function getDashboardCoreSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  return {
    info: await getApiInfo({ ...requestOptions, signal }),
  };
}

export async function getDashboardPatchSnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const [patches, bigPatchDays] = await Promise.all([
    getPatches({ ...requestOptions, signal }),
    getBigPatchDays({ ...requestOptions, signal }),
  ]);
  return {
    patches,
    bigPatchDays,
    latestPatch: normalizeLatestPatch(patches?.data),
    latestMajorPatch: normalizeMajorPatch(patches?.data, bigPatchDays?.data),
  };
}

export async function getDashboardActivitySnapshot(options = {}) {
  const { signal, ...requestOptions } = options;
  const result = await getGameStats({
    ...requestOptions,
    bucket: "start_time_day",
    signal,
  });
  return {
    activity: Array.isArray(result?.data) ? result.data : [],
    raw: result,
  };
}

export async function getDashboardSnapshot(options = {}) {
  const [core, patch] = await Promise.all([
    getDashboardCoreSnapshot(options),
    getDashboardPatchSnapshot(options),
  ]);
  return { ...core, ...patch };
}
