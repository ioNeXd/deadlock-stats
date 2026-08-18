// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

import { CONSTANTS } from "./constants.js";
import { applyTranslations, getLocalText, t } from "./i18n.js";
import {
  getAbilitiesByClass,
  getBuildById,
  getHeroBuildStats,
  getHeroesById,
  getItemsById,
  resolveEntityImage,
} from "./api.js";
import { debounce, escapeHtml, isValidHeroId, TTLCache } from "./utils.js";
import { SKILL_KEY_OVERRIDES, SKILL_SECTIONS } from "./skill-sections-data.js";

// Module-private caches (previously exposed as window.__* globals).
let itemMapCache = {};
let abilityMapCache = {};
let skillTooltips = {};

const ROMAN_TIERS = ["", "I", "II", "III", "IV"];

// Inline SVG icon (content_copy) used by the build ID copy button.
const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;

// Build cache: expanded build payloads with TTL (5 min by default)
const buildCache = new TTLCache(CONSTANTS.BUILD_CACHE_TTL_MS);



// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Returns a safe item map object, defaulting to an empty object if invalid.
 *
 * @param {*} itemMap - The item map to validate.
 * @returns {Object} A valid object map.
 */
/**
 * Resolves the author-provided build name from a build object, checking
 * both the list stat and the published/fallback payload.
 *
 * @param {object} build - The build stat object.
 * @returns {string} The build name or an empty string.
 */
function getBuildDisplayName(build) {
  return (
    build &&
    (build.name ||
      (build.publishedBuild && build.publishedBuild.name) ||
      (build.actualBuild && build.actualBuild.name) ||
      "")
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
  } catch (e) {
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
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {
      ok = false;
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
  }, 1500);
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
  }, 1400);
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
 * expose the build ID). The result is also stored in the build cache so
 * expanding the card reuses it.
 *
 * @param {object} build - The build stat object.
 * @param {HTMLElement} card - The build card element.
 * @param {string|number} heroId - The hero ID.
 * @returns {Promise<void>}
 */
async function fillBuildName(build, card, heroId) {
  if (getBuildDisplayName(build)) return;
  if (build.buildId == null) return;
  const cacheKey = `${heroId}:${build.buildId}`;
  let actualBuild = buildCache.get(cacheKey);
  if (actualBuild === undefined) {
    try {
      actualBuild = await getBuildById(build.buildId, heroId);
    } catch (e) {
      actualBuild = null;
    }
    if (actualBuild) buildCache.set(cacheKey, actualBuild);
  }
  const nameEl = card.querySelector("[data-build-name]");
  if (!nameEl) return;
  const name = getBuildDisplayName(actualBuild);
  nameEl.textContent = name || `Build #${build.buildId}`;
  nameEl.classList.remove("build-name--placeholder");
  updateBuildNameTooltip(nameEl);
}

function safeGetItemMap(itemMap) {
  return itemMap && typeof itemMap === "object" ? itemMap : {};
}

/**
 * Returns a CSS class for the item slot type.
 *
 * @param {string} slotType - The slot type string.
 * @returns {string} A CSS class name.
 */
function slotTypeClass(slotType) {
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
function isCategoryOptional(category, categoryName) {
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
  const available = listWidth - 30 - 12;
  return Math.max(1, Math.floor((available + gap) / (size + gap)));
}

/**
 * Resolves an item entry from a build category into a displayable item object.
 *
 * @param {object} entry - The raw entry.
 * @param {object} itemMap - The item map by ID.
 * @returns {object|null} A normalized item object or null.
 */
function resolveBuildItemFromEntry(entry, itemMap) {
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
  };
}

/**
 * Resolves the source of build details (mod categories and skill changes).
 *
 * @param {object} build - The build object.
 * @returns {{modCategories: Array, skillChanges: Array, heroBuild: object}}
 */
