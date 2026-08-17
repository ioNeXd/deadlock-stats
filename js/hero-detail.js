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
    const [heroesById, buildStats, itemMap, abilityMap] = await Promise.all([
      getHeroesById(),
      getHeroBuildStats(heroId),
      getItemsById(),
      getAbilitiesByClass(),
    ]);

    window.__itemMap = safeGetItemMap(itemMap);
    // class_name -> { id, name } das habilidades (para o skill path).
    window.__abilityMap =
      abilityMap && typeof abilityMap === "object" ? abilityMap : {};
    // Builds de outro herói ficam órfãos — limpa o cache ao trocar de herói.
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
    const winRateHtml =
      build.winRate != null
        ? `<span class="build-winrate">${build.winRate.toFixed(1)}%</span>`
        : "";
    const matchesHtml =
      build.matches != null
        ? `<span class="build-matches">${build.matches} matches</span>`
        : "";
    // Build vinda do fallback (mais favoritadas): selo no lado direito do
    // card sinalizando que veio de outra busca, sem stats analíticos.
    const sourceBadge = build.fromFallback
      ? `<span class="build-fav-badge">${getLocalText(
          "build_favorites_source",
          "TOP FAVORITOS",
        )}</span>`
      : "";

    card.innerHTML = `
      <div class="build-card-summary">
        <span class="build-id">Build #${build.buildId ?? "?"}</span>
        ${winRateHtml}
        ${matchesHtml}
        ${sourceBadge}
      </div>
      <div class="build-card-details hidden"></div>
    `;

    // Expande/colapsa apenas pelo cabeçalho (nome, winrate, partidas) —
    // clicar no conteúdo expandido não fecha o build.
    const summary = card.querySelector(".build-card-summary");
    summary.tabIndex = 0;
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-expanded", "false");

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
        // Guarda o build para re-render responsivo (resize recalcula colunas).
        details.__build = { ...build, actualBuild, heroAsset };
        details.innerHTML = renderBuildPath(details.__build, details, heroAsset);
      }
      details.classList.toggle("hidden");
      summary.setAttribute("aria-expanded", String(!details.classList.contains("hidden")));
    };

    summary.addEventListener("click", toggle);
    summary.addEventListener("keydown", (e) => {
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
    localAssetUrl(raw.shop_image_webp) ||
    localAssetUrl(raw.shop_image) ||
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
  const flag = category && category.optional;
  // Aceita true, 1 ou "1" (a API às vezes devolve o flag como número/string).
  if (flag === true || flag === 1 || flag === "1") return true;
  return /optional|op[cç]ional/i.test(categoryName || "");
}

// Medidas de card/categoria lidas das variáveis CSS — o CSS calcula o visual,
// o JS só replica a aritmética para definir a largura da caixa (assim a
// largura da categoria é exatamente a dos itens dela, sem duplicar valores).
function getBuildItemMetrics() {
  const read = (name, fallback) =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    ) || fallback;
  return {
    size: read("--build-item-size", 72),
    gap: read("--build-item-gap", 4),
    pad: read("--build-category-pad", 6),
    border: read("--build-category-border-w", 2),
  };
}

// Quantos itens cabem por linha no painel de builds (responsivo).
// `container` = o .build-card-details do build (pode ainda estar oculto no
// primeiro render — por isso mede o .build-list, que já está visível).
function getBuildItemsPerRow(container) {
  const { size, gap } = getBuildItemMetrics();
  const list = container
    ? container.closest(".build-list")
    : document.querySelector(".build-list");
  const listWidth = list ? list.clientWidth : 800;
  // Painel ≈ lista − padding do card (28px) − bordas (2px) − padding da
  // lista de itens (12px).
  const available = listWidth - 30 - 12;
  return Math.max(1, Math.floor((available + gap) / (size + gap)));
}

