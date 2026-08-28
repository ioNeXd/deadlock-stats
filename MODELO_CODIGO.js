/**
 * MODELO DE CÓDIGO - Padrão Arquitetural do Projeto
 * =================================================
 * Práticas encontradas no diretório analisado:
 * - ES Modules com separação de responsabilidades
 * - Estado local por módulo
 * - Acessibilidade (aria, keyboard nav)
 * - Error handling com fallback
 * - Cache e retry para API
 * - Debounce para eventos
 */

// =============================================================================
// 1. CONSTANTS - Nunca use magic numbers
// =============================================================================
export const CONFIG = {
  TIMEOUT_MS: 10000,
  RETRIES: 2,
  CACHE_TTL: 30000,
  PAGE_SIZE: 20,
};

// =============================================================================
// 2. API MODULE - Fetch robusto com abort, retry e cache
// =============================================================================
const _cache = new Map();

export async function fetchData(url, opts = {}) {
  const signal = opts.signal;
  const cacheKey = url;

  // Cache read-through
  const entry = _cache.get(cacheKey);
  if (entry && Date.now() - entry.ts < CONFIG.CACHE_TTL) {
    return entry.data;
  }

  let attempt = 0;
  while (attempt <= CONFIG.RETRIES) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
      const finalSignal = signal ? signal : controller.signal;

      const res = await fetch(url, { ...opts, signal: finalSignal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      _cache.set(cacheKey, { ts: Date.now(), data });
      return data;
    } catch (err) {
      if (signal?.aborted) break;
      if (attempt > CONFIG.RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Fetch failed after retries");
}

// =============================================================================
// 3. STATE MANAGEMENT - Estado encapsulado por módulo
// =============================================================================
const state = {
  items: [],
  filtered: [],
  sortColumn: null,
  sortDir: "asc",
  page: 1,
  query: "",
};

// =============================================================================
// 4. UI HELPERS - Acessibilidade e render
// =============================================================================
function announceStatus(message) {
  const el = document.getElementById("sr-status");
  if (el) el.textContent = message;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateAriaSort(column, direction) {
  const headers = document.querySelectorAll('[role="button"][aria-sort]');
  headers.forEach((h) => h.setAttribute("aria-sort", "none"));
  const active = document.getElementById(`header-${column}`);
  if (active)
    active.setAttribute(
      "aria-sort",
      direction === "asc" ? "ascending" : "descending",
    );
}

// =============================================================================
// 5. MAIN RENDER - Com fragmento e tratamento de erro
// =============================================================================
export async function renderList(type = "heroes") {
  const tbody = document.getElementById("table-body");
  if (!tbody) return;

  // Estado de loading
  tbody.innerHTML = renderSkeletonRows();

  try {
    const data = await fetchData(`/api/${type}`);
    state.items = data;
    applyFilters();
    renderRows();
    announceStatus(`Lista de ${type} atualizada`);
  } catch (err) {
    console.error(err);
    showError(err.message || "Erro ao buscar dados");
  } finally {
    hideLoader();
  }
}

function renderSkeletonRows() {
  return Array.from(
    { length: 6 },
    () => `
    <tr aria-hidden="true">
      <td><span class="skeleton"></span></td>
      <td><span class="skeleton"></span></td>
    </tr>
  `,
  ).join("");
}

function renderRows() {
  const tbody = document.getElementById("table-body");
  const fragment = document.createDocumentFragment();

  for (const row of getPaginatedRows()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(row.name)}</td><td>${row.value}</td>`;

    // Click/keyboard access
    tr.classList.add("clickable-row");
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.addEventListener("click", () => navigateToDetail(row.id));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateToDetail(row.id);
      }
    });

    fragment.appendChild(tr);
  }
  tbody.innerHTML = "";
  tbody.appendChild(fragment);
}

// =============================================================================
// 6. EVENT HANDLING - Com debounce e prevenção
// =============================================================================
import { debounce } from "./utils.js";

export function bindEvents() {
  document.getElementById("search-input")?.addEventListener(
    "input",
    debounce((e) => {
      state.query = e.target.value.toLowerCase();
      state.page = 1;
      renderRows();
    }, 300),
  );

  document.getElementById("sort-win")?.addEventListener("click", () => {
    handleSort("winRate");
  });
}

function handleSort(column) {
  if (state.sortColumn !== column) {
    state.sortColumn = column;
    state.sortDir = "desc";
  } else if (state.sortDir === "desc") {
    state.sortDir = "asc";
  } else {
    state.sortColumn = null;
  }
  updateAriaSort(column, state.sortDir);
  renderRows();
}

// =============================================================================
// 7. EXPORTS - Apenas o necessário
// =============================================================================
export { state, renderList, bindEvents };
