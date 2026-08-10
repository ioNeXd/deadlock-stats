async function applyTranslation(lang = "en") {
  const url = `translations/${lang}.json`;
  const response = await fetch(url);
  const translations = await response.json();

  const elements = document.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) {
      el.textContent = translations[key];
    }
  }
}

applyTranslation("en");