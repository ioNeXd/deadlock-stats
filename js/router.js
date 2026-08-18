import { renderHeroDetail } from "./hero-detail.js";
import { onTableRouteActive } from "./table.js";

// =============================================================================
// ROUTER MODULE
// =============================================================================

/**
 * Parses the current URL hash and extracts the view type and hero ID.
 *
 * @param {string} [hash] - Optional hash string; defaults to window.location.hash.
 * @returns {{view: string, heroId?: number}} The view mode ("table" or "hero") and optional hero ID.
 */
function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const rawHeroId = params.get("hero");
  if (rawHeroId !== null && rawHeroId !== "") {
    const heroId = Number(rawHeroId);
    if (Number.isInteger(heroId) && heroId > 0) {
      return { view: "hero", heroId };
    }
  }
  return { view: "table" };
}

// =============================================================================
// VIEW MANAGEMENT
// =============================================================================

/**
 * Shows the specified view by toggling visibility of the table and hero detail containers.
 *
 * @param {string} view - The view name ("table" or "hero").
 */
function showView(view) {
  const tableView = document.getElementById("table-view");
  const heroView = document.getElementById("hero-detail-view");
  if (view === "hero") {
    tableView.classList.add("hidden");
    heroView.classList.remove("hidden");
  } else {
    heroView.classList.add("hidden");
    tableView.classList.remove("hidden");
  }
}

/**
 * Handles route changes by parsing the hash, switching views, and rendering the appropriate content.
 *
 * @returns {Promise<void>}
 */
export async function handleRouteChange() {
  const route = parseHash();
  showView(route.view);
  if (route.view === "hero") {
    await renderHeroDetail(route.heroId);
  } else if (typeof onTableRouteActive === "function") {
    onTableRouteActive();
  }
}

/**
 * Initializes the router by listening to hashchange events.
 */
export function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);
  const backButton = document.getElementById("back-to-table");
  if (backButton) {
    backButton.addEventListener("click", navigateToTable);
  }
}

// =============================================================================
// NAVIGATION
// =============================================================================

/**
 * Navigates to the hero detail view for a given hero ID.
 *
 * @param {number} heroId - The hero ID.
 */
export function navigateToHero(heroId) {
  window.location.hash = `hero=${heroId}`;
}

/**
 * Navigates back to the table view by clearing the URL hash.
 */
export function navigateToTable() {
  window.location.hash = "";
}