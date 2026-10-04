import { getHeroes, getHero, getHeroByName, getImages, getItemsByHeroId } from "../api/assets.js";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i;

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeImage(value) {
  return IMAGE_EXTENSIONS.test(value) || /(?:^|[/._-])(?:image|icon|portrait|card|hud|minimap|sticker|weapon)(?:[/._-]|$)/i.test(value);
}

function absoluteAssetUrl(value) {
  const text = asText(value);
  if (!text) return "";
  if (/^(?:https?:)?\/\//i.test(text) || /^data:/i.test(text)) return text;
  if (text.startsWith("/")) return "https://api.deadlock-api.com" + text;
  if (/^(?:images|icons|assets)\//i.test(text)) return "https://api.deadlock-api.com/" + text;
  return "";
}

function normalizeTermText(value) {
  return asText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function collectImageCandidates(value, context = "", output = [], seen = new Set()) {
  if (typeof value === "string") {
    const url = absoluteAssetUrl(value);
    if (url && looksLikeImage(value)) output.push({ url, context: context || "asset" });
    return output;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageCandidates(item, context + "[" + index + "]", output, seen));
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    collectImageCandidates(child, context ? context + "." + key : key, output, seen);
  }
  return output;
}

function dedupeCandidates(candidates) {
  const byUrl = new Map();
  for (const candidate of candidates) {
    if (!candidate?.url) continue;
    if (!byUrl.has(candidate.url)) byUrl.set(candidate.url, candidate);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function unwrapCollection(result) {
  return result?.data?.data ?? result?.data ?? result?.raw?.data ?? result?.raw ?? [];
}

function unwrapObject(result) {
  return result?.data?.data ?? result?.data ?? result?.raw?.data ?? result?.raw ?? null;
}

function heroIdOf(hero) {
  return hero?.hero_id ?? hero?.id ?? hero?.raw?.hero_id ?? hero?.raw?.id ?? null;
}

function heroNamesOf(hero) {
  const raw = hero?.raw ?? hero;
  return [...new Set([
    raw?.name,
    raw?.class_name,
    raw?.hero_class_name,
    hero?.name,
    hero?.class_name,
    hero?.hero_class_name,
  ].filter(Boolean).map(normalizeTermText).filter(Boolean))];
}

export function findHero(heroes, selector) {
  const list = Array.isArray(heroes) ? heroes : [];
  const needle = normalizeTermText(selector);
  if (!needle) return null;

  const numeric = /^\d+$/.test(String(selector).trim());
  if (numeric) {
    return list.find(hero => String(heroIdOf(hero)) === String(selector).trim()) ?? null;
  }

  return list.find(hero => heroNamesOf(hero).some(name =>
    name === needle ||
    name === needle.replace(/^hero_/, "") ||
    ("hero_" + name) === needle ||
    name.replace(/^hero_/, "") === needle
  )) ?? null;
}

function registryMatchesHero(candidate, hero) {
  const haystack = normalizeTermText((candidate?.context ?? "") + " " + (candidate?.url ?? ""));
  const names = heroNamesOf(hero).flatMap(name => [name, name.replace(/^hero_/, "")]).filter(Boolean);
  return names.some(name => name.length >= 3 && haystack.includes(name));
}

export function collectHeroImageCandidates({ hero, items = [], imageIndex = null } = {}) {
  const candidates = [];
  collectImageCandidates(hero?.raw ?? hero, "hero", candidates);

  for (const item of Array.isArray(items) ? items : []) {
    collectImageCandidates(item?.raw ?? item, "hero_item", candidates);
  }

  if (imageIndex) {
    const registryCandidates = [];
    collectImageCandidates(imageIndex, "image_registry", registryCandidates);
    registryCandidates
      .filter(candidate => registryMatchesHero(candidate, hero))
      .forEach(candidate => candidates.push({ ...candidate, context: "image_registry." + candidate.context }));
  }

  return dedupeCandidates(candidates);
}

export async function loadHeroImageTest(selector, options = {}) {
  const heroesResult = await getHeroes(options);
  const heroes = unwrapCollection(heroesResult);
  let hero = findHero(heroes, selector);

  if (!hero && /^\d+$/.test(String(selector ?? "").trim())) {
    try {
      hero = unwrapObject(await getHero(Number(selector), options));
    } catch {}
  } else if (!hero && selector) {
    try {
      hero = unwrapObject(await getHeroByName(String(selector), options));
    } catch {}
  }

  if (!hero) {
    const error = new Error("Hero not found in /v1/assets/heroes");
    error.status = 404;
    throw error;
  }

  const heroId = heroIdOf(hero);
  let items = [];
  let imageIndex = null;

  if (heroId !== null) {
    const [itemsResult, imagesResult] = await Promise.all([
      getItemsByHeroId(heroId, options),
      getImages(options),
    ]);
    items = unwrapCollection(itemsResult);
    imageIndex = unwrapObject(imagesResult);
  } else {
    imageIndex = unwrapObject(await getImages(options));
  }

  const images = collectHeroImageCandidates({ hero, items, imageIndex });

  return {
    hero,
    heroes: Array.isArray(heroes) ? heroes : [],
    images,
    heroEndpoint: "/v1/assets/heroes",
    heroByIdEndpoint: heroId !== null ? "/v1/assets/heroes/" + heroId : "",
    heroByNameEndpoint: "/v1/assets/heroes/by-name/{name}",
    itemsEndpoint: heroId !== null ? "/v1/assets/items/by-hero-id/" + heroId : "",
    imagesEndpoint: "/v1/assets/images",
  };
}

// Backward-compatible helper used by the existing test suite.
export function collectInfernoImageCandidates(input = {}) {
  return collectHeroImageCandidates(input);
}

export async function loadInfernoImageTest(options = {}) {
  const heroesResult = await getHeroes(options);
  const heroes = unwrapCollection(heroesResult);
  const hero = findHero(heroes, "Inferno") ?? findHero(heroes, "Infernus");
  if (!hero) {
    const error = new Error("Inferno/Infernus was not found in /v1/assets/heroes");
    error.status = 404;
    throw error;
  }
  return loadHeroImageTest(String(heroIdOf(hero)), options);
}
