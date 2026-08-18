/**
 * Centralized application constants to avoid scattered magic numbers.
 * Provides configuration for API timeouts, caching, pagination, and build limits.
 *
 * @module constants
 */

// =============================================================================
// APPLICATION CONSTANTS
// =============================================================================

export const CONSTANTS = {
  // API
  API_TIMEOUT_MS: 10000,
  API_RETRIES: 2,
  API_CACHE_TTL_MS: 30 * 1000,
  API_CACHE_MAX_ENTRIES: 200,
  API_ASSETS_CACHE_TTL_MS: 5 * 60 * 1000,

  // Table
  TABLE_PAGE_SIZE: 20,
  TABLE_WATCHDOG_MS: 8000,
  SEARCH_DEBOUNCE_MS: 300,
  LAST_UPDATED_TIMEOUT_MS: 8000,

  // Builds
  BUILD_CACHE_TTL_MS: 5 * 60 * 1000,
  MAX_BUILDS_PER_LIST: 3,
};