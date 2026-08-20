import { CONSTANTS } from "./constants.js";
import {
  applyTranslations,
  initI18n,
  setLanguageChangeHandler,
  t,
} from "./i18n.js";
import {
  getGameStats,
  getHeroStats,
  getHeroesById,
  getItemStats,
  getItemsById,
  getLastUpdated,
  resolveEntityImage,
} from "./api.js";
import { debounce, escapeHtml, formatDate } from "./utils.js";
import { handleRouteChange, initRouter, navigateToHero } from "./router.js";

// =============================================================================
// TABLE MODULE
// =============================================================================
// ===========================================================================
// STATE
// ===========================================================================

const state = {
  rows: [],
  filteredRows: [],
  sortColumn: null,
  sortDirection: "desc",
  type: "heroes",
  gameStats: null,
  searchQuery: "",
  page: 1,
  pageSize: CONSTANTS.TABLE_PAGE_SIZE,
};

// AbortController for ongoing rendering – aborted when a new renderTable()
// is started to discard stale responses.
let activeAbortController = null;
let renderRequestSeq = 0;

// ===========================================================================
// UI HELPERS (Loader, Error, Accessibility)
// ===========================================================================

/**
 * Renders skeleton placeholder rows in the table body.
 */
function renderSkeletonRows() {
  const tbody = document.getElementById("stats-table-body");
  if (!tbody) return;

  const rows = Array.from(
    { length: 6 },
    () => `
      <tr class="skeleton-row" aria-hidden="true">
        <td><span class="skeleton-cell skeleton-avatar"></span></td>
        <td><span class="skeleton-cell"></span></td>
        <td><span class="skeleton-cell"></span></td>
        <td><span class="skeleton-cell"></span></td>
      </tr>
    `,
  ).join("");

  tbody.innerHTML = rows;
}

/**
 * Shows the loading state: skeleton rows, hides error, sets aria attributes.
 */
function showLoader() {
  const container = document.getElementById("loading-container");
  const table = document.getElementById("stats-table");
  hideError();
  renderSkeletonRows();
  if (container) {
    container.setAttribute("aria-hidden", "false");
    container.classList.remove("hidden");
  }
  if (table) table.setAttribute("aria-busy", "true");
}

/**
 * Hides the loading state.
 */
function hideLoader() {
  const container = document.getElementById("loading-container");
  const table = document.getElementById("stats-table");
  if (container) {
    container.setAttribute("aria-hidden", "true");
    container.classList.add("hidden");
  }
  if (table) table.setAttribute("aria-busy", "false");
}

/**
 * Announces a status message to screen readers.
 *
 * @param {string} message - The message to announce.
 */
function announceStatus(message) {
  const status = document.getElementById("sr-status");
  if (!status) return;
  status.textContent = message;
}

/**
 * Displays an error banner with the given message.
 *
 * @param {string} message - The error message.
 */
function showError(message) {
  const banner = document.getElementById("error-banner");
  const msg = document.getElementById("error-banner-message");
  if (msg) msg.textContent = message;
  if (banner) {
    banner.classList.remove("hidden");
    banner.setAttribute("aria-hidden", "false");
    banner.focus && banner.focus();
    announceStatus(message);
  }
}

/**
 * Hides the error banner.
 */
function hideError() {
  const banner = document.getElementById("error-banner");
  const msg = document.getElementById("error-banner-message");
  if (msg) msg.textContent = "";
  if (banner) {
    banner.classList.add("hidden");
    banner.setAttribute("aria-hidden", "true");
  }
}

/**
 * Updates the aria-sort attributes on sortable column headers.
 */
function updateAriaSort() {
  const headers = {
    winRate: document.getElementById("header-winrate"),
    pickRate: document.getElementById("header-pickrate"),
  };

  for (const [key, el] of Object.entries(headers)) {
    if (!el) continue;
    if (state.sortColumn === key) {
      el.setAttribute(
        "aria-sort",
        state.sortDirection === "asc" ? "ascending" : "descending",
      );
    } else {
      el.removeAttribute("aria-sort");
    }
  }
}

// ===========================================================================
// DATA FILTERING & RENDERING
// ===========================================================================

/**
 * Applies search filter to the rows.
 */
function applyFilters() {
  let rows = [...state.rows];
  const q = state.searchQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  state.filteredRows = rows;
}