function resolveBuildDetailSource(build) {
  const empty = { modCategories: [], skillChanges: [], heroBuild: {} };
  if (!build || typeof build !== "object") return empty;

  const source = build.publishedBuild || build.actualBuild || build;
  if (!source || typeof source !== "object") return empty;

  const raw =
    source.raw && typeof source.raw === "object" ? source.raw : {};
  const candidate =
    source.hero_build ||
    source.build ||
    raw.hero_build ||
    raw.build ||
    {};
  const details =
    (candidate && typeof candidate === "object" ? candidate.details : null) ||
    source.details ||
    {};
  const modCategories = Array.isArray(details.mod_categories)
    ? details.mod_categories
    : Array.isArray(source.mod_categories)
      ? source.mod_categories
      : [];

  const detailSkillChanges =
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
      ? details.ability_order.currency_changes
      : [];
  const sourceSkillChanges =
    source.ability_order &&
    Array.isArray(source.ability_order.currency_changes)
      ? source.ability_order.currency_changes
      : [];

  return {
    modCategories,
    skillChanges: detailSkillChanges.length
      ? detailSkillChanges
      : sourceSkillChanges,
    heroBuild: candidate,
  };
}

/**
 * Checks if a build source contains an ability order.
 *
 * @param {object} source - The build source.
 * @returns {boolean} True if ability order exists.
 */
