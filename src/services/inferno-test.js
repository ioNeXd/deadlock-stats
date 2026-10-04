import { findHeroByName, listImages } from "./assets.js";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i;
const INFERNO_TERMS = [
  "inferno",
  "infernus",
  "hero_infernus",
  "napalm",
  "flame_dash",
  "afterburn",
  "concussive_combustion",
];

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeImage(value) {
  return IMAGE_EXTENSIONS.test(value) || /(?:^|[/._-])(?:image|icon|portrait|card|hud|minimap)(?:[/._-]|$)/i.test(value);
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

function matchesInfernoContext(value, context = "") {
  const text = (String(value ?? "") + " " + String(context ?? "")).toLowerCase();
  return INFERNO_TERMS.some(term => text.includes(term));
}

function collectImageCandidates(value, context = "", output = [], seen = new Set()) {
  if (typeof value === "string") {
    const url = absoluteAssetUrl(value);
    if (url && looksLikeImage(value) && matchesInfernoContext(value, context)) {
      output.push({ url, context: context || "asset" });
    }
    return output;
  }

  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageCandidates(item, context + "[" + index + "]", output, seen));
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextContext = context ? context + "." + key : key;
    collectImageCandidates(child, nextContext, output, seen);
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

export function collectInfernoImageCandidates({ hero, imageRegistry } = {}) {
  const candidates = [];
  collectImageCandidates(hero?.raw ?? hero, "hero", candidates);
  collectImageCandidates(imageRegistry, "image_registry", candidates);

  // The current official hero registry uses these ability names. Including them
  // lets the exhaustive image-registry scan catch ability artwork whose filename
  // does not itself contain "inferno/infernus".
  const abilityNames = ["napalm", "flame dash", "afterburn", "concussive combustion"];
  const all = [];
  for (const candidate of candidates) {
    const context = normalizeTermText(candidate.context + " " + candidate.url);
    if (INFERNO_TERMS.some(term => context.includes(term)) ||
        abilityNames.some(name => context.includes(normalizeTermText(name)))) {
      all.push(candidate);
    }
  }

  return dedupeCandidates(all);
}

export async function loadInfernoImageTest(options = {}) {
  const [heroResult, imageResult] = await Promise.all([
    findHeroByName("Inferno", options).catch(async () => findHeroByName("Infernus", options)),
    listImages(options),
  ]);

  const hero = heroResult?.data ?? null;
  const imageRegistry = imageResult?.data ?? imageResult?.raw ?? null;
  const images = collectInfernoImageCandidates({ hero, imageRegistry });

  return {
    hero,
    images,
    imageRegistryAvailable: imageRegistry != null,
    heroEndpoint: heroResult?.url ?? "",
    imageRegistryEndpoint: imageResult?.url ?? "",
  };
}
