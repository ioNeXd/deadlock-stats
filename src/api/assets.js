import { apiGet } from "./client.js";

export function getHeroes(options = {}) {
  return apiGet("/v1/assets/heroes", options);
}

export function getHero(heroId, options = {}) {
  return apiGet(`/v1/assets/heroes/${encodeURIComponent(heroId)}`, options);
}

export function getHeroByName(name, options = {}) {
  return apiGet(`/v1/assets/heroes/by-name/${encodeURIComponent(name)}`, options);
}

export function getRanks(options = {}) {
  return apiGet("/v1/assets/ranks", options);
}

export function getItems(options = {}) {
  return apiGet("/v1/assets/items", options);
}

export function getItemsByHeroId(heroId, options = {}) {
  return apiGet(`/v1/assets/items/by-hero-id/${encodeURIComponent(heroId)}`, options);
}

export function getItemsBySlotType(slotType, options = {}) {
  return apiGet(`/v1/assets/items/by-slot-type/${encodeURIComponent(slotType)}`, options);
}

export function getItemsByType(type, options = {}) {
  return apiGet(`/v1/assets/items/by-type/${encodeURIComponent(type)}`, options);
}

export function getItem(idOrClassName, options = {}) {
  return apiGet(`/v1/assets/items/${encodeURIComponent(idOrClassName)}`, options);
}

export function getRank(tier, options = {}) {
  return apiGet(`/v1/assets/ranks/${encodeURIComponent(tier)}`, options);
}

export function getRankSubrankImage(tier, subrank, options = {}) {
  return apiGet(`/v1/assets/ranks/${encodeURIComponent(tier)}/${encodeURIComponent(subrank)}/image`, {
    ...options,
    responseType: options.responseType ?? "blob",
  });
}
