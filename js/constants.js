// Central de constantes da aplicação — evita valores mágicos espalhados.
const CONSTANTS = {
  // API
  API_TIMEOUT_MS: 10000,
  API_RETRIES: 2,
  API_CACHE_TTL_MS: 30 * 1000,
  API_ASSETS_CACHE_TTL_MS: 5 * 60 * 1000,

  // Tabela
  TABLE_PAGE_SIZE: 20,
  TABLE_WATCHDOG_MS: 8000,
  SEARCH_DEBOUNCE_MS: 300,

  // Builds
  BUILD_CACHE_TTL_MS: 5 * 60 * 1000,
  BUILD_ITEMS_PER_ROW: 11,
  MAX_BUILDS_PER_LIST: 3,
};
