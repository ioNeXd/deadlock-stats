function formatNetWorth(value) {
  const num = Number(value) || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return `${Math.round(num)}`;
}

function buildItemTimeline(itemFlow, itemMap) {
  if (
    !itemFlow ||
    !Array.isArray(itemFlow.nodes) ||
    itemFlow.nodes.length === 0
  ) {
    return [];
  }

  return itemFlow.nodes
    .map((node) => {
      const itemId = Number(node.item_id);
      const item = itemMap[itemId] || { name: `Item #${itemId}` };
      return {
        id: itemId,
        name: item.name || `Item #${itemId}`,
        column: Number(node.column) || 0,
        matches: Number(node.matches) || 0,
        avgNetWorthAtBuy: Number(node.avg_net_worth_at_buy) || 0,
      };
    })
    .sort((a, b) => a.column - b.column || b.matches - a.matches);
}

function buildSkillTimeline(abilityOrderStats, itemMap) {
  if (!Array.isArray(abilityOrderStats) || abilityOrderStats.length === 0) {
    return [];
  }

  const best = [...abilityOrderStats].sort(
    (a, b) => (Number(b.matches) || 0) - (Number(a.matches) || 0),
  )[0];
  const sequence = Array.isArray(best && best.abilities) ? best.abilities : [];

  return sequence.map((abilityId, index) => {
    const item = itemMap[Number(abilityId)] || {
      name: `Ability #${abilityId}`,
    };
    return {
      id: Number(abilityId),
      name: item.name || `Ability #${abilityId}`,
      order: index + 1,
    };
  });
}

async function renderHeroDetail(heroId) {
  const container = document.getElementById("hero-detail-content");
  if (!container) return;

  container.innerHTML = `<p>${t("loading")}</p>`;

  try {
    const [heroesById, buildStats, itemMap] = await Promise.all([
      getHeroesById(),
      getHeroBuildStats(heroId),
      getItemsById(),
    ]);

    window.__itemMap = itemMap || {};

    const hero = heroesById[heroId];
    const heroName = hero ? hero.name : `Hero #${heroId}`;
    const heroIcon =
      (hero && hero.images && hero.images.icon_image_small) || "";

    const byPopularity = [...buildStats]
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 3);
    const byWinRate = [...buildStats]
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3);

    container.innerHTML = `
      <div class="hero-detail-header">
        <img src="${heroIcon}" width="64" alt="${heroName}">
        <h2>${heroName}</h2>
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

    renderBuildCards("build-list-popular", byPopularity, heroId);
    renderBuildCards("build-list-winrate", byWinRate, heroId);
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
            builds.sort((a, b) => b.matches - a.matches).slice(0, 3),
            heroId,
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
            builds.sort((a, b) => b.winRate - a.winRate).slice(0, 3),
            heroId,
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

function renderBuildCards(containerId, builds, heroId) {
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
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <div class="build-card-summary">
        <span class="build-id">Build #${build.buildId ?? "?"}</span>
        <span class="build-winrate">${build.winRate.toFixed(1)}%</span>
        <span class="build-matches">${build.matches} matches</span>
      </div>
      <div class="build-card-details hidden"></div>
    `;

    const toggle = async () => {
      const details = card.querySelector(".build-card-details");
      if (details.classList.contains("hidden") && details.innerHTML === "") {
        details.innerHTML = `<p>${t("loading")}</p>`;
        const actualBuild = await getBuildById(build.buildId, heroId);
        details.innerHTML = renderBuildPath({ ...build, actualBuild });
      }
      details.classList.toggle("hidden");
      if (!details.classList.contains("hidden")) {
        equalizeCategoryHeights(details);
      }
    };

    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    container.appendChild(card);
  }
}

function resolveBuildDetailSource(build) {
  if (!build) return { modCategories: [], skillChanges: [] };

  const source = build.publishedBuild || build.actualBuild || build;
  const candidate =
    source.hero_build ||
    source.build ||
    (source.raw && source.raw.hero_build) ||
    (source.raw && source.raw.build) ||
    {};
  const details = candidate.details || source.details || {};
  const modCategories = Array.isArray(details.mod_categories)
    ? details.mod_categories
    : Array.isArray(source.mod_categories)
      ? source.mod_categories
      : [];

  const detailSkillChanges =
    details &&
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
      ? details.ability_order.currency_changes
      : [];
  const sourceSkillChanges =
    source &&
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

function detailHasAbilityOrder(source) {
  if (!source || typeof source !== "object") return false;
  const details =
    source.details || (source.hero_build && source.hero_build.details) || {};
  return !!(
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
  );
}

const BUILD_ITEMS_PER_ROW = 11;
const ROMAN_TIERS = ["", "I", "II", "III", "IV"];

function resolveBuildItemFromEntry(entry, itemMap) {
  const itemId = Number(
    (entry && (entry.ability_id ?? entry.item_id ?? entry.id)) ?? 0,
  );
  if (!itemId) return null;

  const item = itemMap[itemId] || {};
  const raw = item.raw || item;
  const icon =
    raw.shop_image_webp ||
    raw.shop_image ||
    item.shop_image ||
    (item.images &&
      (item.images.icon_image_small ||
        item.images.icon ||
        item.images.icon_image)) ||
    "assets/placeholder.svg";

  return {
    id: itemId,
    name: item.name || raw.name || `Item #${itemId}`,
    icon,
    tier: Number(raw.item_tier) || 0,
    slotType: raw.item_slot_type || "unknown",
    isActive: raw.is_active_item === true || raw.activation === "active",
  };
}

function isCategoryOptional(category, categoryName) {
  if (category && category.optional === true) return true;
  return /optional|op[cç]ional/i.test(categoryName || "");
}

function buildBuildItemCategories(build, itemMap) {
  const { modCategories } = resolveBuildDetailSource(build);
  if (!modCategories.length) return [];

  const categories = modCategories.map((category) => {
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
    };
  });

  // Todas as categorias com a mesma largura (mesmo número de colunas)
  const uniformCols = Math.min(
    Math.max(...categories.map((c) => c.items.length), 1),
    BUILD_ITEMS_PER_ROW,
  );
  // ... e a mesma altura (mesmo número de linhas para todas)
  const uniformRows = Math.max(
    ...categories.map((c) => Math.ceil(c.items.length / uniformCols)),
    1,
  );
  categories.forEach((c) => {
    c.columnCount = uniformCols;
    c.rowCount = uniformRows;
  });

  return categories;
}

