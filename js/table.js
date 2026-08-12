let currentRowsData = [];
let currentSortColumn = null;
let currentSortDirection = "desc";
let currentType = "heroes";

async function showLastUpdated() {
  const lastMatch = await getLastUpdated();
  const formatted = formatDate(lastMatch);
  document.getElementById("last-updated").textContent = `${t("last_updated_prefix")} ${formatted}`;
}

function onLanguageChange() {
  showLastUpdated();
}

async function renderTable(type) {
  currentType = type;
  const header = document.getElementById("table-name-header");
  let stats, entitiesById, idField;

  if (type === "heroes") {
    header.setAttribute("data-i18n", "table_hero");
    idField = "hero_id";
    [stats, entitiesById] = await Promise.all([getHeroStats(), getHeroesById()]);
  } else if (type === "items") {
    header.setAttribute("data-i18n", "table_item");
    idField = "item_id";
    [stats, entitiesById] = await Promise.all([getItemStats(), getItemsById()]);
  }
  applyTranslations();

  const gameStats = await getGameStats();
  const totalMatches = gameStats[0].total_matches;
  const totalItemSlots = totalMatches * 12;

  currentRowsData = stats.map((stat) => {
    const entity = entitiesById[stat[idField]];
    const winRate = (stat.wins / stat.matches) * 100;
    const pickRate = type === "heroes"
      ? (stat.matches / totalMatches) * 100
      : (stat.matches / totalItemSlots) * 100;
    const imageUrl = type === "heroes" ? entity.images.icon_image_small : entity.shop_image;
    return { name: entity.name, imageUrl, winRate, pickRate };
  });

  currentSortColumn = null;
  renderRows();
}

function renderRows() {
  const tbody = document.getElementById("stats-table-body");
  tbody.innerHTML = "";

  let rows = [...currentRowsData];

  if (currentSortColumn === null) {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    rows.sort((a, b) => {
      const diff = a[currentSortColumn] - b[currentSortColumn];
      return currentSortDirection === "asc" ? diff : -diff;
    });
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${row.imageUrl}" width="32"></td>
      <td>${row.name}</td>
      <td>${row.winRate.toFixed(1)}%</td>
      <td>${row.pickRate.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  }
}

function handleSortClick(column) {
  if (currentSortColumn !== column) {
    currentSortColumn = column;
    currentSortDirection = "desc";
  } else if (currentSortDirection === "desc") {
    currentSortDirection = "asc";
  } else {
    currentSortColumn = null;
  }

  renderRows();
}

function bindClick(elementId, handler) {
  document.getElementById(elementId).addEventListener("click", (event) => {
    event.preventDefault();
    handler(event);
  });
}

bindClick("header-winrate", () => handleSortClick("winRate"));
bindClick("header-pickrate", () => handleSortClick("pickRate"));
bindClick("nav-heroes", () => renderTable("heroes"));
bindClick("nav-items", () => renderTable("items"));

async function init() {
  await initI18n();
  await renderTable("heroes");
  showLastUpdated();
}

init();