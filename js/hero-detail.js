async function renderHeroDetail(heroId) {
  const container = document.getElementById("hero-detail-content");
  container.innerHTML = `<p>${t("loading")}</p>`;

  try {
    const [heroesById, buildStats] = await Promise.all([
      getHeroesById(),
      getHeroBuildStats(heroId),
    ]);

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
        <div class="build-list" id="build-list-popular"></div>
      </section>

      <section class="build-section">
        <h3 data-i18n="builds_winrate">Highest Win Rate Builds</h3>
        <div class="build-list" id="build-list-winrate"></div>
      </section>
    `;

    renderBuildCards("build-list-popular", byPopularity);
    renderBuildCards("build-list-winrate", byWinRate);
    applyTranslations();
  } catch (err) {
    console.error("Failed to render hero detail:", err);
    container.innerHTML = `<p>${t("error_fetching_data")}</p>`;
  }
}

function renderBuildCards(containerId, builds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (builds.length === 0) {
    container.innerHTML = `<p>${t("no_data")}</p>`;
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

    const toggle = () => {
      const details = card.querySelector(".build-card-details");
      if (details.classList.contains("hidden") && details.innerHTML === "") {
        details.innerHTML = renderBuildPath(build);
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

function renderBuildPath(build) {
  const raw = build.raw || {};
  const possiblePath =
    raw.items ?? raw.item_ids ?? raw.build_items ?? raw.path ?? null;

  if (Array.isArray(possiblePath) && possiblePath.length > 0) {
    const itemsHtml = possiblePath
      .map((itemId, i) => `<li>${i + 1}. Item #${itemId}</li>`)
      .join("");
    return `<ol class="build-path">${itemsHtml}</ol>`;
  }

  return `
    <p class="build-id-fallback">Build ID: ${build.buildId ?? "N/A"}</p>
    <details class="build-raw-debug">
      <summary>Raw data (debug)</summary>
      <pre>${JSON.stringify(raw, null, 2)}</pre>
    </details>
  `;
}
