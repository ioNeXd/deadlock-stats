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

function buildBuildItemCategories(build, itemMap) {
  const { modCategories } = resolveBuildDetailSource(build);
  if (!modCategories.length) return [];

  return modCategories.map((category) => {
    const categoryName = category && (category.name || "Category");
    const items = Array.isArray(category.mods) ? category.mods : [];
    const itemRows = items
      .map((entry) => {
        const itemId = Number(
          (entry && (entry.ability_id ?? entry.item_id ?? entry.id)) ?? 0,
        );
        const item = itemMap[itemId] || {};
        const name = item.name || `Item #${itemId}`;
        const icon =
          (item.images &&
            (item.images.icon_image_small ||
              item.images.icon ||
              item.images.icon_image)) ||
          item.shop_image ||
          "assets/placeholder.svg";
        return {
          id: itemId,
          name,
          icon,
        };
      })
      .filter((entry) => entry.id !== 0);

    return {
      name: categoryName,
      items: itemRows,
    };
  });
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

function renderBuildPath(build) {
  const itemMap = window.__itemMap || {};
  const itemCategories = buildBuildItemCategories(build, itemMap);
  const skillSequence = buildSkillSequence(build);

  const itemSection = itemCategories.length
    ? itemCategories
        .map(
          (section) => `
        <div class="build-item-category">
          <div class="build-item-category-name">${section.name}</div>
          <ul class="build-detail-list">
            ${
              section.items
                .map(
                  (item) => `
              <li class="build-detail-item build-item-row">
                <span class="build-detail-icon-wrap">
                  <img class="build-detail-icon" src="${item.icon || "assets/placeholder.svg"}" alt="${item.name}" loading="lazy" />
                </span>
                <span class="build-detail-name">${item.name}</span>
              </li>
            `,
                )
                .join("") ||
              '<li class="build-detail-empty">' + t("no_data") + "</li>"
            }
          </ul>
        </div>
      `,
        )
        .join("")
    : `<p class="build-detail-empty">${t("no_data")}</p>`;

  const skillSection = skillSequence.length
    ? `<ol class="build-skill-list">${skillSequence
        .map(
          (step) => `
        <li class="build-skill-item">
          <span class="build-detail-number">${step.order}</span>
          <span class="build-detail-name">${resolveItemName(step.id, itemMap)}</span>
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
      <div class="build-detail-section">
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
