const availableLanguages = [
  { code: "en", label: "English", flag: "us" },
  { code: "pt-br", label: "Português (BR)", flag: "br" },
];

let currentLang = "en";
let currentTranslations = {};
let baseTranslations = {}; // English fallback
const missingKeys = new Set();

// Safe localStorage helpers
function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage get failed", e);
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("localStorage set failed", e);
  }
}

// Load translations with fallback to English and merge
async function loadTranslations(lang) {
  // Ensure base (en) is loaded first for fallback
  if (!Object.keys(baseTranslations).length) {
    try {
      const res = await fetch(`translations/en.json`);
      baseTranslations = await res.json();
    } catch (err) {
      console.warn("Failed to load base English translations:", err);
      baseTranslations = {};
    }
  }

  if (lang === "en") {
    currentTranslations = { ...baseTranslations };
    currentLang = "en";
    document.documentElement.lang = "en";
    return;
  }

  try {
    const res = await fetch(`translations/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const loaded = await res.json();
    // overlay: keys in loaded override base
    currentTranslations = { ...baseTranslations, ...loaded };
    currentLang = lang;
    document.documentElement.lang = lang;
  } catch (err) {
    console.warn(
      `Failed to load translations for ${lang}, falling back to English:`,
      err,
    );
    // fallback to base
    currentTranslations = { ...baseTranslations };
    currentLang = "en";
    document.documentElement.lang = "en";
  }
}

function applyTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  }
}

function t(key) {
  if (key == null) return "";
  if (
    currentTranslations &&
    Object.prototype.hasOwnProperty.call(currentTranslations, key)
  ) {
    return currentTranslations[key];
  }
  // fallback to base
  if (
    baseTranslations &&
    Object.prototype.hasOwnProperty.call(baseTranslations, key)
  ) {
    missingKeys.add(`${currentLang}:${key}`);
    return baseTranslations[key];
  }
  // last resort: warn once and return the key
  const missingId = `${currentLang}:${key}`;
  if (!missingKeys.has(missingId)) {
    console.warn(`Missing translation for key: ${missingId}`);
    missingKeys.add(missingId);
  }
  return key;
}

function reportMissingTranslations() {
  if (missingKeys.size === 0) return;
  const summary = {};
  for (const key of missingKeys) {
    summary[key] = (summary[key] || 0) + 1;
  }
  console.table(summary);
}

function buildLanguageMenu() {
  const menu = document.getElementById("lang-menu");
  if (!menu) return;
  menu.innerHTML = "";
  for (const lang of availableLanguages) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = lang.label;
    button.style.setProperty(
      "--flag-url",
      `url(https://flagcdn.com/w40/${lang.flag}.png)`,
    );
    button.classList.add("lang-option");
    button.addEventListener("click", async () => {
      await selectLanguage(lang.code);
    });
    li.appendChild(button);
    menu.appendChild(li);
  }
}

function updateLangToggle() {
  const current =
    availableLanguages.find((lang) => lang.code === currentLang) ||
    availableLanguages[0];
  const toggle = document.getElementById("lang-toggle");
  if (!toggle) return;
  if (current) {
    toggle.style.backgroundImage = `url(https://flagcdn.com/w80/${current.flag}.png)`;
  }
  toggle.setAttribute("aria-label", t("lang_selector_label"));
}

function closeLangMenu() {
  const menu = document.getElementById("lang-menu");
  const toggle = document.getElementById("lang-toggle");
  if (menu) menu.classList.add("hidden");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function toggleLangMenu() {
  const menu = document.getElementById("lang-menu");
  if (!menu) return;
  const isOpen = !menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  const toggle = document.getElementById("lang-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", String(!isOpen));
}

async function selectLanguage(lang) {
  try {
    await loadTranslations(lang);
    applyTranslations();
    updateLangToggle();
    safeSetLocalStorage("lang", lang);
    closeLangMenu();

    if (typeof onLanguageChange === "function") onLanguageChange();
  } catch (err) {
    console.error("selectLanguage failed", err);
    // show a minimal user-facing fallback
    applyTranslations();
    updateLangToggle();
  }
}

function setupLanguageSwitcher() {
  buildLanguageMenu();
  updateLangToggle();

  const toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLangMenu();
    });
  }

  document.addEventListener("click", (event) => {
    const switcher = document.getElementById("lang-switcher");
    if (!switcher || !switcher.contains(event.target)) {
      closeLangMenu();
    }
  });
}

async function initI18n() {
  const savedLang = safeGetLocalStorage("lang") || "en";
  await loadTranslations(savedLang);
  applyTranslations();
  reportMissingTranslations();
  setupLanguageSwitcher();
}
