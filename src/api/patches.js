import { apiGet } from "./client.js";

export function getPatches(options = {}) {
  return apiGet("/v2/patches", options);
}
