// =============================================================================
// BUILD CARDS MODULE
// Hero build list rendering: summary cards (ID copy button, badges),
// expandable details with item categories, and the shared build cache.
// =============================================================================

import { CONSTANTS } from "./constants.js";
import { getLocalText, t } from "./i18n.js";
import { getBuildById, resolveEntityImage } from "./api.js";
import { debounce, escapeHtml, TTLCache } from "./utils.js";
import {
  buildSkillSequence,
  renderBuildSkillSection,
} from "./skill-tooltip.js";

const ROMAN_TIERS = ["", "I", "II", "III", "IV"];

// Inline SVG icon (content_copy) used by the build ID copy button.
const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;

// Build cache: expanded build payloads with TTL (5 min by default).
const buildCache = new TTLCache(CONSTANTS.BUILD_CACHE_TTL_MS);
// Pending build promises map for deduplication (prevents duplicate fetches)
const pendingBuildPromises = new Map();

// =============================================================================
// SHARED BUILD FETCH + CACHE
// =============================================================================

/**
 * Returns a cached build payload or fetches it once, caching the result.
 * Shared by both the background name filler and the card expansion flow so
 * the lookup logic lives in exactly one place.
 *
 * @param {string|number} heroId - The hero ID.
 * @param {string|number} buildId - The build ID.
 * @returns {Promise<object|null>} The normalized build payload or null.
 */
export async function getOrFetchBuild(heroId, buildId) {
  const cacheKey = `${heroId}:${buildId}`;

  // Reuse pending promise to prevent duplicate fetches (race condition fix)
  if (pendingBuildPromises.has(cacheKey)) {
    return await pendingBuildPromises.get(cacheKey);
  }

  let actualBuild = buildCache.get(cacheKey);
  if (actualBuild === undefined) {
    const fetchPromise = (async () => {
      try {
        actualBuild = await getBuildById(buildId, heroId);
      } catch (_e) {
        actualBuild = null;
      }
      if (actualBuild) buildCache.set(cacheKey, actualBuild);
      return actualBuild ?? null;
    })();
    pendingBuildPromises.set(cacheKey, fetchPromise);
    try {
      actualBuild = await fetchPromise;
    } finally {
      pendingBuildPromises.delete(cacheKey);
    }
  }
  return actualBuild ?? null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Resolves the author-provided build name from a build object, checking
 * both the list stat and the published/fallback payload.
 *
 * @param {object} build - The build stat object.
 * @returns {string} The build name or an empty string.
 */
export function getBuildDisplayName(build) {
  if (!build || typeof build !== "object") return "";
  return (
    build.name ||
    (build.publishedBuild && build.publishedBuild.name) ||
    (build.actualBuild && build.actualBuild.name) ||
    ""
  );
}

/**
 * Copies a string to the clipboard and flashes a "Copied!" state on the
 * given button, falling back to execCommand when the async API is unavailable.
 *
 * @param {string} text - The text to copy.
 * @param {HTMLElement} btn - The button element to flash as copied.
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text, btn) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (_e) {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (_e) {
      /* fallback failed */
    }
  }
  const copiedLabel = t("build_copied");
  btn.classList.add("build-copy-btn--copied");
  btn.title = copiedLabel;
  btn.setAttribute("aria-label", copiedLabel);
  showCopyToast(btn);
  setTimeout(() => {
    const label = t("build_copy_id");
    btn.classList.remove("build-copy-btn--copied");
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }, CONSTANTS.COPY_BUTTON_RESET_MS);
}

// Shared copy-toast element and its hide timer.
let _copyToastEl = null;
let _copyToastTimer = null;

/**
 * Shows a small "ID Copied!" toast floating above the copy button.
 *
 * @param {HTMLElement} btn - The button that was clicked.
 */