function equalizeCategoryHeights(root) {
  const cats = Array.from(root.querySelectorAll(".build-item-category"));
  if (!cats.length) return;
  let max = 0;
  for (const c of cats) max = Math.max(max, c.offsetHeight);
  for (const c of cats) c.style.height = `${max}px`;
}

function buildSkillSequence(build) {
  const { skillChanges } = resolveBuildDetailSource(build);
  if (!Array.isArray(skillChanges) || skillChanges.length === 0) return [];

  return skillChanges.map((entry, index) => {
    const abilityId = Number(entry && (entry.ability_id ?? entry.id ?? 0));
    return {
      id: abilityId,
      order: index + 1,
      name: `Ability #${abilityId}`,
    };
  });
}

function resolveItemName(itemId, itemMap) {
  const entry = itemMap[Number(itemId)];
  return entry && entry.name ? entry.name : `Item #${itemId}`;
}

function getLocalText(key, fallback) {
  if (
    currentTranslations &&
    Object.prototype.hasOwnProperty.call(currentTranslations, key)
  ) {
    return currentTranslations[key];
  }
  if (
    baseTranslations &&
    Object.prototype.hasOwnProperty.call(baseTranslations, key)
  ) {
    return baseTranslations[key];
  }
  return fallback;
}

function slotTypeClass(slotType) {
  const normalized = String(slotType || "unknown").toLowerCase();
  if (normalized.includes("weapon")) return "build-item-card--weapon";
  if (normalized.includes("vitality") || normalized.includes("armor"))
    return "build-item-card--vitality";
  if (normalized.includes("spirit")) return "build-item-card--spirit";
  if (normalized.includes("utility")) return "build-item-card--utility";
  return "build-item-card--unknown";
}

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
        <img class="build-item-icon" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" loading="lazy" />
      </span>
      ${activeLabel}
      <span class="build-item-name">${escapeHtml(item.name)}</span>
    </li>
  `;
}

function renderBuildCategoryBox(category) {
  const rawName = String(category.name || "").trim();
  const showName = rawName !== "" && rawName.toLowerCase() !== "category";
  const optionalBadge = category.optional
    ? `<span class="build-category-optional">${getLocalText("build_category_optional", "OPCIONAL")}</span>`
    : "";
  const description = category.description
    ? `<p class="build-category-description">${escapeHtml(category.description)}</p>`
    : "";

  const itemsHtml = category.items.length
    ? category.items.map((item) => renderBuildItemCard(item)).join("")
    : `<li class="build-detail-empty">${t("no_data")}</li>`;

  const listLabel = showName
    ? category.name
    : category.description || "items";

  return `
    <div class="build-item-category${category.optional ? " build-item-category--optional" : ""}" style="--category-cols: ${category.columnCount}; --category-rows: ${category.rowCount || 1}">
      <div class="build-category-header">
        <div class="build-category-title-row">
          ${optionalBadge}
          ${showName ? `<span class="build-category-name">${escapeHtml(category.name)}</span>` : ""}
        </div>
        ${description}
      </div>
      <ul class="build-category-items" aria-label="${escapeHtml(listLabel)}">
        ${itemsHtml}
      </ul>
    </div>
  `;
}

function renderBuildPath(build) {
  const itemMap = window.__itemMap || {};
  const itemCategories = buildBuildItemCategories(build, itemMap);
  const skillSequence = buildSkillSequence(build);

  const itemSection = itemCategories.length
    ? `<div class="build-categories-flow">${itemCategories.map((category) => renderBuildCategoryBox(category)).join("")}</div>`
    : `<p class="build-detail-empty">${t("no_data")}</p>`;

  const skillSection = skillSequence.length
    ? `<ol class="build-skill-list">${skillSequence
        .map(
          (step) => `
        <li class="build-skill-item">
          <span class="build-detail-number">${step.order}</span>
          <span class="build-detail-name">${escapeHtml(resolveItemName(step.id, itemMap))}</span>
        </li>
      `,
        )
        .join("")}</ol>`
    : `<p class="build-detail-empty">${t("no_data")}</p>`;

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
