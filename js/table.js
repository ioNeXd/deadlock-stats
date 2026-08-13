const TableModule = (() => {
  const state = {
    rows: [],
    filteredRows: [],
    sortColumn: null,
    sortDirection: "desc",
    type: "heroes",
    gameStats: null,
    searchQuery: "",
    page: 1,
    pageSize: 20,
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

    // No more top-pick/top-win client-side filters — simple search only
    state.filteredRows = rows;
  }

  // Lazy loader observer (module-level) — create once
  let _lazyObserver;
  // Small helper to check if a URL exists. Try HEAD, fallback to Image() load.
  function checkImageExists(url, timeout = 3000) {
    if (!url) return Promise.resolve(false);
    // Try HEAD first (may fail due to CORS on some hosts)
    return new Promise((resolve) => {
      let resolved = false;
      // Use fetch HEAD where allowed
      try {
        fetch(url, { method: 'HEAD', cache: 'no-store' }).then((res) => {
          if (!resolved) {
            resolved = true;
            resolve(res.ok);
          }
        }).catch(() => {
          // fallback to Image
          const img = new Image();
          const id = setTimeout(() => {
            img.onload = img.onerror = null;
            if (!resolved) { resolved = true; resolve(false); }
          }, timeout);
          img.onload = () => { clearTimeout(id); if (!resolved) { resolved = true; resolve(true); } };
          img.onerror = () => { clearTimeout(id); if (!resolved) { resolved = true; resolve(false); } };
          img.src = url;
        });
      } catch (e) {
        // fallback to Image
        const img = new Image();
        const id = setTimeout(() => {
          img.onload = img.onerror = null;
          if (!resolved) { resolved = true; resolve(false); }
        }, timeout);
        img.onload = () => { clearTimeout(id); if (!resolved) { resolved = true; resolve(true); } };
        img.onerror = () => { clearTimeout(id); if (!resolved) { resolved = true; resolve(false); } };
        img.src = url;
      }
    });
  }

  function initLazyObserver() {
    if (_lazyObserver) return;
    if ('IntersectionObserver' in window) {
      _lazyObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          const src = img.getAttribute('data-src');
          const fallback = img.getAttribute('data-srcset') || src;

          if (src) {
            // attempt to prefer a webp sibling if available
            const webp = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
            checkImageExists(webp).then((exists) => {
              try {
                if (exists) {
                  img.srcset = `${webp} 1x, ${src} 2x`;
                } else if (fallback) {
                  img.srcset = fallback;
                }
              } catch (e) {}
              img.src = src;
              img.removeAttribute('data-src');
              img.removeAttribute('data-srcset');
              try { _lazyObserver.unobserve(img); } catch (e) {}
            }).catch(() => {
              img.src = src;
              img.removeAttribute('data-src');
              img.removeAttribute('data-srcset');
              try { _lazyObserver.unobserve(img); } catch (e) {}
            });
          } else {
            // nothing to load
            try { _lazyObserver.unobserve(img); } catch (e) {}
          }
        }
      }, { rootMargin: '200px 0px', threshold: 0.01 });
    }
  }

  function observeLazyImages() {
    initLazyObserver();
    if (!_lazyObserver) {
      // fallback: load immediately but probe for webp where possible
      document.querySelectorAll('img.lazy-img').forEach((img) => {
        const src = img.getAttribute('data-src');
        const fallback = img.getAttribute('data-srcset') || src;
        if (src) {
          const webp = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
          checkImageExists(webp).then((exists) => {
            try {
              if (exists) img.srcset = `${webp} 1x, ${src} 2x`;
              else if (fallback) img.srcset = fallback;
            } catch (e) {}
            img.src = src;
          }).catch(() => {
            img.src = src;
          }).finally(() => {
            img.removeAttribute('data-src');
            img.removeAttribute('data-srcset');
          });
        }
      });
      return;
    }
    document.querySelectorAll('img.lazy-img[data-src]').forEach((img) => {
      _lazyObserver.observe(img);
    });
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

    // Update table aria-label dynamically so screen reader users know how many items are shown
    try {
      const table = document.getElementById('stats-table');
      if (table) {
        const count = rows.length || 0;
        const labelKey = state.type === 'heroes' ? 'a11y_hero_list_label' : 'a11y_item_list_label';
        const raw = t(labelKey) || (state.type === 'heroes' ? 'Heroes list, {count} items' : 'Items list, {count} items');
        table.setAttribute('aria-label', raw.replace('{count}', count));
      }
    } catch (e) {
      // no-op if translations missing
    }

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

      // Build responsive image attributes: try webp variant when possible
      const safeSrc = imgSrc || 'assets/placeholder.svg';
      // Defer creating a webp srcset until the image is about to load (safer)
      const dataSrc = safeSrc;
      const dataSrcset = safeSrc; // fallback only; webp will be probed on demand

      tr.innerHTML = `
        <td><img data-src="${dataSrc}" data-srcset="${dataSrcset}" class="lazy-img" src="assets/placeholder.svg" width="32" height="32" alt="${imgAlt}" loading="lazy"></td>
        <td>${row.name}</td>
        <td>${row.winRate.toFixed(1)}%</td>
        <td>${row.pickRate.toFixed(1)}%</td>
      `;

      const imgEl = tr.querySelector("img.lazy-img");
      if (imgEl) {
        // on error, fallback to placeholder and remove data attributes
        imgEl.addEventListener("error", () => {
          imgEl.src = "assets/placeholder.svg";
          imgEl.removeAttribute('data-src');
          imgEl.removeAttribute('data-srcset');
          imgEl.alt = imgAlt
            ? `${imgAlt} (image unavailable)`
            : "Image unavailable";
          imgEl.style.opacity = '1';
        });
        // on load fade in
        imgEl.addEventListener('load', () => {
          imgEl.style.opacity = '1';
        });
      }

      if (state.type === "heroes" && row.id != null) {
        tr.classList.add("clickable-row");
        tr.tabIndex = 0;
        // Use role=button for interactive rows and provide an accessible label
        tr.setAttribute("role", "button");
        tr.setAttribute("aria-label", row.name);
        const goToHero = () => navigateToHero(row.id);
        tr.addEventListener("click", goToHero);
        tr.addEventListener("keydown", (e) => {
          // Activate row with Enter or Space
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToHero();
            return;
          }

          // Arrow key navigation between rows for keyboard users
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const dir = e.key === "ArrowDown" ? 'next' : 'prev';
            let sib = dir === 'next' ? tr.nextElementSibling : tr.previousElementSibling;
            while (sib && sib.nodeType !== 1) sib = dir === 'next' ? sib.nextSibling : sib.previousSibling;
            if (sib && typeof sib.focus === 'function') {
              sib.focus();
            }
          }
        });
      }

      tbody.appendChild(tr);
    }

    // Start observing lazy images after rows are in the DOM
    try { observeLazyImages(); } catch (e) { /* ignore */ }
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
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      const labelKey = type === 'heroes' ? 'search_heroes_placeholder' : 'search_items_placeholder';
      const label = t(labelKey) || (type === 'heroes' ? 'Search heroes' : 'Search items');
      searchInput.setAttribute('placeholder', label);
      searchInput.setAttribute('aria-label', label);
    }

    const header = document.getElementById("table-name-header");
    if (!header) {
      console.warn("table-name-header not found; skipping renderTable.");
      return;
    }

    let stats, entitiesById, idField;

    showLoader();

    // Watchdog: abort all fetches if they don't complete within 3s
    const watchdog = new AbortController();
    let watchdogTimer = setTimeout(() => {
      try {
        watchdog.abort();
      } catch (e) {}
      console.warn('Render table watchdog triggered (3s)');
      showError(t('error_fetching_data'));
      hideLoader();
    }, 3000);

    try {
      if (type === "heroes") {
        header.setAttribute("data-i18n", "table_hero");
        idField = "hero_id";
        const fetchPromise = Promise.all([getHeroStats({ signal: watchdog.signal }), getHeroesById({ signal: watchdog.signal })]);
        [stats, entitiesById] = await fetchPromise;
      } else {
        header.setAttribute("data-i18n", "table_item");
        idField = "item_id";
        const fetchPromise = Promise.all([getItemStats({ signal: watchdog.signal }), getItemsById({ signal: watchdog.signal })]);
        [stats, entitiesById] = await fetchPromise;
      }

      applyTranslations();

      if (!state.gameStats) {
        try {
          state.gameStats = await getGameStats({ signal: watchdog.signal });
        } catch (e) {
          console.warn('getGameStats timed out or failed', e);
          state.gameStats = [{ total_matches: 0 }];
        }
      }

      // clear watchdog on success
      clearTimeout(watchdogTimer);

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
        // Robust image lookup with several fallbacks — some API responses vary
        function pickImage(e) {
          if (!e) return '';
          // common locations
          const imgs = e.images || (e.raw && e.raw.images) || {};
          return (
            imgs.icon_image_small || imgs.icon || imgs.icon_image ||
            e.shop_image || e.icon_image_small || e.shop_image_small ||
            (e.raw && e.raw.icon_image_small) || (e.raw && e.raw.shop_image) || ''
          );
        }
        const imageUrl = type === "heroes" ? pickImage(entity) : pickImage(entity) || entity.shop_image;
        if (!imageUrl) {
          // log once per missing entity for debugging
          if (entity && entity.name) console.debug(`No image for: ${entity.name} (id=${entity.id})`);
        }
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
      // ensure watchdog cleared
      try { clearTimeout(watchdogTimer); } catch (e) {}
    } finally {
      hideLoader();
      try { clearTimeout(watchdogTimer); } catch (e) {}
    }
  }

  function bindEvents() {
    const headerWin = document.getElementById("header-winrate");
    const headerPick = document.getElementById("header-pickrate");
    const navHeroes = document.getElementById("nav-heroes");
    const navItems = document.getElementById("nav-items");
    const retryButton = document.getElementById("error-retry");
    const searchInput = document.getElementById('search-input');
    const refreshButton = document.getElementById('refresh-button');
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
      const setSearchPlaceholder = () => {
        const labelKey = state.type === 'heroes' ? 'search_heroes_placeholder' : 'search_items_placeholder';
        const label = t(labelKey) || (state.type === 'heroes' ? 'Search heroes' : 'Search items');
        searchInput.setAttribute('placeholder', label);
        searchInput.setAttribute('aria-label', label);
      };

      setSearchPlaceholder();
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value || '';
        state.page = 1;
        renderRows();
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener('click', () => renderTable(state.type));
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
      // race the API call against a short timeout to avoid infinite spinner
      const timeoutMs = 8000;
      const lastMatch = await Promise.race([
        getLastUpdated(),
        new Promise((res) => setTimeout(() => res(null), timeoutMs)),
      ]);

      if (!lastMatch || !(lastMatch instanceof Date) || lastMatch.getTime() === 0) {
        // show friendly fallback when we couldn't determine last update
        if (el) el.textContent = `${t("last_updated_prefix")} ${t("last_updated_unavailable")}`;
        return;
      }

      const formatted = formatDate(lastMatch);
      if (el) el.textContent = `${t("last_updated_prefix")} ${formatted}`;
    } catch (err) {
      if (el) el.textContent = `${t("last_updated_prefix")} ${t("last_updated_unavailable")}`;
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
