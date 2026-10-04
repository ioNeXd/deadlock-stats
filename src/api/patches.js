import { apiGet } from "./client.js";

export function getPatches(options = {}) {
  return apiGet("/v2/patches", options);
}

export function getBigPatchDays(options = {}) {
  return apiGet("/v1/patches/big-days", options);
}
