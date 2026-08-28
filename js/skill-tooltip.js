// =============================================================================
// SKILL PATH & TOOLTIP MODULE
// Renders the hero build skill path (ability level-up timeline) and the
// hover tooltip with per-ability stats grouped into property sections.
// =============================================================================

import { CONSTANTS } from "./constants.js";
import { t } from "./i18n.js";
import { escapeHtml } from "./utils.js";
import { SKILL_KEY_OVERRIDES, SKILL_SECTIONS } from "./skill-sections-data.js";
import { resolveBuildDetails } from "./build-cards.js";

const SIGNATURE_SLOTS = [
  "signature1",
  "signature2",
  "signature3",
  "signature4",
];

/**
 * Tooltip HTML keyed by ability slot number. Cleared on every render so
 * entries never leak across hero navigations.
 */
let skillTooltips = {};

// Cursor tracking for tooltip positioning.
let skillTipX = 0;
let skillTipY = 0;

// =============================================================================
// SEQUENCE RESOLUTION
// =============================================================================

/**
 * Builds the skill sequence (level-up order) from a build, mapping ability
 * IDs to the hero's signature slots via the provided abilities-by-class map.
 *
 * @param {object} build - The build object.
 * @param {object} heroAsset - The hero asset object.
 * @param {object} abilitiesById - Ability metadata keyed by class name.
 * @returns {Array} Array of skill step objects.
 */
export function buildSkillSequence(build, heroAsset, abilitiesById) {
  const { skillChanges } = resolveBuildDetailSource(build);
  if (!Array.isArray(skillChanges) || skillChanges.length === 0) return [];

  const points = skillChanges.slice(0, CONSTANTS.SKILL_PATH_COLUMNS);

  const byClass =
    abilitiesById && typeof abilitiesById === "object" ? abilitiesById : {};
  const heroItems =
    heroAsset && heroAsset.raw && heroAsset.raw.items
      ? heroAsset.raw.items
      : {};
  const idToSlot = {};
  SIGNATURE_SLOTS.forEach((key, i) => {
    const cls = heroItems[key];
    const entry = byClass[cls];
    if (entry && entry.id != null) {
      idToSlot[entry.id] = {
        slot: i + 1,
        name: entry.name || cls,
        image: entry.image || "",
        description: entry.description || "",
        stats: Array.isArray(entry.stats) ? entry.stats : [],
      };
    }
  });

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
 * Resolves skill changes (currency_changes) from a build using the
 * shared resolveBuildDetails helper.
 *
 * @param {object} build - The build object.
 * @returns {{skillChanges: Array}} The resolved skill changes.
 */
function resolveBuildDetailSource(build) {
  const details = resolveBuildDetails(build);
  const detailSkillChanges =
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
      ? details.ability_order.currency_changes
      : [];
  // Fallback: check source.ability_order directly
  const source = build && (build.publishedBuild || build.actualBuild || build);
  const sourceSkillChanges =
    source &&
    source.ability_order &&
    Array.isArray(source.ability_order.currency_changes)
      ? source.ability_order.currency_changes
      : [];
  return {
    skillChanges: detailSkillChanges.length
      ? detailSkillChanges
      : sourceSkillChanges,
  };
}

// =============================================================================
// STAT CLASSIFICATION
// =============================================================================

/**
 * Classifies skill stats into sections based on overrides, explicit keys,
 * and css classes.
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
// TOOLTIP RENDERING
// =============================================================================

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
 * Ensures the skill tooltip element exists and sets up delegated event
 * listeners.
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
    const html = skillTooltips[el.dataset.skillTooltip];
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

// =============================================================================
// SKILL PATH RENDERING
// =============================================================================

/**
 * Renders the skill path (ability leveling sequence) section.
 *
 * @param {Array} skillSequence - Array of skill step objects.
 * @returns {string} HTML string.
 */
export function renderBuildSkillSection(skillSequence) {
  // Reset per-render so tooltips from a previously viewed hero are dropped.
  skillTooltips = {};

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

  const columns = CONSTANTS.SKILL_PATH_COLUMNS;

  const rowsHtml = rows
    .map((row) => {
      skillTooltips[row.slot] = buildSkillTooltipHtml(row);

      const markersByCol = {};
      for (const m of row.markers) {
        const col = Math.min(Math.max(m.order || 1, 1), columns);
        markersByCol[col] = m;
      }
      const markers = Array.from({ length: columns }, (_, i) => {
        const col = i + 1;
        const m = markersByCol[col];
        const last = col === columns ? " skill-path-col--last" : "";
        if (!m) {
          return `<div class="skill-path-col${last}" style="grid-column:${col}"></div>`;
        }
        if (m.bonus) {
          return `<div class="skill-path-col${last}" style="grid-column:${col}"><span class="skill-path-marker skill-path-marker--bonus"><span class="skill-path-marker-badge"><img class="skill-path-marker-icon skill-path-marker-icon--unlock" src="assets/images/hud/levelup_unlock_icon.svg" alt="" decoding="async"></span></span></div>`;
        }
        return `<div class="skill-path-col${last}" style="grid-column:${col}"><span class="skill-path-marker"><span class="skill-path-marker-badge"><img class="skill-path-marker-icon" src="assets/images/hud/levelup_ap_icon.svg" alt="" decoding="async"><span class="skill-path-marker-num">${m.level || ""}</span></span></span></div>`;
      }).join("");
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
      <div class="skill-path-track" style="--skill-path-columns: ${columns}">${markers}</div>
    </div>
  `;
    })
    .join("");

  ensureSkillTooltip();

  return `<div class="skill-path-panel">
      <div class="skill-path-body">${rowsHtml}</div>
    </div>`;
}