function showCopyToast(btn) {
  if (!_copyToastEl) {
    _copyToastEl = document.createElement("div");
    _copyToastEl.className = "build-copy-toast";
    _copyToastEl.setAttribute("role", "status");
    document.body.appendChild(_copyToastEl);
  }
  _copyToastEl.textContent = t("build_copied");
  const rect = btn.getBoundingClientRect();
  _copyToastEl.style.left = `${rect.left + rect.width / 2}px`;
  _copyToastEl.style.top = `${rect.top - 8}px`;
  _copyToastEl.classList.remove("build-copy-toast--show");
  void _copyToastEl.offsetWidth; // restart the transition
  _copyToastEl.classList.add("build-copy-toast--show");
  clearTimeout(_copyToastTimer);
  _copyToastTimer = setTimeout(() => {
    _copyToastEl.classList.remove("build-copy-toast--show");
  }, CONSTANTS.COPY_TOAST_VISIBLE_MS);
}

/**
 * Sets/clears the native tooltip on a build name element when its text
 * is truncated with an ellipsis, so the full name is shown on hover.
 *
 * @param {HTMLElement} el - The build name element.
 */
function updateBuildNameTooltip(el) {
  if (!el) return;
  const truncated = el.scrollWidth > el.clientWidth;
  if (truncated) {
    el.title = el.textContent.trim();
  } else {
    el.removeAttribute("title");
  }
}

/**
 * Refreshes truncation tooltips for every build name currently on screen.
 */
function refreshBuildNameTooltips() {
  document
    .querySelectorAll("[data-build-name]")
    .forEach(updateBuildNameTooltip);
}

/**
 * Fetches the author-provided build name in the background and fills the
 * header when the list payload did not include one (analytics stats only
 * expose the build ID).
 *
 * @param {object} build - The build stat object.
 * @param {HTMLElement} card - The build card element.
 * @param {string|number} heroId - The hero ID.
 * @returns {Promise<void>}
 */
async function fillBuildName(build, card, heroId) {
  if (getBuildDisplayName(build)) return;
  if (build.buildId == null) return;
  const actualBuild = await getOrFetchBuild(heroId, build.buildId);
  const nameEl = card.querySelector("[data-build-name]");
  if (!nameEl) return;
  const name = getBuildDisplayName(actualBuild);
  nameEl.textContent = name || `Build #${build.buildId}`;
  nameEl.classList.remove("build-name--placeholder");
  updateBuildNameTooltip(nameEl);
}

/**
 * Returns a safe item map object, defaulting to an empty object if invalid.
 *
 * @param {*} itemMap - The item map to validate.
 * @returns {Object} A valid object map.
 */

export function safeGetItemMap(itemMap) {
  return itemMap && typeof itemMap === "object" && !Array.isArray(itemMap)
    ? itemMap
    : {};
}

/**
 * Returns a CSS class for the item slot type.
 *
 * @param {string} slotType - The slot type string.
 * @returns {string} A CSS class name.
 */
export function slotTypeClass(slotType) {
  const normalized = String(slotType || "unknown").toLowerCase();
  if (normalized.includes("weapon")) return "build-item-card--weapon";
  if (normalized.includes("vitality") || normalized.includes("armor"))
    return "build-item-card--vitality";
  if (normalized.includes("spirit")) return "build-item-card--spirit";
  if (normalized.includes("utility")) return "build-item-card--utility";
  return "build-item-card--unknown";
}

/**
 * Checks if a category is optional based on its flag or name.
 *
 * @param {object} category - The category object.
 * @param {string} categoryName - The category name.
 * @returns {boolean} True if optional.
 */
export function isCategoryOptional(category, categoryName) {
  const flag = category && category.optional;
  if (flag === true || flag === 1 || flag === "1") return true;
  return /optional|op[cç]ional/i.test(categoryName || "");
}

/**
 * Reads build item metrics (size, gap, padding, border) from CSS variables.
 *
 * Cached briefly so getComputedStyle is not hit on every call within a render
 * burst. The short TTL keeps responsive media-query changes picked up.
 *
 * @returns {{size: number, gap: number, pad: number, border: number}} The metrics.
 */
let cachedItemMetrics = null;
let cachedItemMetricsAt = 0;
const ITEM_METRICS_CACHE_MS = 250;

