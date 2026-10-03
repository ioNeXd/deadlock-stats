import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const BUILD_FILTERS = [
  "min_unix_timestamp","max_unix_timestamp","min_published_unix_timestamp","max_published_unix_timestamp",
  "sort_by","start","limit","sort_direction","search_name","search_description","only_latest",
  "build_language","build_id","version","hero_id","tag","rollup_category","author_id",
];

const BUILD_SORTS = new Set(["weekly_favorites","favorites","ignores","reports","updated_at","published_at","version"]);
const BUILD_DIRECTIONS = new Set(["desc","asc"]);
const BUILD_LANGUAGES = new Set(["English","German","French","Italian","Korean","SpanishSpain","ChineseSimplified","Russian","Thai","Japanese","PortuguesePortugal","Polish","Czech","Turkish","PortugueseBrazil","Ukrainian","SpanishLatinAmerica","Vietnamese"]);

function validateId(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(name + " must be a non-negative integer");
  return value;
}

function buildOptions(options = {}) {
  const { query, ...rest } = options;
  const source = { ...queryToObject(query), ...Object.fromEntries(Object.entries(rest).filter(([key]) => BUILD_FILTERS.includes(key))) };
  const filtered = Object.fromEntries(Object.entries(source).filter(([key, value]) => BUILD_FILTERS.includes(key) && value !== undefined && value !== null && value !== ""));
  if (filtered.sort_by != null && !BUILD_SORTS.has(filtered.sort_by)) throw new RangeError("Unsupported build sort_by");
  if (filtered.sort_direction != null && !BUILD_DIRECTIONS.has(filtered.sort_direction)) throw new RangeError("Unsupported build sort_direction");
  if (filtered.build_language != null && !BUILD_LANGUAGES.has(filtered.build_language)) throw new RangeError("Unsupported build_language");
  for (const key of ["start","limit","build_id","version","hero_id","tag","rollup_category","author_id"]) {
    if (filtered[key] != null) validateId(Number(filtered[key]), key);
  }
  return { ...rest, query: filtered };
}

export function searchBuilds(options = {}) {
  return apiGet("/v1/builds", buildOptions(options));
}

export function fetchBuildsByAuthor(accountId, options = {}) {
  validateId(accountId, "accountId");
  return apiGet("/v1/builds/by-author/" + encodeURIComponent(accountId), { ...options, query: undefined });
}

export function fetchBuild(heroId, buildId, options = {}) {
  validateId(heroId, "heroId");
  validateId(buildId, "buildId");
  const query = queryToObject(options.query);
  return apiGet("/v1/builds/" + encodeURIComponent(heroId) + "/" + encodeURIComponent(buildId), {
    ...options,
    query: { ...query, ...(options.force_refetch == null ? {} : { force_refetch: options.force_refetch }) },
  });
}