function detailHasAbilityOrder(source) {
  if (!source || typeof source !== "object") return false;
  const details =
    source.details || (source.hero_build && source.hero_build.details) || {};
  return !!(details.ability_order &&
    Array.isArray(details.ability_order.currency_changes));
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
  const { modCategories } = resolveBuildDetailSource(build);
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

/**
 * Builds the skill sequence (level-up order) from a build, mapping to hero abilities.
 *
 * @param {object} build - The build object.
 * @param {object} heroAsset - The hero asset object.
 * @returns {Array} Array of skill step objects.
 */
function buildSkillSequence(build, heroAsset) {
  const { skillChanges } = resolveBuildDetailSource(build);
  if (!Array.isArray(skillChanges) || skillChanges.length === 0) return [];

  const points = skillChanges.slice(0, 16);

  const abilityMap = abilityMapCache || {};
  const heroItems =
    heroAsset && heroAsset.raw && heroAsset.raw.items
      ? heroAsset.raw.items
      : {};
  const idToSlot = {};
  ["signature1", "signature2", "signature3", "signature4"].forEach(
    (key, i) => {
      const cls = heroItems[key];
      const entry = cls && abilityMap[cls];
      if (entry && entry.id != null) {
        idToSlot[entry.id] = {
          slot: i + 1,
          name: entry.name || cls,
          image: entry.image || "",
          description: entry.description || "",
          stats: Array.isArray(entry.stats) ? entry.stats : [],
        };
      }
    },
  );

  return points.map((entry, index) => {
    const abilityId = Number(entry && (entry.ability_id ?? entry.id ?? 0));
    const info = idToSlot[abilityId] || {
      slot: null,
      name: `Ability #${abilityId}`,
    };
    return {
      id: abilityId,
      slot: info.slot,
      name: info.name,
      image: info.image || "",
      description: info.description || "",
      stats: info.stats || [],
      level: Math.abs(Number(entry && entry.delta) || 0),
      bonus: Number(entry && entry.currency_type) === 2,
      order: index + 1,
    };
  });
}

/**
 * Classifies skill stats into sections based on overrides, explicit keys, and css classes.
 *
 * @param {Array} stats - Array of stat objects.
 * @returns {Array} Array of sections with their stats.
 */
function classifySkillStats(stats) {
  const sections = SKILL_SECTIONS.map((sec) => ({ ...sec, stats: [] }));
  const byId = new Map(sections.map((s) => [s.id, s]));
  for (const stat of stats) {
    let secId = SKILL_KEY_OVERRIDES[stat.key];
    if (!secId) {
      const byKey = sections.find((s) => s.keys.includes(stat.key));
      if (byKey) secId = byKey.id;
    }
    if (!secId) {
      const byCss = sections.find((s) => s.css.includes(stat.cssClass));
      if (byCss) secId = byCss.id;
    }
    byId.get(secId || "extra").stats.push(stat);
  }
  for (const sec of sections) {
    if (!sec.stats.length) continue;
    const ordered = [];
    for (const key of sec.keys) {
      const i = sec.stats.findIndex((s) => s.key === key);
      if (i !== -1) ordered.push(sec.stats.splice(i, 1)[0]);
    }
    sec.stats = ordered.concat(sec.stats);
  }
  return sections.filter((s) => s.stats.length);
}

// =============================================================================
// RENDER HELPERS
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

  return `
    <li class="build-item-card ${slotTypeClass(item.slotType)}${tierClass}">
      ${tierLabel ? `<span class="build-item-tier"><span class="build-item-tier-num">${tierLabel}</span></span>` : ""}
      <span class="build-item-icon-wrap">
        <img class="build-item-icon" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />
      </span>
      ${activeLabel}
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

  const itemsHtml = category.items.length
    ? category.items.map((item) => renderBuildItemCard(item)).join("")
    : `<li class="build-detail-empty" role="img" aria-label="${escapeHtml(t("no_data"))}">${t("no_data")}</li>`;

  const listLabel = showName
    ? category.name
    : category.description || "items";

  const headerHtml =
    showName || description
      ? `<div class="build-category-header">
          <div class="build-category-title-row">
            ${showName ? `<span class="build-category-name">${escapeHtml(category.name)}</span>` : ""}
            ${optionalBadge}
            ${description}
          </div>
        </div>`
      : "";

  const { size, gap, pad, border } = getBuildItemMetrics();
  const cols = Math.max(category.columnCount || 1, 1);
  const boxWidth =
    cols * size + (cols - 1) * gap + 2 * pad + 2 * border;

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

/**
 * Returns the icon <img> for a stat, or an empty string when absent.
 *
 * @param {object} s - The stat object (may be null).
 * @returns {string} HTML string.
 */
function statIconHtml(s) {
  return s && s.icon
    ? `<img class="skill-tooltip-stat-icon" src="${escapeHtml(s.icon)}" alt="" loading="lazy" decoding="async">`
    : "";
}

/**
 * Renders a single stat row (icon + label + value) inside a section block.
 *
 * @param {object} s - The stat object.
 * @returns {string} HTML string.
 */
function skillTooltipRowHtml(s) {
  return `<div class="skill-tooltip-row">${statIconHtml(s)}<span class="skill-tooltip-stat-label">${escapeHtml(s.label)}</span><b class="skill-tooltip-stat-value">${escapeHtml(s.value)}</b></div>`;
}

/**
 * Generates HTML for a skill tooltip section (badges or rows).
 *
 * @param {object} sec - The section object with stats.
 * @returns {string} HTML string.
 */
function skillTooltipSectionHtml(sec) {
  if (sec.mode === "badge") {
    return `<span class="skill-tooltip-badges">${sec.stats
      .map(
        (s) =>
          `<span class="skill-tooltip-badge">${statIconHtml(s)}<b>${escapeHtml(s.value)}</b></span>`,
      )
      .join("")}</span>`;
  }
  return `<div class="skill-tooltip-section"><span class="skill-tooltip-section-title">${escapeHtml(t(sec.titleKey))}</span><div class="skill-tooltip-block">${sec.stats.map(skillTooltipRowHtml).join("")}</div></div>`;
}

/**
 * Generates the complete skill tooltip HTML for a row.
 *
 * @param {object} row - The skill row data.
 * @returns {string} HTML string.
 */
function buildSkillTooltipHtml(row) {
  const stats = Array.isArray(row.stats) ? row.stats : [];
  const sections = classifySkillStats(stats);
  const byId = new Map(sections.map((s) => [s.id, s]));

  const icon = row.image
    ? `<img class="skill-tooltip-icon" src="${escapeHtml(row.image)}" alt="" decoding="async">`
    : "";
  const badges = byId.get("badges");
  const head = `<div class="skill-tooltip-head">${icon}<span class="skill-tooltip-name">${escapeHtml(row.name)}</span>${badges ? skillTooltipSectionHtml(badges) : ""}</div>`;

  const desc = row.description
    ? `<p class="skill-tooltip-desc">${escapeHtml(row.description).replace(/\n/g, "<br>")}</p>`
    : "";

  const body = sections.filter((s) => s.id !== "badges");
  return [head, desc, ...body.map(skillTooltipSectionHtml)].join("");
}

/**
 * Positions the skill tooltip near the cursor, flipping if out of viewport.
 *
 * @param {HTMLElement} tip - The tooltip element.
 * @param {number} x - Cursor X position.
 * @param {number} y - Cursor Y position.
 */
function positionSkillTooltip(tip, x, y) {
  const pad = 14;
  const rect = tip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + rect.width > window.innerWidth - 8) {
    left = Math.max(8, x - rect.width - pad);
  }
  if (top + rect.height > window.innerHeight - 8) {
    top = Math.max(8, y - rect.height - pad);
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/**
 * Ensures the skill tooltip element exists and sets up delegated event listeners.
 *
 * @returns {HTMLElement} The tooltip element.
 */
function ensureSkillTooltip() {
  let tip = document.getElementById("skill-tooltip");
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "skill-tooltip";
  tip.className = "skill-tooltip";
  tip.hidden = true;
  document.body.appendChild(tip);

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest("[data-skill-tooltip]");
    if (!el) return;
    const html =
      skillTooltips && skillTooltips[el.dataset.skillTooltip];
    if (!html) return;
    tip.innerHTML = html;
    tip.hidden = false;
    positionSkillTooltip(tip, skillTipX, skillTipY);
  });
  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest && e.target.closest("[data-skill-tooltip]");
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) {
      tip.hidden = true;
    }
  });
  document.addEventListener("mousemove", (e) => {
    skillTipX = e.clientX;
    skillTipY = e.clientY;
    if (!tip.hidden) positionSkillTooltip(tip, skillTipX, skillTipY);
  });
  return tip;
}

// Cursor tracking for tooltip positioning.
let skillTipX = 0;
let skillTipY = 0;

/**
 * Renders the skill path (ability leveling sequence) section.
 *
 * @param {Array} skillSequence - Array of skill step objects.
 * @returns {string} HTML string.
 */
function renderBuildSkillSection(skillSequence) {
  if (!skillSequence.length) {
    return `<p class="build-detail-empty">${t("no_data")}</p>`;
  }

  const bySlot = new Map();
  for (const step of skillSequence) {
    if (step.slot == null) continue;
    if (!bySlot.has(step.slot)) {
      bySlot.set(step.slot, {
        slot: step.slot,
        name: step.name,
        image: step.image || "",
        description: step.description || "",
        stats: step.stats || [],
        markers: [],
      });
    }
    bySlot.get(step.slot).markers.push(step);
  }
  const rows = [];
  for (let slot = 1; slot <= 4; slot += 1) {
    if (bySlot.has(slot)) rows.push(bySlot.get(slot));
  }

  if (rows.length === 0) {
    return `<ol class="build-skill-list">${skillSequence
      .map(
        (step) => `
    <li class="build-skill-item">
      <span class="build-detail-number">${step.order}</span>
      <span class="build-detail-name">${escapeHtml(step.name)}</span>
    </li>
  `,
      )
      .join("")}</ol>`;
  }

  skillTooltips = skillTooltips || {};

  const rowsHtml = rows
    .map((row) => {
      skillTooltips[row.slot] = buildSkillTooltipHtml(row);

      const markers = row.markers
        .map((m) => {
          const col = Math.min(Math.max(m.order || 1, 1), 16);
          if (m.bonus) {
            return `<span class="skill-path-marker skill-path-marker--bonus" style="grid-column: ${col}"><span class="skill-path-marker-badge"><img class="skill-path-marker-icon skill-path-marker-icon--unlock" src="assets/images/hud/levelup_unlock_icon.svg" alt="" decoding="async"></span></span>`;
          }
          return `<span class="skill-path-marker" style="grid-column: ${col}"><span class="skill-path-marker-badge"><img class="skill-path-marker-icon" src="assets/images/hud/levelup_ap_icon.svg" alt="" decoding="async"><span class="skill-path-marker-num">${m.level || ""}</span></span></span>`;
        })
        .join("");
      const icon = row.image
        ? `<img class="skill-path-icon" src="${escapeHtml(row.image)}" alt="" loading="lazy" decoding="async">`
        : "";
      const hasTooltip = row.description || (row.stats && row.stats.length);
      const tipAttr = hasTooltip ? ` data-skill-tooltip="${row.slot}"` : "";
      return `
    <div class="skill-path-row">
      <div class="skill-path-ability"${tipAttr}>
        <span class="skill-path-slot skill-path-slot--${row.slot}">${row.slot}</span>
        ${icon}
        <span class="skill-path-name">${escapeHtml(row.name)}</span>
      </div>
      <div class="skill-path-track">${markers}</div>
    </div>
  `;
    })
    .join("");

  ensureSkillTooltip();

  return `<div class="skill-path-panel">${rowsHtml}</div>`;
}

/**
 * Renders the full build path (items + skills) for an expanded build card.
 *
 * @param {object} build - The build object.
 * @param {HTMLElement} container - The container element.
 * @param {object} heroAsset - The hero asset.
 * @returns {string} HTML string.
 */
function renderBuildPath(build, container, heroAsset) {
  const itemMap = safeGetItemMap(itemMapCache);
  const itemCategories = buildBuildItemCategories(build, itemMap, container);
  const skillSequence = buildSkillSequence(build, heroAsset);

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
 * Re-renders all open build details on window resize to recalculate column layout.
 */
function rerenderOpenBuilds() {
  document.querySelectorAll(".build-card-details:not(.hidden)").forEach((details) => {
    if (details.__build) {
      details.innerHTML = renderBuildPath(
        details.__build,
        details,
        details.__build.heroAsset,
      );
    }
  });
}

window.addEventListener("resize", debounce(rerenderOpenBuilds, 150));
window.addEventListener("resize", debounce(refreshBuildNameTooltips, 150));

// =============================================================================
// MAIN RENDER FUNCTIONS
// =============================================================================

/**
 * Renders the hero detail page: header, popular builds, and win-rate builds.
 *
 * @param {string|number} heroId - The hero ID.
 * @returns {Promise<void>}
 */
export async function renderHeroDetail(heroId) {
  const container = document.getElementById("hero-detail-content");
  if (!container) return;

  if (!isValidHeroId(heroId)) return;

  container.innerHTML = `<p>${t("loading")}</p>`;

  try {
    const [heroesById, buildStats, itemMap, abilityMap] = await Promise.all([
      getHeroesById(),
      getHeroBuildStats(heroId),
      getItemsById(),
      getAbilitiesByClass(),
    ]);

    itemMapCache = safeGetItemMap(itemMap);
    abilityMapCache =
      abilityMap && typeof abilityMap === "object" ? abilityMap : {};
    buildCache.clear();

    const hero = heroesById[heroId];
    const heroName = hero ? hero.name : `Hero #${heroId}`;
    const heroIcon =
      (hero && hero.images && hero.images.icon_image_small) || "";

    const maxBuilds = CONSTANTS.MAX_BUILDS_PER_LIST;
    const byPopularity = [...buildStats]
      .sort((a, b) => b.matches - a.matches)
      .slice(0, maxBuilds);
    const byWinRate = [...buildStats]
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, maxBuilds);

    container.innerHTML = `
      <div class="hero-detail-header">
        <img src="${escapeHtml(heroIcon)}" width="64" alt="${escapeHtml(heroName)}">
        <h2>${escapeHtml(heroName)}</h2>
      </div>

      <section class="build-section">
        <h3 data-i18n="builds_popular">Most Popular Builds</h3>
        <button id="retry-builds-popular" class="error-retry" data-i18n="try_again">Try again</button>
        <div class="build-list" id="build-list-popular"></div>
      </section>

      <section class="build-section">
        <h3 data-i18n="builds_winrate">Highest Win Rate Builds</h3>
        <button id="retry-builds-winrate" class="error-retry" data-i18n="try_again">Try again</button>
        <div class="build-list" id="build-list-winrate"></div>
      </section>
    `;

    renderBuildCards("build-list-popular", byPopularity, heroId, hero);
    renderBuildCards("build-list-winrate", byWinRate, heroId, hero);
    applyTranslations();

    if (buildStats.length === 0) {
      const popular = document.getElementById("build-list-popular");
      const winrate = document.getElementById("build-list-winrate");
      if (popular) popular.innerHTML = `<p>${t("no_data")}</p>`;
      if (winrate) winrate.innerHTML = `<p>${t("no_data")}</p>`;
    }

    const retryPopular = document.getElementById("retry-builds-popular");
    const retryWin = document.getElementById("retry-builds-winrate");

    if (byPopularity && byPopularity.length > 0) {
      if (retryPopular && retryPopular.parentNode)
        retryPopular.parentNode.removeChild(retryPopular);
    } else {
      if (retryPopular)
        retryPopular.addEventListener("click", async () => {
          const builds = await getHeroBuildStats(heroId);
          renderBuildCards(
            "build-list-popular",
            builds
              .sort((a, b) => b.matches - a.matches)
              .slice(0, CONSTANTS.MAX_BUILDS_PER_LIST),
            heroId,
            hero,
          );
          const btn = document.getElementById("retry-builds-popular");
          if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        });
    }

    if (byWinRate && byWinRate.length > 0) {
      if (retryWin && retryWin.parentNode)
        retryWin.parentNode.removeChild(retryWin);
    } else {
      if (retryWin)
        retryWin.addEventListener("click", async () => {
          const builds = await getHeroBuildStats(heroId);
          renderBuildCards(
            "build-list-winrate",
            builds
              .sort((a, b) => b.winRate - a.winRate)
              .slice(0, CONSTANTS.MAX_BUILDS_PER_LIST),
            heroId,
            hero,
          );
          const btn = document.getElementById("retry-builds-winrate");
          if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        });
    }
  } catch (err) {
    console.error("Failed to render hero detail:", err);
    container.innerHTML = `<p>${t("error_fetching_data")}</p>`;
  }
}