function getBuildItemMetrics() {
  const now = Date.now();
  if (cachedItemMetrics && now - cachedItemMetricsAt < ITEM_METRICS_CACHE_MS) {
    return cachedItemMetrics;
  }
  const read = (name, fallback) =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    ) || fallback;
  cachedItemMetrics = {
    size: read("--build-item-size", 72),
    gap: read("--build-item-gap", 4),
    pad: read("--build-category-pad", 6),
    border: read("--build-category-border-w", 2),
  };
  cachedItemMetricsAt = now;
  return cachedItemMetrics;
}

/**
 * Computes how many build items fit per row based on container width.
 *
 * @param {HTMLElement} container - The container element.
 * @returns {number} Number of items per row.
 */
function getBuildItemsPerRow(container) {
  const { size, gap } = getBuildItemMetrics();
  const list = container
    ? container.closest(".build-list")
    : document.querySelector(".build-list");
  const listWidth = list ? list.clientWidth : 800;
  const available = listWidth - CONSTANTS.BUILD_ITEMS_WIDTH_RESERVE_PX;
  return Math.max(1, Math.floor((available + gap) / (size + gap)));
}

// =============================================================================
// BUILD DATA RESOLUTION
// =============================================================================

/**
 * Resolves an item entry from a build category into a displayable item object.
 *
 * @param {object} entry - The raw entry.
 * @param {object} itemMap - The item map by ID.
 * @returns {object|null} A normalized item object or null.
 */
export function resolveBuildItemFromEntry(entry, itemMap) {
  const itemId = Number(
    (entry && (entry.ability_id ?? entry.item_id ?? entry.id)) ?? 0,
  );
  if (!itemId) return null;

  const map = safeGetItemMap(itemMap);
  const item = map[itemId] || {};
  const raw = item.raw || item;
  const icon = resolveEntityImage(item, "assets/placeholder.svg");

  return {
    id: itemId,
    name: item.name || raw.name || `Item #${itemId}`,
    icon,
    tier: Number(raw.item_tier) || 0,
    slotType: raw.item_slot_type || "unknown",
    isActive: raw.is_active_item === true || raw.activation === "active",
    canInfuse: raw.can_be_infused === true || raw.infusable === true,
  };
}

/**
 * Resolves the `details` object from a build payload, navigating the
 * standard chain: publishedBuild/actualBuild → hero_build/build → details.
 * Shared by resolveBuildModCategories and skill-tooltip's skillChanges.
 *
 * @param {object} build - The build object.
 * @returns {object} The resolved details object (never null, may be empty).
 */
export function resolveBuildDetails(build) {
  if (!build || typeof build !== "object") return {};
  const source = build.publishedBuild || build.actualBuild || build;
  if (!source || typeof source !== "object") return {};

  const raw = source.raw && typeof source.raw === "object" ? source.raw : {};
  const candidate =
    source.hero_build || source.build || raw.hero_build || raw.build || {};
  return (
    (candidate && typeof candidate === "object" ? candidate.details : null) ||
    source.details ||
    {}
  );
}

/**
 * Resolves mod categories from a build payload.
 *
 * @param {object} build - The build object.
 * @returns {Array} The mod categories array (empty if not found).
 */
export function resolveBuildModCategories(build) {
  const details = resolveBuildDetails(build);
  if (Array.isArray(details.mod_categories)) return details.mod_categories;
  // Fallback: some builds store mod_categories on the source itself
  const source = build && (build.publishedBuild || build.actualBuild || build);
  if (source && Array.isArray(source.mod_categories))
    return source.mod_categories;
  return [];
}

/**
 * Builds item category data from a build payload.
 *
 * @param {object} build - The build object.
 * @param {object} itemMap - The item map.
 * @param {HTMLElement} container - The container element for layout calculations.
 * @returns {Array} Array of category objects.
 */
function buildBuildItemCategories(build, itemMap, container) {
  const modCategories = resolveBuildModCategories(build);
  if (!modCategories.length) return [];

  const perRow = getBuildItemsPerRow(container);
  return modCategories.map((category) => {
    const categoryName = category && (category.name || "Category");
    const items = Array.isArray(category.mods) ? category.mods : [];
    const itemRows = items
      .map((entry) => resolveBuildItemFromEntry(entry, itemMap))
      .filter(Boolean);

    return {
      name: categoryName,
      description: (category && category.description) || "",
      optional: isCategoryOptional(category, categoryName),
      items: itemRows,
      columnCount: Math.min(Math.max(itemRows.length, 1), perRow),
    };
  });
}