function buildBuildItemCategories(build, itemMap, container) {
  const { modCategories } = resolveBuildDetailSource(build);
  if (!modCategories.length) return [];

  // A largura de cada categoria é definida pelos itens dela: calcula quantas
  // colunas cabem na largura do painel; itens excedentes quebram para a
  // próxima linha (a altura da categoria cresce). Ao encolher a tela,
  // o re-render no resize reduz as colunas e os itens acompanham.
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

function buildSkillSequence(build, heroAsset) {
  const { skillChanges } = resolveBuildDetailSource(build);
  if (!Array.isArray(skillChanges) || skillChanges.length === 0) return [];

  // O jogo permite no máximo 16 pontos de habilidade; alguns builds trazem
  // histórico duplicado na API (ex.: 31 entradas = 2 ciclos). Mantém apenas
  // os primeiros 16, na ordem real de level-up, para o timeline nunca estourar.
  const points = skillChanges.slice(0, 16);

  // Mapeia as signatures do herói (slot 1-4, por class_name) para o id
  // numérico da habilidade, usando o mapa de abilities (by-type/ability).
  const abilityMap = window.__abilityMap || {};
  // O asset normalizado guarda o objeto cru em .raw — as signatures
  // (signature1..4) ficam em raw.items.
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
      // |delta| = nível exibido no selo (1, 2, 5...).
      level: Math.abs(Number(entry && entry.delta) || 0),
      // currency_type 2 = ponto especial (diamante roxo sem número).
      bonus: Number(entry && entry.currency_type) === 2,
      order: index + 1,
    };
  });
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
    ? `<p class="build-category-description" title="${escapeHtml(category.description)}">${escapeHtml(category.description)}</p>`
    : "";

  const itemsHtml = category.items.length
    ? category.items.map((item) => renderBuildItemCard(item)).join("")
    : `<li class="build-detail-empty" role="img" aria-label="${escapeHtml(t("no_data"))}">${t("no_data")}</li>`;

  const listLabel = showName
    ? category.name
    : category.description || "items";

  // Sem título, o cabeçalho só é renderizado se houver conteúdo (descrição)
  // — evita barra vazia, mas não esconde a descrição de categorias sem nome.
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

  // Largura da caixa = exatamente a dos itens (colunas × card + gaps + os
  // paddings simétricos + bordas). Assim a distância da borda ao primeiro
  // item é igual à do último item à borda, e o header trunca com "..."
  // quando o texto passa da largura dos itens. Header fica fora do grid
  // (bloco) com tracks de tamanho fixo — os itens sempre juntos.
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

function renderBuildItemSection(itemCategories) {
  return itemCategories.length
    ? `<div class="build-categories-flow">${itemCategories.map((category) => renderBuildCategoryBox(category)).join("")}</div>`
    : `<p class="build-detail-empty">${t("no_data")}</p>`;
}

// ── Motor declarativo híbrido (Alternativa C) ─────────────────────────────
// Cada seção tem: id, modo de exibição (badge = pill no cabeçalho | row =
// linha), título i18n, css_class aceitos e chaves explícitas (garantem o
// pertencimento e a ordem de exibição).
// Classificação de cada stat, em cascata:
//   1. SKILL_KEY_OVERRIDES[key]  → seção fixada manualmente (conserta as
//      propriedades sem css_class ou com classe enganosa);
//   2. chave explícita de alguma seção;
//   3. css_class da seção;
//   4. fallback → seção "extra".
// Seção vazia não renderiza. Descrição fica logo após a seção "cast".
const SKILL_SECTIONS = [
  {
    id: "badges",
    mode: "badge",
    titleKey: "",
    css: [],
    keys: ["AbilityCharges", "AbilityCooldownBetweenCharge", "AbilityCooldown"],
  },
  {
    id: "range",
    mode: "row",
    titleKey: "skill_tooltip_range",
    css: ["range", "distance", "radius"],
    keys: ["AbilityCastRange", "AttackRadius", "ExplosionRadius", "AOERadius", "AccuracyPercentage", "ChainLength"],
  },
  {
    id: "cast",
    mode: "row",
    titleKey: "skill_tooltip_cast",
    css: ["cast", "time"],
    keys: ["AbilityChannelTime"],
  },
  {
    id: "damage",
    mode: "row",
    titleKey: "skill_tooltip_damage",
    css: ["tech_damage", "bullet_damage", "melee_damage", "damage"],
    keys: ["Damage", "DPS", "DamagePerSecond", "ExplosionDamage", "AirDropOutgoingDamagePercent", "IncomingDamagePercentFromCaster", "AmpDamagePercent"],
  },
  {
    id: "duration",
    mode: "row",
    titleKey: "skill_tooltip_duration",
    css: ["duration", "slow"],
    keys: ["BurnDuration", "AbilityDuration", "DebuffDuration", "SilenceDuration", "SlowDuration", "StunDuration"],
  },
  { id: "weapon", mode: "row", titleKey: "skill_tooltip_weapon", css: ["fire_rate"], keys: [] },
  { id: "move", mode: "row", titleKey: "skill_tooltip_move", css: ["move_speed"], keys: [] },
  {
    id: "vitality",
    mode: "row",
    titleKey: "skill_tooltip_vitality",
    css: ["healing", "health"],
    keys: ["HealAmount", "LifestealPercentHero", "BulletLifestealPercentHero", "AbilityLifestealPercentHero", "BonusMaxHealth"],
  },
  {
    id: "resist",
    mode: "row",
    titleKey: "skill_tooltip_resist",
    css: ["bullet_armor_up", "bullet_armor_down", "tech_armor_up", "tech_armor_down", "combat_barrier"],
    keys: [],
  },
  { id: "extra", mode: "row", titleKey: "skill_tooltip_extra", css: [], keys: [] },
];

