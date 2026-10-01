function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function pickId(entity) {
  return entity?.id ?? entity?.hero_id ?? entity?.item_id ?? entity?.tier ?? entity?.rank_id ?? null;
}

function pickName(entity) {
  return entity?.name ?? entity?.display_name ?? entity?.hero_name ?? entity?.item_name ?? null;
}

const IMAGE_FIELDS = [
  "background_image","background_image_webp","hero_card_critical","hero_card_critical_webp",
  "hero_card_gloat","hero_card_gloat_webp","icon_hero_card","icon_hero_card_webp",
  "icon_image_small","icon_image_small_webp","minimap_image","minimap_image_webp",
  "name_image","top_bar_vertical_image","top_bar_vertical_image_webp","vote_sticker",
  "vote_sticker_webp","weapon_image","weapon_image_webp","image","image_webp","icon","icon_webp",
];

function normalizeEntity(entity) {
  if (!entity || typeof entity !== "object") return { id: null, name: null, images: {}, raw: entity };
  const images = entity.images && typeof entity.images === "object" ? { ...entity.images } : {};
  for (const field of IMAGE_FIELDS) if (typeof entity[field] === "string" && entity[field]) images[field] = entity[field];
  return {
    id: pickId(entity),
    className: entity.class_name ?? null,
    name: pickName(entity),
    type: entity.type ?? null,
    slotType: entity.item_slot_type ?? null,
    colors: entity.colors ?? null,
    images,
    raw: entity,
  };
}

export function normalizeCollection(payload) { return asArray(payload).map(normalizeEntity); }
export function normalizeAsset(entity) { return entity ?? null; }
export function normalizeHero(entity) { return normalizeEntity(entity); }
export function normalizeRank(entity) { return normalizeEntity(entity); }
export function normalizeItem(entity) { return normalizeEntity(entity); }


export function resolveAssetImage(entity, preferred = []) {
  const images = entity?.images && typeof entity.images === "object" ? entity.images : {};
  const candidates = [...preferred, ...IMAGE_FIELDS];
  for (const field of candidates) {
    const value = images[field] ?? entity?.raw?.images?.[field] ?? entity?.raw?.[field];
    if (typeof value === "string" && value) return value;
  }
  return "";
}
