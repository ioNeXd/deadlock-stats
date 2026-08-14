function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const rawHeroId = params.get("hero");
  if (rawHeroId !== null && rawHeroId !== "") {
    const heroId = Number(rawHeroId);
    // Valida: só aceita inteiro positivo (NaN, negativo, decimal → tabela).
    if (Number.isInteger(heroId) && heroId > 0) {
      return { view: "hero", heroId };
    }
  }
  return { view: "table" };
}

function showView(view) {
  const tableView = document.getElementById("table-view");
  const heroView = document.getElementById("hero-detail-view");
  if (view === "hero") {
    tableView.classList.add("hidden");
    heroView.classList.remove("hidden");
  } else {
    heroView.classList.add("hidden");
    tableView.classList.remove("hidden");
  }
}

async function handleRouteChange() {
  const route = parseHash();
  showView(route.view);
  if (route.view === "hero") {
    await renderHeroDetail(route.heroId);
  } else if (typeof onTableRouteActive === "function") {
    onTableRouteActive();
  }
}

// Guarda defensiva para chamadas diretas a renderHeroDetail.
function isValidHeroId(heroId) {
  const num = Number(heroId);
  return Number.isInteger(num) && num > 0;
}

function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);
}

function navigateToHero(heroId) {
  window.location.hash = `hero=${heroId}`;
}

function navigateToTable() {
  window.location.hash = "";
}