/**
 * Renders build cards for a given container and list of builds.
 *
 * @param {string} containerId - The DOM ID of the container.
 * @param {Array} builds - Array of build stat objects.
 * @param {string|number} heroId - The hero ID.
 * @param {object} heroAsset - The hero asset object.
 */
function renderBuildCards(containerId, builds, heroId, heroAsset) {
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
      if (details.classList.contains("hidden") && details.innerHTML === "") {
        details.innerHTML = `<p>${t("loading")}</p>`;
        try {
          const cacheKey = `${heroId}:${build.buildId}`;
          let actualBuild = buildCache.get(cacheKey);
          if (actualBuild === undefined) {
            actualBuild = await getBuildById(build.buildId, heroId);
            if (actualBuild) buildCache.set(cacheKey, actualBuild);
          }
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
          details.innerHTML = renderBuildPath(details.__build, details, heroAsset);
        } catch (err) {
          console.warn(`Failed to render build ${build.buildId}:`, err);
          details.innerHTML = `<p class="build-detail-error" role="alert">${escapeHtml(t("build_load_error"))}</p>`;
        }
      }
      details.classList.toggle("hidden");
      summary.setAttribute("aria-expanded", String(!details.classList.contains("hidden")));
      // If loading failed, clear the error so reopening retries.
      if (
        details.classList.contains("hidden") &&
        details.querySelector(".build-detail-error")
      ) {
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