/**
 * Renders the table body rows based on current state (filtered, sorted, paginated).
 */
function renderRows() {
  const tbody = document.getElementById("stats-table-body");
  if (!tbody) {
    console.warn("stats-table-body not found; skipping renderRows.");
    return;
  }

  tbody.innerHTML = "";

  applyFilters();
  let rows = [...state.filteredRows];

  // Update table aria-label dynamically
  try {
    const table = document.getElementById("stats-table");
    if (table) {
      const count = rows.length || 0;
      const labelKey =
        state.type === "heroes"
          ? "a11y_hero_list_label"
          : "a11y_item_list_label";
      const raw =
        t(labelKey) ||
        (state.type === "heroes"
          ? "Heroes list, {count} items"
          : "Items list, {count} items");
      table.setAttribute("aria-label", raw.replace("{count}", count));
    }
  } catch (_e) {
    // no-op if translations missing
  }

  if (state.sortColumn === null) {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    rows.sort((a, b) => {
      const diff = a[state.sortColumn] - b[state.sortColumn];
      return state.sortDirection === "asc" ? diff : -diff;
    });
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);

  const pageInfo = document.getElementById("page-info");
  if (pageInfo) pageInfo.textContent = `${state.page} / ${totalPages}`;

  if (pageRows.length === 0) {
    const tr = document.createElement("tr");
    tr.classList.add("empty-state");
    tr.innerHTML = `<td colspan="4">${t("no_data") || "No data available"}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of pageRows) {
    const tr = document.createElement("tr");
    const imgSrc = row.imageUrl || "";
    const imgAlt = row.name || "";

    const safeSrc = escapeHtml(imgSrc || "assets/placeholder.svg");
    const safeAlt = escapeHtml(imgAlt);

    tr.innerHTML = `
        <td><img class="lazy-img" src="${safeSrc}" width="32" height="32" alt="${safeAlt}" loading="lazy" decoding="async"></td>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.winRate.toFixed(1)}%</td>
        <td>${row.pickRate.toFixed(1)}%</td>
      `;

    const imgEl = tr.querySelector("img.lazy-img");
    if (imgEl) {
      imgEl.addEventListener("error", () => {
        imgEl.src = "assets/placeholder.svg";
        imgEl.alt = imgAlt
          ? `${imgAlt} (image unavailable)`
          : "Image unavailable";
        imgEl.style.opacity = "1";
      });
      imgEl.addEventListener("load", () => {
        imgEl.style.opacity = "1";
      });
    }

    if (state.type === "heroes" && row.id != null) {
      tr.classList.add("clickable-row");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", row.name);
      const goToHero = () => navigateToHero(row.id);
      tr.addEventListener("click", goToHero);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToHero();
          return;
        }

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const dir = e.key === "ArrowDown" ? "next" : "prev";
          let sib =
            dir === "next" ? tr.nextElementSibling : tr.previousElementSibling;
          while (sib && sib.nodeType !== 1)
            sib = dir === "next" ? sib.nextSibling : sib.previousSibling;
          if (sib && typeof sib.focus === "function") {
            tr.removeAttribute("aria-current");
            sib.setAttribute("aria-current", "true");
            sib.focus();
          }
        }
      });
    }

    fragment.appendChild(tr);
  }

  tbody.appendChild(fragment);
}

/**
 * Handles sorting when a column header is clicked.
 *
 * @param {string} column - The column identifier ("winRate" or "pickRate").
 */
function handleSortClick(column) {
  if (state.sortColumn !== column) {
    state.sortColumn = column;
    state.sortDirection = "desc";
  } else if (state.sortDirection === "desc") {
    state.sortDirection = "asc";
  } else {
    state.sortColumn = null;
  }

  updateAriaSort();
  const directionLabel =
    state.sortDirection === "asc" ? "ascending" : "descending";
  const columnLabel = state.sortColumn === "winRate" ? "Win Rate" : "Pick Rate";
  const message = state.sortColumn
    ? `Sorted by ${columnLabel}, ${directionLabel}`
    : "Sorting cleared";
  announceStatus(message);
  renderRows();
}

// ===========================================================================
// DATA MAPPING
// ===========================================================================

/**
 * Maps raw stats and entity data into table row objects.
 *
 * @param {Array} stats - The stats array (hero or item).
 * @param {Object} entitiesById - Map of entity data keyed by ID.
 * @param {string} idField - The field name used as ID in stats (e.g., "hero_id").
 * @param {string} type - "heroes" or "items".
 * @returns {Array} Array of row objects with id, name, imageUrl, winRate, pickRate.
 */
function mapStatsToRows(stats, entitiesById, idField, type, totalMatches = 0) {
  const totalItemSlots = totalMatches * 12;

  return stats.map((stat) => {
    const entity = entitiesById[stat[idField]] || {};
    const wins = Number(stat.wins) || 0;
    const matchesCount = Number(stat.matches) || 0;
    const winRate = matchesCount > 0 ? (wins / matchesCount) * 100 : 0;
    const pickRate =
      type === "heroes"
        ? (matchesCount / (totalMatches || 1)) * 100
        : (matchesCount / (totalItemSlots || 1)) * 100;
    const imageUrl = resolveEntityImage(entity);
    if (!imageUrl && entity && entity.name) {
      console.debug(`No image for: ${entity.name} (id=${entity.id})`);
    }
    return {
      id: stat[idField],
      name: entity.name || "Unknown",
      imageUrl: imageUrl || "",
      winRate,
      pickRate,
    };
  });
}

// ===========================================================================
// MAIN RENDER FUNCTION
// ===========================================================================

/**
 * Updates the search input's placeholder/aria-label based on the active tab.
 */
function updateSearchPlaceholder() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;
  const labelKey =
    state.type === "heroes"
      ? "search_heroes_placeholder"
      : "search_items_placeholder";
  const label =
    t(labelKey) || (state.type === "heroes" ? "Search heroes" : "Search items");
  searchInput.setAttribute("placeholder", label);
  searchInput.setAttribute("aria-label", label);
}

/**
 * Renders the table (heroes or items) by fetching data and populating rows.
 *
 * @param {string} type - "heroes" or "items".
 * @returns {Promise<void>}
 */
async function renderTable(type) {
  state.type = type;

  /* Toggle body background class based on active tab */
  document.body.classList.toggle("body--items", type === "items");
  document.body.classList.toggle("body--heroes", type === "heroes");

  updateSearchPlaceholder();

  const header = document.getElementById("table-name-header");
  if (!header) {
    console.warn("table-name-header not found; skipping renderTable.");
    return;
  }

  let stats, entitiesById, idField;

  showLoader();

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch (_e) {
      /* ignore */
    }
  }

  const watchdog = new AbortController();
  activeAbortController = watchdog;
  const requestId = ++renderRequestSeq;
  let watchdogTimer = setTimeout(() => {
    try {
      watchdog.abort();
    } catch (_e) {
      /* ignore */
    }
    console.warn(
      `Render table watchdog triggered (${CONSTANTS.TABLE_WATCHDOG_MS}ms)`,
    );
  }, CONSTANTS.TABLE_WATCHDOG_MS);

  try {
    if (type === "heroes") {
      header.setAttribute("data-i18n", "table_hero");
      idField = "hero_id";
      const fetchPromise = Promise.all([
        getHeroStats({ signal: watchdog.signal }),
        getHeroesById({ signal: watchdog.signal }),
      ]);
      [stats, entitiesById] = await fetchPromise;
    } else {
      header.setAttribute("data-i18n", "table_item");
      idField = "item_id";
      const fetchPromise = Promise.all([
        getItemStats({ signal: watchdog.signal }),
        getItemsById({ signal: watchdog.signal }),
      ]);
      [stats, entitiesById] = await fetchPromise;
    }

    applyTranslations();

    if (!state.gameStats) {
      state.gameStats = await getGameStats({ signal: watchdog.signal });
    }

    const totalMatches = Number(state.gameStats[0]?.total_matches) || 0;
    state.rows = mapStatsToRows(
      stats,
      entitiesById,
      idField,
      type,
      totalMatches,
    );

    state.sortColumn = null;
    updateAriaSort();
    announceStatus("Table updated");
    renderRows();

    const nameHeader = document.getElementById("table-name-header");
    if (nameHeader) nameHeader.focus();
  } catch (err) {
    if (requestId !== renderRequestSeq) return;

    const timedOut = err && err.name === "AbortError";
    console.error("Failed to render table:", err);

    if (timedOut && state.rows.length > 0) {
      console.warn("Table refresh timed out; keeping previous rows.");
    } else {
      state.rows = [];
      renderRows();
    }
    showError(t("error_fetching_data"));
  } finally {
    if (requestId === renderRequestSeq) activeAbortController = null;
    hideLoader();
    try {
      clearTimeout(watchdogTimer);
    } catch (_e) {
      /* ignore */
    }
  }
}

// ===========================================================================
// EVENT BINDING
// ===========================================================================

/**
 * Binds a button-like element to an action via click or Enter/Space keypress.
 *
 * @param {HTMLElement} el - The element to bind.
 * @param {Function} fn - The action to run on activation.
 */
function bindActivate(el, fn) {
  if (!el) return;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    fn();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  });
}

/**
 * Sets up all DOM event listeners for the table UI.
 */
function bindEvents() {
  const headerWin = document.getElementById("header-winrate");
  const headerPick = document.getElementById("header-pickrate");
  const navHeroes = document.getElementById("nav-heroes");
  const navItems = document.getElementById("nav-items");
  const retryButton = document.getElementById("error-retry");
  const searchInput = document.getElementById("search-input");
  const refreshButton = document.getElementById("refresh-button");
  const prevPage = document.getElementById("prev-page");
  const nextPage = document.getElementById("next-page");

  bindActivate(headerWin, () => handleSortClick("winRate"));
  bindActivate(headerPick, () => handleSortClick("pickRate"));
  bindActivate(navHeroes, () => renderTable("heroes"));
  bindActivate(navItems, () => renderTable("items"));
  bindActivate(retryButton, () => renderTable(state.type));

  if (searchInput) {
    updateSearchPlaceholder();
    const onSearchInput = debounce(() => {
      state.page = 1;
      renderRows();
    }, CONSTANTS.SEARCH_DEBOUNCE_MS);
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value || "";
      onSearchInput();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => renderTable(state.type));
  }

  if (prevPage)
    prevPage.addEventListener("click", () => {
      if (state.page > 1) {
        state.page--;
        renderRows();
      }
    });
  if (nextPage)
    nextPage.addEventListener("click", () => {
      state.page++;
      renderRows();
    });
}

/**
 * Called when the table route is active (e.g., after hash change).
 */
function onTableRouteActive() {
  renderTable(state.type);
}

/**
 * Handler for language change – re-renders the table with new translations.
 */
setLanguageChangeHandler(() => {
  renderTable(state.type);
});

// ===========================================================================
// LAST UPDATED DISPLAY
// ===========================================================================

/**
 * Fetches and displays the last updated timestamp.
 *
 * @returns {Promise<void>}
 */
async function showLastUpdated() {
  const el = document.getElementById("last-updated");
  if (el) el.textContent = t("loading");
  try {
    const timeoutMs = CONSTANTS.LAST_UPDATED_TIMEOUT_MS;
    const lastMatch = await Promise.race([
      getLastUpdated(),
      new Promise((res) => setTimeout(() => res(null), timeoutMs)),
    ]);

    if (
      !lastMatch ||
      !(lastMatch instanceof Date) ||
      lastMatch.getTime() === 0
    ) {
      if (el)
        el.textContent = `${t("last_updated_prefix")} ${t("last_updated_unavailable")}`;
      return;
    }

    const formatted = formatDate(lastMatch);
    if (el) el.textContent = `${t("last_updated_prefix")} ${formatted}`;
  } catch (err) {
    if (el)
      el.textContent = `${t("last_updated_prefix")} ${t("last_updated_unavailable")}`;
    console.error("Failed to fetch last-updated:", err);
    showError(t("error_fetching_data"));
  }
}

// ===========================================================================
// INITIALIZATION
// ===========================================================================

/**
 * Initializes the table module: i18n, event bindings, router, and initial render.
 *
 * @returns {Promise<void>}
 */
async function init() {
  await initI18n();
  bindEvents();

  if (typeof initRouter === "function") {
    initRouter();
  }

  if (typeof handleRouteChange === "function") {
    await handleRouteChange();
  } else {
    await renderTable("heroes");
  }

  showLastUpdated();
}

// Start the module (guarded for Node.js test environment)
if (typeof document !== "undefined") {
  init();
}

export { init, onTableRouteActive, renderTable, mapStatsToRows };
