// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Formats a Date object into a human-readable string using the browser's locale,
 * with a manual fallback format.
 *
 * @param {Date} date - The date to format.
 * @returns {string} A formatted date string (e.g., "15/08/2026 14:30").
 */
export function formatDate(date) {
  try {
    return new Intl.DateTimeFormat(navigator.language || "pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}

/**
 * Safely retrieves a nested property from an object without throwing.
 *
 * @param {Object} obj - The source object.
 * @param {string|Array<string>} path - The property path (dot‑separated string or array).
 * @param {*} [defaultValue=null] - The value to return if the path is missing.
 * @returns {*} The resolved value or the default.
 */
export function safeGet(obj, path, defaultValue = null) {
  if (obj == null) return defaultValue;
  const keys = Array.isArray(path) ? path : String(path).split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return defaultValue;
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param {*} str - The input string.
 * @returns {string} The escaped string.
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates that a given value is a positive integer hero ID.
 *
 * @param {*} heroId - The value to validate.
 * @returns {boolean} True if the value is a valid positive integer.
 */
export function isValidHeroId(heroId) {
  const num = Number(heroId);
  return Number.isInteger(num) && num > 0;
}

/**
 * Creates a debounced function that delays invoking the callback until after
 * a burst of calls stops firing for the specified wait time.
 *
 * @param {Function} fn - The function to debounce.
 * @param {number} [wait=300] - Delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(fn, wait = 300) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

/**
 * Creates a throttled function that invokes the callback at most once per
 * specified interval.
 *
 * @param {Function} fn - The function to throttle.
 * @param {number} [wait=300] - Throttle interval in milliseconds.
 * @returns {Function} The throttled function.
 */
export function throttle(fn, wait = 300) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// =============================================================================
// TTL CACHE
// =============================================================================

/**
 * A time‑based cache that automatically expires entries after a given TTL.
 */
export class TTLCache {
  /**
   * Creates a new TTL cache instance.
   *
   * @param {number} ttlMs - Time‑to‑live for cache entries in milliseconds.
   */
  constructor(ttlMs) {
    this.ttl = ttlMs;
    this.map = new Map();
  }

  /**
   * Retrieves a cached value if it exists and is not expired.
   *
   * @param {string} key - The cache key.
   * @returns {*} The stored value, or undefined if missing or expired.
   */
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts >= this.ttl) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Stores a value in the cache with the current timestamp.
   *
   * @param {string} key - The cache key.
   * @param {*} value - The value to store.
   */
  set(key, value) {
    this.map.set(key, { ts: Date.now(), value });
  }

  /**
   * Checks whether a valid (non‑expired) entry exists for the given key.
   *
   * @param {string} key - The cache key.
   * @returns {boolean} True if the entry exists and is fresh.
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Removes an entry from the cache.
   *
   * @param {string} key - The cache key.
   */
  delete(key) {
    this.map.delete(key);
  }

  /**
   * Clears all entries from the cache.
   */
  clear() {
    this.map.clear();
  }
}
