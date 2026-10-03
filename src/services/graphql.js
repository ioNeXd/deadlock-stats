import { getGraphqlPlayground } from "../api/graphql.js";

export function loadGraphqlPlayground(options = {}) {
  return getGraphqlPlayground(options);
}