// =============================================================================
// ITEM RENDERING
// =============================================================================

/**
 * Renders a single item card HTML for a build category.
 *
 * @param {object} item - The item object.
 * @returns {string} HTML string.
 */
function renderBuildItemCard(item) {
  const tierLabel =
    item.tier > 0 && item.tier < ROMAN_TIERS.length
      ? ROMAN_TIERS[item.tier]
      : "";
  const tierClass =
    item.tier > 0 && item.tier < ROMAN_TIERS.length
      ? ` build-item-card--tier-${item.tier}`
      : "";
  const activeLabel = item.isActive
    ? `<span class="build-item-active">${getLocalText("build_item_active", "ATIVO")}</span>`
    : "";
  /* Infusion pill (shown whenever the API provides the flag) */
  const infuseLabel = item.canInfuse
    ? `<span class="build-item-pill build-item-pill--infuse">${getLocalText("build_item_infuse", "INFUNDIR")}</span>`
    : "";

  return `
    <li class="build-item-card ${slotTypeClass(item.slotType)}${tierClass}">
      ${tierLabel ? `<span class="build-item-tier"><span class="build-item-tier-num">${tierLabel}</span></span>` : ""}
      <span class="build-item-icon-wrap">
        <img class="build-item-icon" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />
      </span>
      ${activeLabel}${infuseLabel}
      <span class="build-item-name">${escapeHtml(item.name)}</span>
    </li>
  `;
}

/**
 * Renders a category box (with items grid) for a build.
 *
 * @param {object} category - The category object.
 * @returns {string} HTML string.
 */
function renderBuildCategoryBox(category) {
  const rawName = String(category.name || "").trim();
  const showName = rawName !== "" && rawName.toLowerCase() !== "category";
  const optionalBadge = category.optional
    ? `<span class="build-category-optional">${getLocalText("build_category_optional", "OPCIONAL")}</span>`
    : "";
  const description = category.description
    ? `<p class="build-category-description" title="${escapeHtml(category.description)}">${escapeHtml(category.description)}</p>`
    : "";

  /* Decorative slogan (when present, shop-stamp style) */
  const slogan = category.slogan
    ? `<span class="build-category-slogan">${escapeHtml(category.slogan)}</span>`
    : "";

  const itemsHtml = category.items.length
    ? category.items.map((item) => renderBuildItemCard(item)).join("")
    : `<li class="build-detail-empty" role="img" aria-label="${escapeHtml(t("no_data"))}">${t("no_data")}</li>`;

  const listLabel = showName ? category.name : category.description || "items";

  const headerHtml =
    showName || description
      ? `<div class="build-category-header">
          <div class="build-category-title-row">
            ${showName ? `<span class="build-category-name">${escapeHtml(category.name)}</span>` : ""}
            ${optionalBadge}
            ${description}
            ${slogan}
          </div>
        </div>`
      : "";

  const { size, gap, pad, border } = getBuildItemMetrics();
  const cols = Math.max(category.columnCount || 1, 1);
  const boxWidth = cols * size + (cols - 1) * gap + 2 * pad + 2 * border;

  return `
    <div class="build-item-category${category.optional ? " build-item-category--optional" : ""}${category.items.length === 0 ? " build-item-category--empty" : ""}" style="--category-cols: ${cols}; width: ${boxWidth}px">
      ${headerHtml}
      <ul class="build-category-items" aria-label="${escapeHtml(listLabel)}">
        ${itemsHtml}
      </ul>
    </div>
  `;
}

/**
 * Renders the entire item section of a build.
 *
 * @param {Array} itemCategories - Array of category objects.
 * @returns {string} HTML string.
 */
function renderBuildItemSection(itemCategories) {
  return itemCategories.length
    ? `<div class="build-categories-flow">${itemCategories.map((category) => renderBuildCategoryBox(category)).join("")}</div>`
    : `<p class="build-detail-empty">${t("no_data")}</p>`;
}

