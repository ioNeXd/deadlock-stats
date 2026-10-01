import {
  getHeroes, getHero, getHeroByName,
  getRanks, getRank, getRankSubrankImage,
  getItems, getItemsByHeroId, getItemsBySlotType, getItemsByType, getItem,
  getAccolades, getAccoladeByName, getAccolade,
  getBuildTags, getBuildTagByName, getBuildTag,
  getClientVersions, getColors, getFonts, getIcons, getImages, getSounds,
  getGenericData, getMap,
  getMiscEntities, getMiscEntity,
  getModifiers, getModifier,
  getNpcUnits, getNpcUnit,
  getRankedSeasons,
  getSteamInfo, getAllSteamInfo,
  getLootTables,
} from "../api/assets.js";
import { normalizeAsset, normalizeCollection, normalizeHero, normalizeRank, normalizeItem, normalizeMap } from "../adapters/assets.js";

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

export async function fetchRankSubrankImage(tier, subrank, options = {}) {
  return getRankSubrankImage(tier, subrank, options);
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

export async function listAccolades(options = {}) {
  return withNormalized(await getAccolades(options), normalizeCollection);
}

export async function fetchAccoladeByName(name, options = {}) {
  return withNormalized(await getAccoladeByName(name, options), normalizeAsset);
}

export async function fetchAccolade(accoladeId, options = {}) {
  return withNormalized(await getAccolade(accoladeId, options), normalizeAsset);
}

export async function listBuildTags(options = {}) {
  return withNormalized(await getBuildTags(options), normalizeCollection);
}

export async function fetchBuildTagByName(name, options = {}) {
  return withNormalized(await getBuildTagByName(name, options), normalizeAsset);
}

export async function fetchBuildTag(buildTagId, options = {}) {
  return withNormalized(await getBuildTag(buildTagId, options), normalizeAsset);
}

export async function listClientVersions(options = {}) {
  return withNormalized(await getClientVersions(options), normalizeAsset);
}

export async function listColors(options = {}) {
  return withNormalized(await getColors(options), normalizeAsset);
}

export async function listFonts(options = {}) {
  return withNormalized(await getFonts(options), normalizeAsset);
}

export async function listIcons(options = {}) {
  return withNormalized(await getIcons(options), normalizeAsset);
}

export async function listImages(options = {}) {
  return withNormalized(await getImages(options), normalizeAsset);
}

export async function listSounds(options = {}) {
  return withNormalized(await getSounds(options), normalizeAsset);
}

export async function fetchGenericData(options = {}) {
  return withNormalized(await getGenericData(options), normalizeAsset);
}

export async function fetchMap(options = {}) {
  return withNormalized(await getMap(options), normalizeMap);
}

export async function listMiscEntities(options = {}) {
  return withNormalized(await getMiscEntities(options), normalizeCollection);
}

export async function fetchMiscEntity(idOrClassname, options = {}) {
  return withNormalized(await getMiscEntity(idOrClassname, options), normalizeAsset);
}

export async function listModifiers(options = {}) {
  return withNormalized(await getModifiers(options), normalizeCollection);
}

export async function fetchModifier(idOrClassname, options = {}) {
  return withNormalized(await getModifier(idOrClassname, options), normalizeAsset);
}

export async function listNpcUnits(options = {}) {
  return withNormalized(await getNpcUnits(options), normalizeCollection);
}

export async function fetchNpcUnit(idOrClassname, options = {}) {
  return withNormalized(await getNpcUnit(idOrClassname, options), normalizeAsset);
}

export async function listRankedSeasons(options = {}) {
  return withNormalized(await getRankedSeasons(options), normalizeCollection);
}

export async function fetchSteamInfo(options = {}) {
  return withNormalized(await getSteamInfo(options), normalizeAsset);
}

export async function listSteamInfo(options = {}) {
  return withNormalized(await getAllSteamInfo(options), normalizeCollection);
}

export async function listLootTables(options = {}) {
  return withNormalized(await getLootTables(options), normalizeAsset);
}
