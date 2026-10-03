import { apiGet } from "../api/client.js";
import { reconcileVersionPolicy } from "../api/versioning.js";

export function getOpenApiContract(options = {}) {
  return apiGet("/openapi.json", {
    cacheTtlMs: options.cacheTtlMs ?? 5 * 60_000,
    ...options,
  });
}

export function createVersionMonitor(callbacks = {}) {
  let previousContract = null;

  return {
    async refresh(options = {}) {
      const result = await getOpenApiContract(options);
      const contract = result?.data ?? {};

      const transition = previousContract
        ? reconcileVersionPolicy(previousContract, contract, callbacks)
        : { events: [], previous: {}, current: {} };

      previousContract = contract;

      return {
        ...result,
        contract,
        transition,
      };
    },

    reset() {
      previousContract = null;
    },
  };
}
