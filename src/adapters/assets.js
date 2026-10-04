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

function mapWorldToRelative(point, radius, offset = [0, 0]) {
  if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(radius) || radius <= 0) return null;
  const safeOffset = Array.isArray(offset) ? offset : [0, 0];
  const x = Number(point[0]) + Number(safeOffset[0] ?? 0);
  const y = Number(point[1]) + Number(safeOffset[1] ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [
    (x + radius) / (2 * radius),
    (radius - y) / (2 * radius),
  ];
}

function chooseZiplineCoordinateMode(points, radius, origin) {
  const candidates = [null, [Number(origin?.[0] ?? 0), Number(origin?.[1] ?? 0)]];
  const score = offset => points.reduce((total, point) => {
    if (!Array.isArray(point) || point.length < 2) return total;
    const x = Number(point[0]) + Number(offset?.[0] ?? 0);
    const y = Number(point[1]) + Number(offset?.[1] ?? 0);
    return total + (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= radius && Math.abs(y) <= radius ? 1 : 0);
  }, 0);
  return score(candidates[1]) > score(candidates[0]) ? candidates[1] : candidates[0];
}

function normalizeZiplinePath(path, radius) {
  if (!path || typeof path !== "object" || !Number.isFinite(radius) || radius <= 0) return { ...path, segments: [] };
  const origin = Array.isArray(path.origin) ? path.origin : [0, 0, 0];
  const p0 = Array.isArray(path.P0_points) ? path.P0_points : [];
  const p1 = Array.isArray(path.P1_points) ? path.P1_points : [];
  const p2 = Array.isArray(path.P2_points) ? path.P2_points : [];
  const count = Math.min(p0.length, p1.length, p2.length);
  const allPoints = [...p0, ...p1, ...p2];
  const offset = chooseZiplineCoordinateMode(allPoints, radius, origin);
  const nodes = Array.from({ length: count }, (_, index) => ({
    p0: mapWorldToRelative(p0[index], radius, offset),
    p1: mapWorldToRelative(p1[index], radius, offset),
    p2: mapWorldToRelative(p2[index], radius, offset),
  }));
  const segments = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const current = nodes[index];
    const next = nodes[index + 1];
    if (!current.p0 || !current.p2 || !next.p1 || !next.p0) continue;
    segments.push({
      start: current.p0,
      control1: current.p2,
      control2: next.p1,
      end: next.p0,
    });
  }
  return { ...path, segments };
}

export function normalizeMap(entity) {
  if (!entity || typeof entity !== "object") return { radius: null, images: {}, objectivePositions: {}, ziplinePaths: [], neutralCamps: null, entities: null, raw: entity };
  const radius = Number.isFinite(Number(entity.radius)) ? Number(entity.radius) : null;
  return {
    radius,
    images: entity.images && typeof entity.images === "object" ? { ...entity.images } : {},
    objectivePositions: entity.objective_positions && typeof entity.objective_positions === "object" ? { ...entity.objective_positions } : {},
    ziplinePaths: Array.isArray(entity.zipline_paths) ? entity.zipline_paths.map(path => normalizeZiplinePath(path, radius)) : [],
    neutralCamps: Array.isArray(entity.neutral_camps) ? entity.neutral_camps.slice() : entity.neutral_camps === null ? null : null,
    entities: entity.entities && typeof entity.entities === "object" ? { ...entity.entities } : null,
    raw: entity,
  };
}