// Overrides manuais: propriedades que a API entrega sem css_class (ou com
// classe enganosa) são fixadas na seção semanticamente correta. Gerado a
// partir de missing-properties-reference.md (102 chaves).
const SKILL_KEY_OVERRIDES = {
  // alcance / dimensões
  TossDistance: "range",
  TimeWallHeight: "range",
  BeamWidth: "range",
  DashRadius: "range",
  SlashRadius: "range",
  ImpactRadius: "range",
  Radius: "range",
  SpottedRadius: "range",
  ExplodeRadius: "range",
  ExplosionRadius: "range",
  KnightPositionSpread: "range",
  ResourceRadius: "range",
  ZombieWallLength: "range",
  AuraRadius: "range",
  ZombieWallHeight: "range",
  TargetingConeAngle: "range",
  ExtraTargetConeAngle: "range",
  ConeAngle: "range",
  RicochetRadius: "range",
  ThrowDistance: "range",
  // conjuração / contadores
  ChainCount: "cast",
  MaxStacks: "cast",
  NumBloodShards: "cast",
  ProcChance: "cast",
  TotalTetherTargets: "cast",
  ProjectileAmount: "cast",
  ProjectileRedirectCount: "cast",
  TotalSwaps: "cast",
  BatPerSecond: "cast",
  MaxTrailTargets: "cast",
  MaxTargets: "cast",
  StakeCount: "cast",
  KnightCount: "cast",
  BounceCount: "cast",
  MaxHits: "cast",
  SummonCount: "cast",
  MaxStolenTargets: "cast",
  MaxGravestones: "cast",
  MaxStabs: "cast",
  CardResourceGenPctScale: "cast",
  BatteryGenerationPercent: "cast",
  BuildUpPerShot: "cast",
  // dano
  BonusPerChain: "damage",
  BonusDamage: "damage",
  Damage: "damage",
  BonusDamagePercent: "damage",
  MinChargeDamagePercent: "damage",
  DamageThreshold: "damage",
  // duração
  TossDuration: "duration",
  StackDuration: "duration",
  BouncePadExtendDuration: "duration",
  PostCubeBuffDuration: "duration",
  ImpactDuration: "duration",
  StunDuration: "duration",
  VenomDuration: "duration",
  BuildUpDuration: "duration",
  PetrifyDuration: "duration",
  SlowDuration: "duration",
  HexDuration: "duration",
  DebuffDuration: "duration",
  InvisFadeToDuration: "duration",
  TetherDuration: "duration",
  ImmobilizeDuration: "duration",
  BuffDuration: "duration",
  MaxDuration: "duration",
  ExplodeDelay: "duration",
  ParryWindow: "duration",
  PerfectHoldTimeStart: "duration",
  PerfectWindowDuration: "duration",
  PlayerInfestDuration: "duration",
  NPCInfestDuration: "duration",
  MaxLifetime: "duration",
  ExplosionInterval: "duration",
  BounceGrace: "duration",
  InterruptCooldown: "duration",
  HealInterval: "duration",
  Lifetime: "duration",
  EnemySlowPct: "duration",
  SlowPercent: "duration",
  SlowPercentPerStack: "duration",
  // arma
  GrenadesPerSecond: "weapon",
  BulletSpread: "weapon",
  LightMeleeScalePct: "weapon",
  TimeWallTimeScaleFriendly: "weapon",
  // movimento
  FlightControlEnabled: "move",
  JumpVelocity: "move",
  AirSpeedBonus: "move",
  StaminaRestore: "move",
  MaxGroundDashReductionPercent: "move",
  GroundDashReductionPercent: "move",
  DashSpeed: "move",
  BonusMoveSpeed: "move",
  ChargeSpeed: "move",
  AirControlAccelPercent: "move",
  AirControlPercent: "move",
  InvisMoveSpeedMod: "move",
  AirMoveIncreasePercent: "move",
  // vida & cura
  SelfDamagePct: "vitality",
  VenomMaxDamageHealthPercentage: "vitality",
  AutoActivateHealthThreshold: "vitality",
  LowHealthEnemyThresholdPct: "vitality",
  // resistências
  TechResist: "resist",
  BulletResist: "resist",
  TechArmorDamageReductionPerStack: "resist",
  EvasionPercent: "resist",
  WhirlwindEvasionChance: "resist",
  DamageResistPctWhileChanneling: "resist",
  IncomingDamageReductionPercent: "resist",
  InfestDamageTakenPercent: "resist",
  // extras
  NonPlayerResourceScalePct: "extra",
  BonusGoldOnKill: "extra",
  ParryCooldownReduction: "extra",
  CDReduceOnPillowHit: "extra",
};

