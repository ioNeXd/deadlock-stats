import { getPatches } from "../api/patches.js";

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

export function normalizePatch(patch = {}) {
  const category = patch?.category;
  return {
    title: patch?.title ?? null,
    pubDate: patch?.pub_date ?? null,
    link: patch?.link ?? null,
    guid: typeof patch?.guid === "object" ? patch.guid?.text ?? null : patch?.guid ?? null,
    author: patch?.author ?? null,
    category: typeof category === "object" ? category?.text ?? null : category ?? null,
    creator: patch?.dc_creator ?? null,
    content: patch?.content_encoded ?? null,
    comments: patch?.slash_comments ?? null,
    raw: patch,
  };
}

export function buildPatchHistoryViewModel(result) {
  const patches = asArray(result).map(normalizePatch).filter(patch => patch.title || patch.pubDate || patch.link);
  patches.sort((a, b) => {
    const aTime = Date.parse(a.pubDate ?? "") || 0;
    const bTime = Date.parse(b.pubDate ?? "") || 0;
    return bTime - aTime;
  });

  return {
    patches,
    total: patches.length,
    latest: patches[0] ?? null,
    raw: result ?? null,
  };
}

export async function loadPatchHistory(options = {}) {
  const result = await getPatches(options);
  return {
    ...result,
    ...buildPatchHistoryViewModel(result?.data ?? result),
  };
}
