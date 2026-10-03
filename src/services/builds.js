import { searchBuilds, fetchBuildsByAuthor, fetchBuild } from "../api/builds.js";

function normalizeBuilds(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function withBuilds(result) {
  const raw = result?.data;
  return { ...result, raw, data: normalizeBuilds(raw) };
}

function withBuild(result) {
  return { ...result, raw: result?.data, data: result?.data ?? null };
}

export async function listBuilds(options = {}) {
  return withBuilds(await searchBuilds(options));
}

export async function listBuildsByAuthor(accountId, options = {}) {
  return withBuilds(await fetchBuildsByAuthor(accountId, options));
}

export async function getBuild(heroId, buildId, options = {}) {
  return withBuild(await fetchBuild(heroId, buildId, options));
}

export function normalizeBuildDetail(build) {
  const heroBuild = build?.hero_build ?? build ?? null;
  const details = heroBuild?.details ?? null;
  return {
    heroBuildId: heroBuild?.hero_build_id ?? null,
    heroId: heroBuild?.hero_id ?? null,
    authorAccountId: heroBuild?.author_account_id ?? null,
    name: heroBuild?.name ?? null,
    description: heroBuild?.description ?? null,
    language: heroBuild?.language ?? null,
    version: heroBuild?.version ?? null,
    originBuildId: heroBuild?.origin_build_id ?? null,
    lastUpdatedTimestamp: heroBuild?.last_updated_timestamp ?? null,
    publishTimestamp: heroBuild?.publish_timestamp ?? null,
    tags: Array.isArray(heroBuild?.tags) ? heroBuild.tags : [],
    categories: Array.isArray(details?.mod_categories) ? details.mod_categories.map(category => ({
      name: category?.name ?? null,
      description: category?.description ?? null,
      optional: category?.optional ?? null,
      mods: Array.isArray(category?.mods) ? category.mods.map(mod => ({
        abilityId: mod?.ability_id ?? null,
        annotation: mod?.annotation ?? null,
        imbueTargetAbilityId: mod?.imbue_target_ability_id ?? null,
        requiredFlexSlots: mod?.required_flex_slots ?? null,
        sellPriority: mod?.sell_priority ?? null,
      })) : [],
      raw: category,
    })) : [],
    abilityOrder: details?.ability_order ? {
      currencyChanges: Array.isArray(details.ability_order.currency_changes)
        ? details.ability_order.currency_changes.map(change => ({
            abilityId: change?.ability_id ?? null,
            annotation: change?.annotation ?? null,
            currencyType: change?.currency_type ?? null,
            delta: change?.delta ?? null,
          }))
        : [],
      raw: details.ability_order,
    } : null,
    raw: build ?? null,
  };
}

export async function getBuildDetail(heroId, buildId, options = {}) {
  const result = await getBuild(heroId, buildId, options);
  return { ...result, data: normalizeBuildDetail(result.data) };
}

export function buildBuildDetailViewModel(detail, performance = null) {
  const categories = Array.isArray(detail?.categories) ? detail.categories : [];
  const mods = categories.flatMap(category => Array.isArray(category?.mods) ? category.mods : []);
  const wins = Number(performance?.wins);
  const matches = Number(performance?.matches);
  const winRate = Number.isFinite(wins) && Number.isFinite(matches) && matches > 0
    ? (wins / matches) * 100
    : null;

  return {
    heroBuildId: detail?.heroBuildId ?? null,
    heroId: detail?.heroId ?? null,
    name: detail?.name ?? null,
    description: detail?.description ?? null,
    language: detail?.language ?? null,
    version: detail?.version ?? null,
    authorAccountId: detail?.authorAccountId ?? null,
    originBuildId: detail?.originBuildId ?? null,
    publishTimestamp: detail?.publishTimestamp ?? null,
    lastUpdatedTimestamp: detail?.lastUpdatedTimestamp ?? null,
    tags: Array.isArray(detail?.tags) ? detail.tags : [],
    categories: categories.map(category => ({
      name: category?.name ?? null,
      description: category?.description ?? null,
      optional: category?.optional ?? null,
      modCount: Array.isArray(category?.mods) ? category.mods.length : 0,
      mods: Array.isArray(category?.mods) ? category.mods : [],
    })),
    modCount: mods.length,
    abilityOrder: detail?.abilityOrder ?? null,
    performance: performance ? {
      wins: Number.isFinite(wins) ? wins : null,
      losses: Number.isFinite(Number(performance?.losses)) ? Number(performance.losses) : null,
      matches: Number.isFinite(matches) ? matches : null,
      players: Number.isFinite(Number(performance?.players)) ? Number(performance.players) : null,
      winRate,
    } : null,
    raw: detail?.raw ?? null,
  };
}