// =============================================================================
// BUILD PATH RENDERING
// =============================================================================

/**
 * Renders the full build path (items + skills) for an expanded build card.
 *
 * @param {object} build - The build object.
 * @param {HTMLElement} container - The container element.
 * @param {object} heroAsset - The hero asset.
 * @param {object} abilitiesById - Ability metadata keyed by class name.
 * @param {object} itemMap - The item map keyed by item ID.
 * @returns {string} HTML string.
 */
function renderBuildPath(build, container, heroAsset, abilitiesById, itemMap) {
  const map = safeGetItemMap(itemMap);
  const itemCategories = buildBuildItemCategories(build, map, container);
  const skillSequence = buildSkillSequence(build, heroAsset, abilitiesById);

  const itemSection = renderBuildItemSection(itemCategories);
  const skillSection = renderBuildSkillSection(skillSequence);

  const hasRealBuildData =
    itemCategories.length > 0 || skillSequence.length > 0;
  const rawDebug = !hasRealBuildData
    ? `<details class="build-raw-debug"><summary>Debug</summary><pre>${escapeHtml(JSON.stringify(build, null, 2))}</pre></details>`
    : "";

  return `
    <div class="build-detail-groups">
      <div class="build-detail-section build-items-panel">
        <h4>${getLocalText("build_items_section", "Items")}</h4>
        ${itemSection}
      </div>
      <div class="build-detail-section">
        <h4>${getLocalText("build_skill_path", "Skill Path")}</h4>
        ${skillSection}
      </div>
      ${rawDebug}
    </div>
  `;
}

/**
 * Re-renders all open build details on window resize to recalculate layout.
 * Dependencies captured at card creation time are re-used here.
 */
function rerenderOpenBuilds() {
  document
    .querySelectorAll(".build-card-details:not(.hidden)")
    .forEach((details) => {
      if (details.__build) {
        details.innerHTML = renderBuildPath(
          details.__build,
          details,
          details.__build.heroAsset,
          details.__abilitiesById,
          details.__itemMap,
        );
      }
    });
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "resize",
    debounce(rerenderOpenBuilds, CONSTANTS.RESIZE_DEBOUNCE_MS),
  );
  window.addEventListener(
    "resize",
    debounce(refreshBuildNameTooltips, CONSTANTS.RESIZE_DEBOUNCE_MS),
  );
}

// =============================================================================
// CARD LIST RENDERING
// =============================================================================

/**
 * Renders build cards for a given container and list of builds.
 *
 * @param {string} containerId - The DOM ID of the container.
 * @param {Array} builds - Array of build stat objects.
 * @param {string|number} heroId - The hero ID.
 * @param {object} heroAsset - The hero asset object.
 * @param {object} itemMap - The item map keyed by item ID.
 * @param {object} abilitiesById - Ability metadata keyed by class name.
 */
