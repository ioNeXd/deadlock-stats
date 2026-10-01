import { apiGet } from "./client.js";
import { queryToObject } from "./query.js";

const BUILD_FILTERS = [
  "min_unix_timestamp","max_unix_timestamp","min_published_unix_timestamp","max_published_unix_timestamp",
  "sort_by","start","limit","sort_direction","search_name","search_description","only_latest",
  "build_language","build_id","version","hero_id","tag","rollup_category","author_id",
];

function buildOptions(options = {}) {
  const { query, ...rest } = options;
  const source = { ...queryToObject(query), ...Object.fromEntries(Object.entries(rest).filter(([key]) => BUILD_FILTERS.includes(key))) };
  const filtered = Object.fromEntries(Object.entries(source).filter(([key, value]) => BUILD_FILTERS.includes(key) && value !== undefined && value !== null && value !== ""));
  return { ...rest, query: filtered };
}

export function searchBuilds(options = {}) {
  return apiGet("/v1/builds", buildOptions(options));
}

export function fetchBuildsByAuthor(accountId, options = {}) {
  return apiGet("/v1/builds/by-author/" + encodeURIComponent(accountId), options);
}

export function fetchBuild(heroId, buildId, options = {}) {
  const query = queryToObject(options.query);
  return apiGet("/v1/builds/" + encodeURIComponent(heroId) + "/" + encodeURIComponent(buildId), {
    ...options,
    query: { ...query, ...(options.force_refetch == null ? {} : { force_refetch: options.force_refetch }) },
  });
}