function statIconHtml(s) {
  return s && s.icon
    ? `<img class="skill-tooltip-stat-icon" src="${escapeHtml(s.icon)}" alt="" loading="lazy" decoding="async">`
    : "";
}

function skillTooltipRowHtml(s) {
  return `<div class="skill-tooltip-row">${statIconHtml(s)}<span class="skill-tooltip-stat-label">${escapeHtml(s.label)}</span><b class="skill-tooltip-stat-value">${escapeHtml(s.value)}</b></div>`;
}

// Classifica cada stat em uma seção (overrides → chave explícita → css_class
// → "extra") e ordena: chaves explícitas primeiro, depois o restante.
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

// Renderiza uma seção: badges viram pills no cabeçalho; o resto vira bloco
// com título i18n e linhas (ícone + label + valor).
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

function buildSkillTooltipHtml(row) {
  const stats = Array.isArray(row.stats) ? row.stats : [];
  const sections = classifySkillStats(stats);
  const byId = new Map(sections.map((s) => [s.id, s]));

  // Cabeçalho: ícone + nome à esquerda; selos (cargas/cooldowns) à direita.
  const icon = row.image
    ? `<img class="skill-tooltip-icon" src="${escapeHtml(row.image)}" alt="" decoding="async">`
    : "";
  const badges = byId.get("badges");
  const head = `<div class="skill-tooltip-head">${icon}<span class="skill-tooltip-name">${escapeHtml(row.name)}</span>${badges ? skillTooltipSectionHtml(badges) : ""}</div>`;

  // Descrição: logo abaixo do nome (cabeçalho), antes das seções.
  const desc = row.description
    ? `<p class="skill-tooltip-desc">${escapeHtml(row.description).replace(/\n/g, "<br>")}</p>`
    : "";

  const body = sections.filter((s) => s.id !== "badges");
  return [head, desc, ...body.map(skillTooltipSectionHtml)].join("");
}
// Posiciona o tooltip (position: fixed) perto do cursor, sem estourar a
// viewport — vira para o lado oposto se faltar espaço.
let skillTipX = 0;
let skillTipY = 0;
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

// Elemento único de tooltip no body com listeners delegados — segue o mouse
// sobre qualquer [data-skill-tooltip] (ícone ou nome da habilidade).
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
      window.__skillTooltips && window.__skillTooltips[el.dataset.skillTooltip];
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

function renderBuildSkillSection(skillSequence) {
  if (!skillSequence.length) {
    return `<p class="build-detail-empty">${t("no_data")}</p>`;
  }

  // Agrupa os pontos por habilidade (slot 1-4), na ordem do herói.
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

  // Sem mapeamento de habilidades (herói desconhecido): lista simples.
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

  // Conteúdo do tooltip (descrição + propriedades) por slot, consumido
  // pelos listeners delegados em ensureSkillTooltip().
  window.__skillTooltips = window.__skillTooltips || {};

  const rowsHtml = rows
    .map((row) => {
      // Tooltip com descrição e stats da habilidade (hover no ícone/nome).
      window.__skillTooltips[row.slot] = buildSkillTooltipHtml(row);

      // 16 colunas fixas no timeline (uma por ponto de habilidade); cada
      // marcador ocupa a coluna = ordem em que o ponto foi gasto (1-16).
      const markers = row.markers
        .map((m) => {
          const col = Math.min(Math.max(m.order || 1, 1), 16);
          if (m.bonus) {
            // Desbloqueio da habilidade: cadeado na mesma caixa dos selos.
            return `<span class="skill-path-marker skill-path-marker--bonus" style="grid-column: ${col}"><span class="skill-path-marker-badge"><img class="skill-path-marker-icon skill-path-marker-icon--unlock" src="assets/images/hud/levelup_unlock_icon.svg" alt="" decoding="async"></span></span>`;
          }
          // Evolução (level-up): ícone de ponto de habilidade (local).
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

  // Garante o elemento único de tooltip e os listeners delegados.
  ensureSkillTooltip();

  return `<div class="skill-path-panel">${rowsHtml}</div>`;
}

// Re-renderiza os builds abertos quando a janela muda de tamanho — o
// número de colunas por categoria é recalculado e os itens refluem.
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

function renderBuildPath(build, container, heroAsset) {
  const itemMap = safeGetItemMap(window.__itemMap);
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
