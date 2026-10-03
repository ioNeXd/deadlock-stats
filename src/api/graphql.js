import { apiGet } from "./client.js";

export function getGraphqlPlayground(options = {}) {
  return apiGet("/v1/graphql", { ...options, responseType: "text", cache: false, dedupe: false });
}
