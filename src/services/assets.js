import { getHeroes, getHero, getHeroByName, getRanks, getRank, getItems, getItemsByHeroId, getItemsBySlotType, getItemsByType, getItem, getRankSubrankImage } from "../api/assets.js";
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

export async function findHeroByName(name, options = {}) {
  return withNormalized(await getHeroByName(name, options), normalizeHero);
}

export async function listRanks(options = {}) {
  return withNormalized(await getRanks(options), normalizeCollection);
}

export async function fetchRank(tier, options = {}) {
  return withNormalized(await getRank(tier, options), normalizeRank);
}

export async function listItems(options = {}) {
  return withNormalized(await getItems(options), normalizeCollection);
}

export async function listItemsByHeroId(heroId, options = {}) {
  return withNormalized(await getItemsByHeroId(heroId, options), normalizeCollection);
}

export async function listItemsBySlotType(slotType, options = {}) {
  return withNormalized(await getItemsBySlotType(slotType, options), normalizeCollection);
}

export async function listItemsByType(type, options = {}) {
  return withNormalized(await getItemsByType(type, options), normalizeCollection);
}

export async function fetchItem(idOrClassName, options = {}) {
  return withNormalized(await getItem(idOrClassName, options), normalizeItem);
}

export async function fetchRankSubrankImage(tier, subrank, options = {}) {
  return getRankSubrankImage(tier, subrank, options);
}