export function renderBuildCards(
  containerId,
  builds,
  heroId,
  heroAsset,
  itemMap,
  abilitiesById,
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (builds.length === 0) {
    container.innerHTML = `<p>${t("build_data_unavailable")}</p>`;
    return;
  }

  container.innerHTML = "";
  for (const build of builds) {
    const card = document.createElement("div");
    card.className = "build-card";
    const buildId = build.buildId ?? "?";
    const buildName = getBuildDisplayName(build);

    const nameHtml = buildName
      ? `<span class="build-name" data-build-name>${escapeHtml(buildName)}</span>`
      : `<span class="build-name build-name--placeholder" data-build-name>${escapeHtml(t("loading"))}</span>`;
    const idHtml = `<span class="build-id">${escapeHtml(t("build_id_label"))} ${escapeHtml(String(buildId))}</span>`;
    const winRateHtml =
      build.winRate != null
        ? `<span class="build-winrate">${escapeHtml(t("build_winrate_label"))} ${build.winRate.toFixed(1)}%</span>`
        : "";
    const matchesHtml =
      build.matches != null
        ? `<span class="build-matches">${escapeHtml(t("build_total_label"))} ${build.matches} ${escapeHtml(t("build_matches_label"))}</span>`
        : "";
    const sourceBadge = build.fromFallback
      ? `<span class="build-fav-badge">${getLocalText(
          "build_favorites_source",
          "TOP FAVORITOS",
        )}</span>`
      : "";
    const copyBtn =
      buildId !== "?"
        ? `<button type="button" class="build-copy-btn" title="${escapeHtml(t("build_copy_id"))}" aria-label="${escapeHtml(t("build_copy_id"))}">${COPY_ICON_SVG}</button>`
        : "";

    card.innerHTML = `
      <div class="build-card-summary">
        ${copyBtn}
        ${idHtml}
        ${nameHtml}
        ${winRateHtml}
        ${matchesHtml}
        ${sourceBadge}
      </div>
      <div class="build-card-details hidden"></div>
    `;

    const copyBtnEl = card.querySelector(".build-copy-btn");
    if (copyBtnEl) {
      copyBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        copyTextToClipboard(String(buildId), copyBtnEl);
      });
      copyBtnEl.addEventListener("keydown", (e) => e.stopPropagation());
    }

    const summary = card.querySelector(".build-card-summary");
    summary.tabIndex = 0;
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-expanded", "false");

    const toggle = async () => {
      const details = card.querySelector(".build-card-details");
      const isOpening = details.classList.contains("hidden");

      if (isOpening && details.innerHTML === "") {
        details.innerHTML = `<p>${t("loading")}</p>`;
        try {
          const actualBuild = await getOrFetchBuild(heroId, build.buildId);
          if (!actualBuild) {
            throw new Error("build payload empty");
          }
          const nameEl = card.querySelector("[data-build-name]");
          const realName = getBuildDisplayName(actualBuild);
          if (nameEl && realName) {
            nameEl.textContent = realName;
            nameEl.classList.remove("build-name--placeholder");
            updateBuildNameTooltip(nameEl);
          }
          details.__build = { ...build, actualBuild, heroAsset };
          details.__abilitiesById = abilitiesById;
          details.__itemMap = itemMap;
          details.innerHTML = renderBuildPath(
            details.__build,
            details,
            heroAsset,
            abilitiesById,
            itemMap,
          );
        } catch (err) {
          console.warn(`Failed to render build ${build.buildId}:`, err);
          details.innerHTML = `<p class="build-detail-error" role="alert">${escapeHtml(t("build_load_error"))}</p>`;
        }
      }

      if (isOpening) {
        /* Opening: measure the real height and animate 0 → scrollHeight. */
        details.classList.remove("hidden");
        const targetH = details.scrollHeight;
        details.style.maxHeight = "0px";
        details.style.opacity = "0";
        /* Force a reflow so the browser registers the starting 0px. */
        void details.offsetHeight;
        details.style.maxHeight = `${targetH}px`;
        details.style.opacity = "1";
        /* After the transition ends, drop the fixed max-height so the panel
           can resize freely (e.g., on window resize). */
        const onEnd = () => {
          details.style.maxHeight = "none";
          details.removeEventListener("transitionend", onEnd);
        };
        details.addEventListener("transitionend", onEnd);
      } else {
        /* Closing: fix the current height first, then animate down to 0. */
        const currentH = details.scrollHeight;
        details.style.maxHeight = `${currentH}px`;
        void details.offsetHeight;
        details.style.maxHeight = "0px";
        details.style.opacity = "0";
        details.classList.add("hidden");
      }

      summary.setAttribute("aria-expanded", String(isOpening));
      // If loading failed, clear the error so reopening retries.
      if (!isOpening && details.querySelector(".build-detail-error")) {
        details.innerHTML = "";
      }
    };

    summary.addEventListener("click", toggle);
    summary.addEventListener("keydown", (e) => {
      if (e.target !== summary) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    container.appendChild(card);
    updateBuildNameTooltip(card.querySelector("[data-build-name]"));

    // Fill the author-provided build name in the background when the
    // analytics payload did not include it.
    fillBuildName(build, card, heroId);
  }
}
