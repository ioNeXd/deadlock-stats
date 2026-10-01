import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

function withAssetQuery(options = {}, query = {}) {
  const existing = queryToObject(options.query);

  const merged = Object.fromEntries(
    Object.entries({ ...existing, ...query }).filter(([, value]) => value !== undefined && value !== null),
  );

  return { ...options, query: merged };
}

function versionedOptions(options = {}, extra = {}) {
  return withAssetQuery(options, {
    language: extra.language,
    client_version: extra.clientVersion ?? extra.client_version,
    ...extra.query,
  });
}

export function getHeroes({ language, clientVersion, onlyActive, ...options } = {}) {
  return apiGet("/v1/assets/heroes", versionedOptions(options, {
    language,
    clientVersion,
    query: { only_active: onlyActive },
  }));
}

export function getHero(heroId, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/heroes/${encodeURIComponent(heroId)}`, versionedOptions(options, { language, clientVersion }));
}

export function getHeroByName(name, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/heroes/by-name/${encodeURIComponent(name)}`, versionedOptions(options, { language, clientVersion }));
}

export function getItems({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/items", versionedOptions(options, { language, clientVersion }));
}

export function getItemsByHeroId(heroId, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/items/by-hero-id/${encodeURIComponent(heroId)}`, versionedOptions(options, { language, clientVersion }));
}

export function getItemsBySlotType(slotType, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/items/by-slot-type/${encodeURIComponent(slotType)}`, versionedOptions(options, { language, clientVersion }));
}

export function getItemsByType(type, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/items/by-type/${encodeURIComponent(type)}`, versionedOptions(options, { language, clientVersion }));
}

export function getItem(idOrClassName, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/items/${encodeURIComponent(idOrClassName)}`, versionedOptions(options, { language, clientVersion }));
}

export function getRanks({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/ranks", versionedOptions(options, { language, clientVersion }));
}

export function getRank(tier, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/ranks/${encodeURIComponent(tier)}`, versionedOptions(options, { language, clientVersion }));
}

export function getRankSubrankImage(tier, subrank, { format = "png", responseType, ...options } = {}) {
  if (format !== "png" && format !== "webp") throw new RangeError("format must be png or webp");
  return apiGet(
    `/v1/assets/ranks/${encodeURIComponent(tier)}/${encodeURIComponent(subrank)}/image`,
    {
      ...withAssetQuery(options, { format }),
      responseType: responseType ?? "blob",
    },
  );
}

export function getAccolades({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/accolades", versionedOptions(options, { language, clientVersion }));
}

export function getAccoladeByName(name, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/accolades/by-name/${encodeURIComponent(name)}`, versionedOptions(options, { language, clientVersion }));
}

export function getAccolade(accoladeId, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/accolades/${encodeURIComponent(accoladeId)}`, versionedOptions(options, { language, clientVersion }));
}

export function getBuildTags({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/build-tags", versionedOptions(options, { language, clientVersion }));
}

export function getBuildTagByName(name, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/build-tags/by-name/${encodeURIComponent(name)}`, versionedOptions(options, { language, clientVersion }));
}

export function getBuildTag(buildTagId, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/build-tags/${encodeURIComponent(buildTagId)}`, versionedOptions(options, { language, clientVersion }));
}

export function getClientVersions(options = {}) {
  return apiGet("/v1/assets/client-versions", options);
}

export function getColors({ clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/colors", versionedOptions(options, { clientVersion }));
}

export function getFonts(options = {}) {
  return apiGet("/v1/assets/fonts", options);
}

export function getIcons(options = {}) {
  return apiGet("/v1/assets/icons", options);
}

export function getImages(options = {}) {
  return apiGet("/v1/assets/images", options);
}

export function getSounds(options = {}) {
  return apiGet("/v1/assets/sounds", options);
}

export function getGenericData({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/generic-data", versionedOptions(options, { language, clientVersion }));
}

export function getMap({ clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/map", versionedOptions(options, { clientVersion }));
}

export function getMiscEntities({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/misc-entities", versionedOptions(options, { language, clientVersion }));
}

export function getMiscEntity(idOrClassname, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/misc-entities/${encodeURIComponent(idOrClassname)}`, versionedOptions(options, { language, clientVersion }));
}

export function getModifiers({ clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/modifiers", versionedOptions(options, { clientVersion }));
}

export function getModifier(idOrClassname, { clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/modifiers/${encodeURIComponent(idOrClassname)}`, versionedOptions(options, { clientVersion }));
}

export function getNpcUnits({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/npc-units", versionedOptions(options, { language, clientVersion }));
}

export function getNpcUnit(idOrClassname, { language, clientVersion, ...options } = {}) {
  return apiGet(`/v1/assets/npc-units/${encodeURIComponent(idOrClassname)}`, versionedOptions(options, { language, clientVersion }));
}

export function getRankedSeasons({ language, clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/ranked-seasons", versionedOptions(options, { language, clientVersion }));
}

export function getSteamInfo({ clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/steam-info", versionedOptions(options, { clientVersion }));
}

export function getAllSteamInfo(options = {}) {
  return apiGet("/v1/assets/steam-info/all", options);
}

export function getLootTables({ clientVersion, ...options } = {}) {
  return apiGet("/v1/assets/loot-tables", versionedOptions(options, { clientVersion }));
}
