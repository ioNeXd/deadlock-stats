// Retorna o mapa de itens de forma segura — nunca undefined/null.
function safeGetItemMap(itemMap) {
  return itemMap && typeof itemMap === "object" ? itemMap : {};
}

async function renderHeroDetail(heroId) {
  const container = document.getElementById("hero-detail-content");
  if (!container) return;

  // Defesa em profundidade: herói inválido (NaN, negativo...) não chama a API.
  if (!isValidHeroId(heroId)) return;

  container.innerHTML = `<p>${t("loading")}</p>`;

  try {
    const [heroesById, buildStats, itemMap] = await Promise.all([
      getHeroesById(),
      getHeroBuildStats(heroId),
      getItemsById(),
    ]);

    window.__itemMap = safeGetItemMap(itemMap);
    // Builds de outro herói ficam órfãos — limpa o cache ao trocar de herói.
    buildCache.clear();

    const hero = heroesById[heroId];
    window.__abilityMap = buildAbilityMap(hero);
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
            builds
              .sort((a, b) => b.matches - a.matches)
              .slice(0, CONSTANTS.MAX_BUILDS_PER_LIST),
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
            builds
              .sort((a, b) => b.winRate - a.winRate)
              .slice(0, CONSTANTS.MAX_BUILDS_PER_LIST),
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
        const cacheKey = `${heroId}:${build.buildId}`;
        // Cache com TTL — cada clique num build não refaz a requisição.
        let actualBuild = buildCache.get(cacheKey);
        if (actualBuild === undefined) {
          actualBuild = await getBuildById(build.buildId, heroId);
          if (actualBuild) buildCache.set(cacheKey, actualBuild);
        }
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

function detailHasAbilityOrder(source) {
  if (!source || typeof source !== "object") return false;
  const details =
    source.details || (source.hero_build && source.hero_build.details) || {};
  return !!(
    details.ability_order &&
    Array.isArray(details.ability_order.currency_changes)
  );
}

const BUILD_ITEMS_PER_ROW = CONSTANTS.BUILD_ITEMS_PER_ROW;
const ROMAN_TIERS = ["", "I", "II", "III", "IV"];

// Cache de builds expandidos: buildId -> payload, com TTL de 5 min.
const buildCache = new TTLCache(CONSTANTS.BUILD_CACHE_TTL_MS);

function resolveBuildItemFromEntry(entry, itemMap) {
  const itemId = Number(
    (entry && (entry.ability_id ?? entry.item_id ?? entry.id)) ?? 0,
  );
  if (!itemId) return null;

  const map = safeGetItemMap(itemMap);
  const item = map[itemId] || {};
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
  const id = Number(itemId);

  // 1) IDs de item de loja (build de itens)
  const itemEntry = safeGetItemMap(itemMap)[id];
  if (itemEntry && itemEntry.name) return itemEntry.name;

  // 2) IDs de habilidade do herói (skill path) — vêm de um asset separado
  // do endpoint de heróis, não do endpoint de itens.
  const abilityMap =
    window.__abilityMap && typeof window.__abilityMap === "object"
      ? window.__abilityMap
      : {};
  const abilityEntry = abilityMap[id];
  if (abilityEntry && abilityEntry.name) return abilityEntry.name;

  // 3) Sem correspondência em nenhum dos dois — nome genérico, mas
  // identificado como habilidade (é o único chamador deste caminho).
  return `Ability #${id}`;
}

// Extrai um mapa {abilityId: {id, name}} a partir dos dados do herói já
// carregados via getHeroesById(). A API pode expor as habilidades sob
// diferentes nomes de campo dependendo da versão; tentamos os mais
// prováveis e ignoramos silenciosamente se nenhum existir.
function buildAbilityMap(hero) {
  const map = {};
  if (!hero || typeof hero !== "object") return map;
  const raw = hero.raw && typeof hero.raw === "object" ? hero.raw : hero;

  const candidateLists = [
    raw.abilities,
    raw.standard_abilities,
    raw.hero_abilities,
    raw.item_abilities,
  ];
  const abilities = candidateLists.find((v) => Array.isArray(v));
  if (!abilities) return map;

  for (const a of abilities) {
    if (!a) continue;
    const id = Number(a.ability_id ?? a.id ?? 0);
    if (!id) continue;
    map[id] = {
      id,
      name: a.name || a.class_name || `Ability #${id}`,
    };
  }
  return map;
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
        <img class="build-item-icon" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />
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

function renderBuildItemSection(itemCategories) {
  return itemCategories.length
    ? `<div class="build-categories-flow">${itemCategories.map((category) => renderBuildCategoryBox(category)).join("")}</div>`
    : `<p class="build-detail-empty">${t("no_data")}</p>`;
}

function renderBuildSkillSection(skillSequence, itemMap) {
  if (!skillSequence.length) {
    return `<p class="build-detail-empty">${t("no_data")}</p>`;
  }
  return `<ol class="build-skill-list">${skillSequence
    .map(
      (step) => `
    <li class="build-skill-item">
      <span class="build-detail-number">${step.order}</span>
      <span class="build-detail-name">${escapeHtml(resolveItemName(step.id, itemMap))}</span>
    </li>
  `,
    )
    .join("")}</ol>`;
}

function renderBuildPath(build) {
  const itemMap = safeGetItemMap(window.__itemMap);
  const itemCategories = buildBuildItemCategories(build, itemMap);
  const skillSequence = buildSkillSequence(build);

  const itemSection = renderBuildItemSection(itemCategories);
  const skillSection = renderBuildSkillSection(skillSequence, itemMap);

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