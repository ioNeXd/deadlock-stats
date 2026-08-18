// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

/**
 * List of supported languages with their labels and flag codes.
 * @type {Array<{code: string, label: string, flag: string}>}
 */
const availableLanguages = [
  { code: "en", label: "English", flag: "us" },
  { code: "pt-br", label: "Português (BR)", flag: "br" },
];

let currentLang = "en";
let currentTranslations = {};
let baseTranslations = {};
const missingKeys = new Set();
const translationCache = new Map();
let languageChangeHandler = null;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely reads a value from localStorage without throwing.
 *
 * @param {string} key - The storage key.
 * @returns {string|null} The stored value or null if access fails.
 */
function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage get failed", e);
    return null;
  }
}

/**
 * Safely writes a value to localStorage without throwing.
 *
 * @param {string} key - The storage key.
 * @param {*} value - The value to store.
 */
function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("localStorage set failed", e);
  }
}

/**
 * Fetches and caches translation JSON for a given language.
 *
 * @param {string} lang - The language code (e.g., "en", "pt-br").
 * @returns {Promise<Object>} The translation object.
 * @throws {Error} If the fetch fails.
 */
async function fetchTranslations(lang) {
  if (translationCache.has(lang)) return translationCache.get(lang);
  const res = await fetch(`translations/${lang}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  translationCache.set(lang, data);
  return data;
}

// =============================================================================
// CORE TRANSLATION FUNCTIONS
// =============================================================================

/**
 * Loads the base (English) translations and then overlays the selected language.
 *
 * @param {string} lang - The language code to load.
 * @returns {Promise<void>}
 */
async function loadTranslations(lang) {
  if (!Object.keys(baseTranslations).length) {
    try {
      baseTranslations = await fetchTranslations("en");
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
    const loaded = await fetchTranslations(lang);
    currentTranslations = { ...baseTranslations, ...loaded };
    currentLang = lang;
    document.documentElement.lang = lang;
  } catch (err) {
    console.warn(
      `Failed to load translations for ${lang}, falling back to English:`,
      err,
    );
    currentTranslations = { ...baseTranslations };
    currentLang = "en";
    document.documentElement.lang = "en";
  }
}

/**
 * Translates a key using the current language, falling back to English.
 *
 * @param {string} key - The translation key.
 * @returns {string} The translated text or the key if missing.
 */
export function t(key) {
  if (key == null) return "";
  if (
    currentTranslations &&
    Object.prototype.hasOwnProperty.call(currentTranslations, key)
  ) {
    return currentTranslations[key];
  }
  if (
    baseTranslations &&
    Object.prototype.hasOwnProperty.call(baseTranslations, key)
  ) {
    missingKeys.add(`${currentLang}:${key}`);
    return baseTranslations[key];
  }
  const missingId = `${currentLang}:${key}`;
  if (!missingKeys.has(missingId)) {
    console.warn(`Missing translation for key: ${missingId}`);
    missingKeys.add(missingId);
  }
  return key;
}

/**
 * Retrieves a localized text string by key, falling back to a default.
 *
 * @param {string} key - The translation key.
 * @param {string} fallback - Fallback text if key is not found.
 * @returns {string} The localized or fallback text.
 */
export function getLocalText(key, fallback) {
  if (
    currentTranslations &&
    Object.prototype.hasOwnProperty.call(currentTranslations, key)
  ) {
    return currentTranslations[key];
  }
  if (
    baseTranslations &&
    Object.prototype.hasOwnProperty.call(baseTranslations, key)
  ) {
    return baseTranslations[key];
  }
  return fallback;
}

/**
 * Registers a callback invoked whenever the active language changes.
 *
 * @param {Function} fn - The handler to call on language change.
 */
export function setLanguageChangeHandler(fn) {
  languageChangeHandler = fn;
}

/**
 * Applies all data-i18n attributes to DOM elements by replacing their text content.
 */
export function applyTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  }
}

/**
 * Logs a summary of all missing translation keys to the console.
 */
function reportMissingTranslations() {
  if (missingKeys.size === 0) return;
  const summary = {};
  for (const key of missingKeys) {
    summary[key] = (summary[key] || 0) + 1;
  }
  console.table(summary);
}

// =============================================================================
// LANGUAGE SWITCHER UI
// =============================================================================

/**
 * Builds the language dropdown menu from the availableLanguages list.
 */
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
      `url(https://flagcdn.com/32x24/${lang.flag}.png)`,
    );
    button.classList.add("lang-option");
    button.addEventListener("click", async () => {
      await selectLanguage(lang.code);
    });
    li.appendChild(button);
    menu.appendChild(li);
  }
}

/**
 * Updates the language toggle button with the flag of the current language.
 */
function updateLangToggle() {
  const current =
    availableLanguages.find((lang) => lang.code === currentLang) ||
    availableLanguages[0];
  const toggle = document.getElementById("lang-toggle");
  if (!toggle) return;
  if (current) {
    toggle.style.backgroundImage = `url(https://flagcdn.com/32x24/${current.flag}.png)`;
  }
  toggle.setAttribute("aria-label", t("lang_selector_label"));
}

/**
 * Closes the language dropdown menu.
 */
function closeLangMenu() {
  const menu = document.getElementById("lang-menu");
  const toggle = document.getElementById("lang-toggle");
  if (menu) menu.classList.add("hidden");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

/**
 * Toggles the open/closed state of the language dropdown menu.
 */
function toggleLangMenu() {
  const menu = document.getElementById("lang-menu");
  if (!menu) return;
  const isOpen = !menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  const toggle = document.getElementById("lang-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", String(!isOpen));
}

/**
 * Switches the active language, updates the UI, and stores the preference.
 *
 * @param {string} lang - The language code to select.
 * @returns {Promise<void>}
 */
export async function selectLanguage(lang) {
  try {
    await loadTranslations(lang);
    applyTranslations();
    updateLangToggle();
    safeSetLocalStorage("lang", lang);
    closeLangMenu();

    if (typeof languageChangeHandler === "function") languageChangeHandler();
  } catch (err) {
    console.error("selectLanguage failed", err);
    applyTranslations();
    updateLangToggle();
  }
}

/**
 * Sets up event listeners for the language switcher and click-outside behavior.
 */
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

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the i18n system: loads saved language, applies translations,
 * reports missing keys, and sets up the language switcher.
 *
 * @returns {Promise<void>}
 */
export async function initI18n() {
  const savedLang = safeGetLocalStorage("lang") || "en";
  await loadTranslations(savedLang);
  applyTranslations();
  reportMissingTranslations();
  setupLanguageSwitcher();
}