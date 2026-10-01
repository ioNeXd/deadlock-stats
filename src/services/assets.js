import { getHeroes, getHero, getRanks, getItems } from "../api/assets.js";
import { normalizeCollection, normalizeHero, normalizeRank, normalizeItem } from "../adapters/assets.js";

function withNormalized(result, normalize) {
  const raw = result?.data;
  return { ...result, raw, data: normalize(raw) };
}

export async function listHeroes(options = {}) {
  return withNormalized(await getHeroes(options), normalizeCollection);
}

export async function fetchHero(heroId, options = {}) {
  return withNormalized(await getHero(heroId, options), normalizeHero);
}

export async function listRanks(options = {}) {
  return withNormalized(await getRanks(options), normalizeCollection);
}

export async function listItems(options = {}) {
  return withNormalized(await getItems(options), normalizeCollection);
}
