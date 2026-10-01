import { getHeroes, getRanks, getItems } from "../api/assets.js";
import { normalizeCollection, normalizeHero, normalizeRank, normalizeItem } from "../adapters/assets.js";

function withNormalized(result, normalize) {
  const raw = result?.data;
  const normalized = normalize(raw);
  return { ...result, raw, data: normalized };
}

export async function listHeroes(options = {}) {
  return withNormalized(await getHeroes(options), normalizeCollection);
}

export async function getHero(id, options = {}) {
  return withNormalized(
    await getHeroes({
      ...options,
      path: `/v1/assets/heroes/${encodeURIComponent(id)}`,
    }),
    normalizeHero,
  );
}

export async function listRanks(options = {}) {
  return withNormalized(await getRanks(options), normalizeCollection);
}

export async function listItems(options = {}) {
  return withNormalized(await getItems(options), normalizeCollection);
}

export function normalizeHeroEntity(entity) {
  return normalizeHero(entity);
}

export function normalizeRankEntity(entity) {
  return normalizeRank(entity);
}

export function normalizeItemEntity(entity) {
  return normalizeItem(entity);
}
