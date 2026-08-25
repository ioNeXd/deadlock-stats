import { renderHeroDetail } from "./hero-detail.js";
import { onTableRouteActive, showLastUpdated } from "./table.js";

// =============================================================================
// ROUTER MODULE
// =============================================================================

/**
 * Extracts and validates a hero ID from a URL hash string.
 * Accepts formats like "#hero=123" or "hero=123".
 *
 * @param {string} hash - The hash string to parse.
 * @returns {number|null} The hero ID if valid, or null.
 */
export function parseHeroIdFromHash(hash) {
  if (!hash || typeof hash !== "string") return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  const rawHeroId = params.get("hero");
  if (rawHeroId !== null && rawHeroId !== "") {
    const heroId = Number(rawHeroId);
    if (Number.isInteger(heroId) && heroId > 0) {
      return heroId;
    }
  }
  return null;
}

/**
 * Parses the current URL hash and returns the view mode.
 *
 * Routes:
 * - "#hero=ID" -> hero detail view
 * - "#tierlist" -> table (heroes/items) view
 * - anything else (including empty hash) -> lobby view (site landing screen)
 *
 * @returns {{view: string, heroId?: number}} The view mode and optional hero ID.
 */
function parseHash() {
  const heroId = parseHeroIdFromHash(window.location.hash);
  if (heroId !== null) {
    return { view: "hero", heroId };
  }
  const cleaned = window.location.hash.replace(/^#/, "");
  if (cleaned === "tierlist") {
    return { view: "table" };
  }
  return { view: "lobby" };
}

// =============================================================================
// VIEW MANAGEMENT
// =============================================================================

let lastUpdatedTriggered = false;

/**
 * Shows the specified view by toggling visibility of the lobby, table, and
 * hero detail containers, and whether the site chrome (header/main) is shown.
 *
 * @param {string} view - The view name ("lobby", "table", or "hero").
 */
function showView(view) {
  const lobbyView = document.getElementById("lobby-view");
  const tableView = document.getElementById("table-view");
  const heroView = document.getElementById("hero-detail-view");

  document.body.classList.toggle("lobby-active", view === "lobby");
  if (lobbyView) lobbyView.classList.toggle("hidden", view !== "lobby");

  if (view === "hero") {
    tableView.classList.add("hidden");
    heroView.classList.remove("hidden");
  } else {
    heroView.classList.add("hidden");
    tableView.classList.toggle("hidden", view === "lobby");
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
  } else if (
    route.view === "table" &&
    typeof onTableRouteActive === "function"
  ) {
    onTableRouteActive();
  }

  // "Last updated" lives in the header, which is hidden on the lobby — only
  // fetch it once, the first time the site chrome actually becomes visible.
  if (
    route.view !== "lobby" &&
    !lastUpdatedTriggered &&
    typeof showLastUpdated === "function"
  ) {
    lastUpdatedTriggered = true;
    showLastUpdated();
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
 * Navigates to the table (tierlist) view.
 */
export function navigateToTable() {
  window.location.hash = "tierlist";
}

/**
 * Navigates back to the lobby (site landing screen).
 */
export function navigateToLobby() {
  window.location.hash = "";
}
