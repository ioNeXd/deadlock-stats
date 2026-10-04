import { getHeroes, getItemsByHeroId } from "../api/assets.js";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i;
const INFERNO_TERMS = ["inferno", "infernus", "hero_infernus", "napalm", "flame_dash", "afterburn", "concussive_combustion"];

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

export function collectInfernoImageCandidates({ hero, items = [] } = {}) {
  const candidates = [];
  collectImageCandidates(hero?.raw ?? hero, "hero", candidates);

  for (const item of Array.isArray(items) ? items : []) {
    const context = JSON.stringify(item).toLowerCase();
    if (INFERNO_TERMS.some(term => context.includes(term))) {
      collectImageCandidates(item?.raw ?? item, "hero_item", candidates);
    }
  }

  // Ability/item responses are already scoped to the hero by the API.
  // Keep all image fields returned there, while hero assets are restricted to
  // the selected hero object itself.
  return dedupeCandidates(candidates);
}

function unwrapCollection(result) {
  return result?.data?.data ?? result?.data ?? result?.raw?.data ?? result?.raw ?? [];
}

function findInfernoHero(heroes) {
  const list = Array.isArray(heroes) ? heroes : [];
  return list.find(hero => {
    const name = String(hero?.name ?? hero?.class_name ?? hero?.raw?.name ?? "").toLowerCase();
    return name === "inferno" || name === "infernus" || name.includes("infernus");
  }) ?? null;
}

export async function loadInfernoImageTest(options = {}) {
  const heroesResult = await getHeroes(options);
  const heroes = unwrapCollection(heroesResult);
  const hero = findInfernoHero(heroes);
  if (!hero) {
    const error = new Error("Inferno/Infernus was not found in /v1/assets/heroes");
    error.status = 404;
    throw error;
  }

  const heroId = hero.hero_id ?? hero.id ?? hero.raw?.hero_id ?? hero.raw?.id;
  let items = [];
  if (heroId !== undefined && heroId !== null) {
    const itemsResult = await getItemsByHeroId(heroId, options);
    items = unwrapCollection(itemsResult);
  }

  const images = collectInfernoImageCandidates({ hero, items });

  return {
    hero,
    images,
    heroEndpoint: "/v1/assets/heroes",
    itemsEndpoint: heroId != null ? "/v1/assets/items/by-hero-id/" + heroId : "",
  };
}
