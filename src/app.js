import { API_BASE_URL } from "./api/client.js";
const content = document.querySelector("#page-content");
function loadFullStylesheet() {
  if (document.querySelector('link[data-deferred-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "src/styles.css";
  link.dataset.deferredStyles = "true";
  document.head.appendChild(link);
}

const navItems = [...document.querySelectorAll(".nav-item")];
let routeController = null;
let runtimePromise = null;
let dashboardPromise = null;

function beginRoute() {
  routeController?.abort();
  routeController = new AbortController();
  return routeController.signal;
}

function routeName() {
  return location.hash.replace(/^#\/?/, "").split("/")[0] || "dashboard";
}

function updateNavigation(name) {
  navItems.forEach(item => {
    const active = item.getAttribute("href") === "#/" + (name === "dashboard" ? "" : name);
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
}

function renderDashboard(signal) {
  if (!dashboardPromise) dashboardPromise = import("./dashboard-route.js");
  dashboardPromise.then(module => {
    if (signal.aborted) return;
    module.renderDashboard({ content, signal, assetVersion });
    module.bindVersionControl(() => route());
    module.loadDashboardVersionContext(() => route());
  }).catch(error => {
    if (signal.aborted) return;
    content.innerHTML = '<section class="panel"><p class="error-text">Dashboard failed to load: ' + String(error.message || error) + '</p></section>';
  });
}

async function renderRuntime(signal) {
  if (!runtimePromise) runtimePromise = import("./app-runtime.js");
  const runtime = await runtimePromise;
  if (signal.aborted) return;
  runtime.route(signal);
}

function route() {
  const signal = beginRoute();
  const name = routeName();
  updateNavigation(name);
  if (name === "dashboard") {
    renderDashboard(signal);
  } else {
    renderRuntime(signal).catch(error => {
      if (signal.aborted) return;
      content.innerHTML = '<section class="panel"><p class="error-text">Application runtime failed to load: ' + String(error.message || error) + '</p></section>';
    });
  }
}

window.addEventListener("hashchange", route);
route();
requestAnimationFrame(() => requestAnimationFrame(loadFullStylesheet));

const idle = window.requestIdleCallback || (callback => setTimeout(callback, 5000));
idle(() => {
  import("./command-palette.js").catch(() => {});
  import("./sw-register.js").catch(() => {});
});
