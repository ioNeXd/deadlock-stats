// =============================================================================
// HERO DETAIL MODULE
// Page-level orchestrator for the hero detail view: fetches all data in
// parallel, renders the header, and wires up the two build lists (most
// popular / highest win rate) via a single shared setup helper.
// =============================================================================

import { CONSTANTS } from "./constants.js";
import { applyTranslations, t } from "./i18n.js";
import { navigateToTable } from "./router.js";
import {
  getAbilitiesByClass,
  getHeroBuildStats,
  getHeroesById,
  getItemsById,
} from "./api.js";
import { escapeHtml, isValidHeroId } from "./utils.js";
import { renderBuildCards } from "./build-cards.js";

/**
 * Renders one build list section: sorts + slices the builds, renders the
 * cards, and manages its retry button (removed when the list has data;
 * wired to refetch the full build list otherwise).
 *
 * @param {object} options - Section configuration.
 * @param {string} options.listId - DOM ID of the build list container.
 * @param {string} options.retryId - DOM ID of the section's retry button.
 * @param {Array} options.builds - Build stats available for this section.
 * @param {Function} options.sortBy - Comparator used to order the builds.
 * @param {string|number} options.heroId - The hero ID.
 * @param {object} options.hero - The hero asset object.
 * @param {object} options.itemMap - Item map keyed by item ID.
 * @param {object} options.abilitiesById - Abilities keyed by class name.
 */
function initBuildSection({
  listId,
  retryId,
  builds,
  sortBy,
  heroId,
  hero,
  itemMap,
  abilitiesById,
}) {
  const renderList = (source) =>
    renderBuildCards(
      listId,
      [...source].sort(sortBy).slice(0, CONSTANTS.MAX_BUILDS_PER_LIST),
      heroId,
      hero,
      itemMap,
      abilitiesById,
    );

  const removeRetryButton = () => {
    const btn = document.getElementById(retryId);
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  };

  const sorted = [...builds]
    .sort(sortBy)
    .slice(0, CONSTANTS.MAX_BUILDS_PER_LIST);
  renderList(builds);

  const retryBtn = document.getElementById(retryId);
  if (sorted.length > 0 || !retryBtn) {
    removeRetryButton();
    return;
  }

  retryBtn.addEventListener("click", async () => {
    const fresh = await getHeroBuildStats(heroId);
    renderList(fresh);
    removeRetryButton();
  });
}

/**
 * Renders the hero detail page: header plus the popular and win-rate build
 * sections.
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
    // Busca só heroesById primeiro para verificar se o herói existe
    const heroesById = await getHeroesById();

    // Se o herói não for encontrado no mapa (ID inválido), mostra erro e volta para tabela
    if (!heroesById[heroId]) {
      container.innerHTML = `<p>${t("error_fetching_data")}</p>`;
      const backBtn = document.createElement("button");
      backBtn.textContent = t("back_to_table");
      backBtn.className = "btn-action";
      backBtn.addEventListener("click", () => navigateToTable());
      container.appendChild(backBtn);
      return;
    }

    // Busca os dados restantes em paralelo
    const [buildStats, itemMap, abilitiesById] = await Promise.all([
      getHeroBuildStats(heroId),
      getItemsById(),
      getAbilitiesByClass(),
    ]);

    const hero = heroesById[heroId];
    const heroName = hero ? hero.name : `Hero #${heroId}`;
    const heroIcon =
      (hero && hero.images && hero.images.icon_image_small) || "";
    // Name wordmark SVG (same source field used by the table:
    // entity.raw.images.name_image).
    const heroNameImage =
      (hero && hero.raw && hero.raw.images && hero.raw.images.name_image) || "";

    container.innerHTML = `
      <div class="hero-detail-header">
        <img src="${escapeHtml(heroIcon)}" width="64" alt="${escapeHtml(heroName)}">
        ${
          heroNameImage
            ? `<img class="name-plate name-plate--detail" src="${escapeHtml(heroNameImage)}" alt="${escapeHtml(heroName)}">`
            : `<h2>${escapeHtml(heroName)}</h2>`
        }
      </div>

      <section class="build-section">
        <h3 data-i18n="builds_popular">Most Popular Builds</h3>
        <button id="retry-builds-popular" class="btn-action" data-i18n="try_again">Try again</button>
        <div class="build-list" id="build-list-popular"></div>
      </section>

      <section class="build-section">
        <h3 data-i18n="builds_winrate">Highest Win Rate Builds</h3>
        <button id="retry-builds-winrate" class="btn-action" data-i18n="try_again">Try again</button>
        <div class="build-list" id="build-list-winrate"></div>
      </section>
    `;

    const shared = { heroId, hero, itemMap, abilitiesById };
    initBuildSection({
      ...shared,
      listId: "build-list-popular",
      retryId: "retry-builds-popular",
      builds: buildStats,
      sortBy: (a, b) => b.matches - a.matches,
    });
    initBuildSection({
      ...shared,
      listId: "build-list-winrate",
      retryId: "retry-builds-winrate",
      builds: buildStats,
      sortBy: (a, b) => b.winRate - a.winRate,
    });

    applyTranslations();

    if (heroNameImage) {
      const namePlateEl = container.querySelector(
        ".hero-detail-header .name-plate",
      );
      if (namePlateEl) {
        // If the name SVG fails to load, fall back to a plain text heading.
        namePlateEl.addEventListener("error", () => {
          const h2 = document.createElement("h2");
          h2.textContent = heroName;
          namePlateEl.replaceWith(h2);
        });
      }
    }
  } catch (err) {
    console.error("Failed to render hero detail:", err);
    container.innerHTML = `<p>${t("error_fetching_data")}</p>`;
  }
}
