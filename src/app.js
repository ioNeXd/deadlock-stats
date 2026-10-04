import { API_BASE_URL } from "./api/client.js";
const content = document.querySelector("#page-content");

const navItems = [...document.querySelectorAll(".nav-item")];
let routeController = null;
let runtimePromise = null;
let dashboardPromise = null;
let dashboardStylesPromise = null;
let pageStylesPromise = null;
const stylesheetPromises = new Map();

function ensureStylesheet(href, cacheKey) {
  if (stylesheetPromises.has(cacheKey)) return stylesheetPromises.get(cacheKey);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector('link[data-route-styles="' + href + '"]');
    if (existing) { resolve(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.routeStyles = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error("Stylesheet failed to load: " + href));
    document.head.appendChild(link);
  });
  stylesheetPromises.set(cacheKey, promise);
  return promise;
}

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
  if (!dashboardStylesPromise) dashboardStylesPromise = ensureStylesheet("./src/styles-dashboard.css", "dashboard");
  Promise.all([dashboardPromise, dashboardStylesPromise]).then(([module]) => {
    if (signal.aborted) return;
    module.renderDashboard({ content, signal });
    module.bindVersionControl(() => route());
    module.loadDashboardVersionContext(() => route());
  }).catch(error => {
    if (signal.aborted) return;
    content.innerHTML = '<section class="panel"><p class="error-text">Dashboard failed to load: ' + String(error.message || error) + '</p></section>';
  });
}

async function renderRuntime(signal) {
  if (!runtimePromise) runtimePromise = import("./app-runtime.js");
  if (!pageStylesPromise) pageStylesPromise = ensureStylesheet("./src/styles-app-pages.css", "pages");
  const [runtime] = await Promise.all([runtimePromise, pageStylesPromise]);
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
window.addEventListener("keydown", event => {
  if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) return;
  event.preventDefault();
  import("./command-palette.js").then(module => module.open()).catch(() => {});
}, { passive: false });
route();

window.addEventListener("load", () => {
  setTimeout(() => import("./sw-register.js").catch(() => {}), 1500);
}, { once: true });
