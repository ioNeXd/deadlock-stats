function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const heroId = params.get("hero");
  if (heroId !== null && heroId !== "") {
    return { view: "hero", heroId: Number(heroId) };
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

function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);
}

function navigateToHero(heroId) {
  window.location.hash = `hero=${heroId}`;
}

function navigateToTable() {
  window.location.hash = "";
}
