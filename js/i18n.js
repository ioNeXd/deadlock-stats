const availableLanguages = [
  { code: "en", label: "English", flag: "us" },
  { code: "pt-br", label: "Português (BR)", flag: "br" },
];

let currentLang = "en";
let currentTranslations = {};

async function loadTranslations(lang) {
  const url = `translations/${lang}.json`;
  const response = await fetch(url);
  currentTranslations = await response.json();
  currentLang = lang;
  document.documentElement.lang = lang;
}

function applyTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    if (currentTranslations[key]) {
      el.textContent = currentTranslations[key];
    }
  }
}

function t(key) {
  return currentTranslations[key] || key;
}

function buildLanguageMenu() {
  const menu = document.getElementById("lang-menu");
  menu.innerHTML = "";
  for (const lang of availableLanguages) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = lang.label;
    button.style.setProperty("--flag-url", `url(https://flagcdn.com/w40/${lang.flag}.png)`);
    button.classList.add("lang-option");
    button.addEventListener("click", () => selectLanguage(lang.code));
    li.appendChild(button);
    menu.appendChild(li);
  }
}

function updateLangToggle() {
  const current = availableLanguages.find((lang) => lang.code === currentLang);
  const toggle = document.getElementById("lang-toggle");
  if (current) {
    toggle.style.backgroundImage = `url(https://flagcdn.com/w80/${current.flag}.png)`;
  }
  toggle.setAttribute("aria-label", t("lang_selector_label"));
}

function closeLangMenu() {
  document.getElementById("lang-menu").classList.add("hidden");
  document.getElementById("lang-toggle").setAttribute("aria-expanded", "false");
}

function toggleLangMenu() {
  const menu = document.getElementById("lang-menu");
  const isOpen = !menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  document.getElementById("lang-toggle").setAttribute("aria-expanded", String(!isOpen));
}

async function selectLanguage(lang) {
  await loadTranslations(lang);
  applyTranslations();
  updateLangToggle();
  localStorage.setItem("lang", lang);
  closeLangMenu();

  if (typeof onLanguageChange === "function") {
    onLanguageChange();
  }
}

function setupLanguageSwitcher() {
  buildLanguageMenu();
  updateLangToggle();

  document.getElementById("lang-toggle").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLangMenu();
  });

  document.addEventListener("click", (event) => {
    const switcher = document.getElementById("lang-switcher");
    if (!switcher.contains(event.target)) {
      closeLangMenu();
    }
  });
}

async function initI18n() {
  const savedLang = localStorage.getItem("lang") || "en";
  await loadTranslations(savedLang);
  applyTranslations();
  setupLanguageSwitcher();
}