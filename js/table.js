const TableModule = (() => {
  const state = {
    rows: [],
    filteredRows: [],
    sortColumn: null,
    sortDirection: "desc",
    type: "heroes",
    gameStats: null,
    searchQuery: "",
    filter: "all",
    page: 1,
    pageSize: 20,
    autoRefresh: false,
    refreshIntervalId: null,
  };

  function renderSkeletonRows() {
    const tbody = document.getElementById("stats-table-body");
    if (!tbody) return;

    const rows = Array.from(
      { length: 6 },
      () => `
      <tr class="skeleton-row" aria-hidden="true">
        <td><span class="skeleton-cell skeleton-avatar"></span></td>
        <td><span class="skeleton-cell"></span></td>
        <td><span class="skeleton-cell"></span></td>
        <td><span class="skeleton-cell"></span></td>
      </tr>
    `,
    ).join("");

    tbody.innerHTML = rows;
  }

  function showLoader() {
    const container = document.getElementById("loading-container");
    const table = document.getElementById("stats-table");
    hideError();
    renderSkeletonRows();
    if (container) {
      container.setAttribute("aria-hidden", "false");
      container.classList.remove("hidden");
    }
    if (table) table.setAttribute("aria-busy", "true");
  }

  function hideLoader() {
    const container = document.getElementById("loading-container");
    const table = document.getElementById("stats-table");
    if (container) {
      container.setAttribute("aria-hidden", "true");
      container.classList.add("hidden");
    }
    if (table) table.setAttribute("aria-busy", "false");
  }

  function announceStatus(message) {
    const status = document.getElementById("sr-status");
    if (!status) return;
    status.textContent = message;
  }

  function showError(message) {
    const banner = document.getElementById("error-banner");
    const msg = document.getElementById("error-banner-message");
    if (msg) msg.textContent = message;
    if (banner) {
      banner.classList.remove("hidden");
      banner.setAttribute("aria-hidden", "false");
      banner.focus && banner.focus();
      announceStatus(message);
    }
  }

  function hideError() {
    const banner = document.getElementById("error-banner");
    const msg = document.getElementById("error-banner-message");
    if (msg) msg.textContent = "";
    if (banner) {
      banner.classList.add("hidden");
      banner.setAttribute("aria-hidden", "true");
    }
  }

  function updateAriaSort() {
    const headers = {
      winRate: document.getElementById("header-winrate"),
      pickRate: document.getElementById("header-pickrate"),
    };

    for (const [key, el] of Object.entries(headers)) {
      if (!el) continue;
      if (state.sortColumn === key) {
        el.setAttribute(
          "aria-sort",
          state.sortDirection === "asc" ? "ascending" : "descending",
        );
      } else {
        el.removeAttribute("aria-sort");
      }
    }
  }

  function applyFilters() {
    let rows = [...state.rows];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q));

    if (state.filter === 'top-pick') {
      rows = rows.sort((a,b) => b.pickRate - a.pickRate).slice(0, 50);
    } else if (state.filter === 'top-win') {
      rows = rows.sort((a,b) => b.winRate - a.winRate).slice(0, 50);
    }

    state.filteredRows = rows;
  }

  function renderRows() {
    const tbody = document.getElementById("stats-table-body");
    if (!tbody) {
      console.warn("stats-table-body not found; skipping renderRows.");
      return;
    }

    tbody.innerHTML = "";

    applyFilters();
    let rows = [...state.filteredRows];

    if (state.sortColumn === null) {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      rows.sort((a, b) => {
        const diff = a[state.sortColumn] - b[state.sortColumn];
        return state.sortDirection === "asc" ? diff : -diff;
      });
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    const pageInfo = document.getElementById('page-info');
    if (pageInfo) pageInfo.textContent = `${state.page} / ${totalPages}`;

    if (pageRows.length === 0) {
      const tr = document.createElement("tr");
      tr.classList.add("empty-state");
      tr.innerHTML = `<td colspan="4">${t("no_data") || "No data available"}</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const row of pageRows) {
      const tr = document.createElement("tr");
      const imgSrc = row.imageUrl || "";
      const imgAlt = row.name || "";

      tr.innerHTML = `
        <td><img src="${imgSrc}" width="32" alt="${imgAlt}" loading="lazy"></td>
        <td>${row.name}</td>
        <td>${row.winRate.toFixed(1)}%</td>
        <td>${row.pickRate.toFixed(1)}%</td>
      `;

      const imgEl = tr.querySelector("img");
      if (imgEl) {
        imgEl.addEventListener("error", () => {
          imgEl.src = "assets/placeholder.svg";
          imgEl.alt = imgAlt
            ? `${imgAlt} (image unavailable)`
            : "Image unavailable";
        });
      }

      if (state.type === "heroes" && row.id != null) {
        tr.classList.add("clickable-row");
        tr.tabIndex = 0;
        tr.setAttribute("role", "link");
        tr.setAttribute("aria-label", row.name);
        const goToHero = () => navigateToHero(row.id);
        tr.addEventListener("click", goToHero);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToHero();
          }
        });
      }

      tbody.appendChild(tr);
    }
  }

  function handleSortClick(column) {
    if (state.sortColumn !== column) {
      state.sortColumn = column;
      state.sortDirection = "desc";
    } else if (state.sortDirection === "desc") {
      state.sortDirection = "asc";
    } else {
      state.sortColumn = null;
    }

    updateAriaSort();
    const directionLabel =
      state.sortDirection === "asc" ? "ascending" : "descending";
    const columnLabel =
      state.sortColumn === "winRate" ? "Win Rate" : "Pick Rate";
    const message = state.sortColumn
      ? `Sorted by ${columnLabel}, ${directionLabel}`
      : "Sorting cleared";
    announceStatus(message);
    renderRows();
  }

  async function renderTable(type) {
    state.type = type;
    const header = document.getElementById("table-name-header");
    if (!header) {
      console.warn("table-name-header not found; skipping renderTable.");
      return;
    }

    let stats, entitiesById, idField;

    showLoader();

    try {
      if (type === "heroes") {
        header.setAttribute("data-i18n", "table_hero");
        idField = "hero_id";
        [stats, entitiesById] = await Promise.all([
          getHeroStats(),
          getHeroesById(),
        ]);
      } else {
        header.setAttribute("data-i18n", "table_item");
        idField = "item_id";
        [stats, entitiesById] = await Promise.all([
          getItemStats(),
          getItemsById(),
        ]);
      }

      applyTranslations();

      if (!state.gameStats) {
        state.gameStats = await getGameStats();
      }
      const totalMatches = Number(state.gameStats[0]?.total_matches) || 0;
      const totalItemSlots = totalMatches * 12;

      state.rows = stats.map((stat) => {
        const entity = entitiesById[stat[idField]] || {};
        const wins = Number(stat.wins) || 0;
        const matchesCount = Number(stat.matches) || 0;
        const winRate = matchesCount > 0 ? (wins / matchesCount) * 100 : 0;
        const pickRate =
          type === "heroes"
            ? (matchesCount / (totalMatches || 1)) * 100
            : (matchesCount / (totalItemSlots || 1)) * 100;
        const imageUrl =
          type === "heroes"
            ? entity.images && entity.images.icon_image_small
            : entity.shop_image;
        return {
          id: stat[idField],
          name: entity.name || "Unknown",
          imageUrl: imageUrl || "",
          winRate,
          pickRate,
        };
      });

      state.sortColumn = null;
      updateAriaSort();
      announceStatus("Table updated");
      renderRows();

      const nameHeader = document.getElementById("table-name-header");
      if (nameHeader) nameHeader.focus();
    } catch (err) {
      console.error("Failed to render table:", err);
      state.rows = [];
      renderRows();
      showError(t("error_fetching_data"));
    } finally {
      hideLoader();
    }
  }

  function bindEvents() {
    const headerWin = document.getElementById("header-winrate");
    const headerPick = document.getElementById("header-pickrate");
    const navHeroes = document.getElementById("nav-heroes");
    const navItems = document.getElementById("nav-items");
    const retryButton = document.getElementById("error-retry");
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    const refreshButton = document.getElementById('refresh-button');
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    const prevPage = document.getElementById('prev-page');
    const nextPage = document.getElementById('next-page');

    if (headerWin) {
      headerWin.addEventListener("click", (e) => {
        e.preventDefault();
        handleSortClick("winRate");
      });
      headerWin.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSortClick("winRate");
        }
      });
    }
    if (headerPick) {
      headerPick.addEventListener("click", (e) => {
        e.preventDefault();
        handleSortClick("pickRate");
      });
      headerPick.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSortClick("pickRate");
        }
      });
    }
    if (navHeroes) {
      navHeroes.addEventListener("click", (e) => {
        e.preventDefault();
        renderTable("heroes");
      });
      navHeroes.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          renderTable("heroes");
        }
      });
    }
    if (navItems) {
      navItems.addEventListener("click", (e) => {
        e.preventDefault();
        renderTable("items");
      });
      navItems.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          renderTable("items");
        }
      });
    }
    if (retryButton)
      retryButton.addEventListener("click", () => renderTable(state.type));
    if (retryButton)
      retryButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          renderTable(state.type);
        }
      });

    if (searchInput) {
      searchInput.setAttribute('placeholder', t('search_placeholder'));
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value || '';
        state.page = 1;
        renderRows();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        state.filter = e.target.value;
        state.page = 1;
        renderRows();
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener('click', () => renderTable(state.type));
    }

    if (autoRefreshCheckbox) {
      autoRefreshCheckbox.addEventListener('change', (e) => {
        state.autoRefresh = e.target.checked;
        if (state.autoRefresh) {
          state.refreshIntervalId = setInterval(() => renderTable(state.type), 30 * 1000);
        } else if (state.refreshIntervalId) {
          clearInterval(state.refreshIntervalId);
          state.refreshIntervalId = null;
        }
      });
    }

    if (prevPage) prevPage.addEventListener('click', () => { if (state.page > 1) { state.page--; renderRows(); } });
    if (nextPage) nextPage.addEventListener('click', () => { state.page++; renderRows(); });
  }

  function onTableRouteActive() {
    renderTable(state.type);
  }

  window.onTableRouteActive = onTableRouteActive;
  window.renderTable = renderTable;

  async function showLastUpdated() {
    const el = document.getElementById("last-updated");
    if (el) el.textContent = t("loading");
    try {
      const lastMatch = await getLastUpdated();
      const formatted = formatDate(lastMatch);
      if (el) el.textContent = `${t("last_updated_prefix")} ${formatted}`;
    } catch (err) {
      if (el) el.textContent = t("loading");
      console.error("Failed to fetch last-updated:", err);
      showError(t("error_fetching_data"));
    }
  }

  async function init() {
    await initI18n();
    bindEvents();

    if (typeof initRouter === "function") {
      initRouter();
    }

    if (typeof handleRouteChange === "function") {
      await handleRouteChange();
    } else {
      await renderTable("heroes");
    }

    showLastUpdated();
  }

  return { init, renderTable };
})();

TableModule.init();
