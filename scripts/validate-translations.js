
const fs = require("fs");
const path = require("path");

const TRANSLATIONS_DIR = path.join(__dirname, "..", "translations");
const REFERENCE_LANG = "en.json";

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function main() {
  const referencePath = path.join(TRANSLATIONS_DIR, REFERENCE_LANG);

  if (!fs.existsSync(referencePath)) {
    console.error(`❌ Arquivo de referência não encontrado: ${referencePath}`);
    process.exit(1);
  }

  const reference = loadJson(referencePath);
  const referenceKeys = new Set(Object.keys(reference));

  const files = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((f) => f.endsWith(".json") && f !== REFERENCE_LANG);

  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(TRANSLATIONS_DIR, file);
    let translation;

    try {
      translation = loadJson(filePath);
    } catch (err) {
      console.error(`❌ ${file}: JSON inválido — ${err.message}`);
      hasErrors = true;
      continue;
    }

    const fileKeys = new Set(Object.keys(translation));

    const missingKeys = [...referenceKeys].filter((k) => !fileKeys.has(k));
    const extraKeys = [...fileKeys].filter((k) => !referenceKeys.has(k));

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      console.log(`✅ ${file}: OK (${fileKeys.size} chaves)`);
      continue;
    }

    hasErrors = true;
    console.error(`❌ ${file}:`);

    if (missingKeys.length > 0) {
      console.error(`   Faltando (${missingKeys.length}):`);
      for (const key of missingKeys) console.error(`     - ${key}`);
    }

    if (extraKeys.length > 0) {
      console.error(`   Chaves extras / possível erro de digitação (${extraKeys.length}):`);
      for (const key of extraKeys) console.error(`     - ${key}`);
    }
  }

  if (hasErrors) {
    console.error("\nValidação de traduções falhou.");
    process.exit(1);
  }

  console.log("\nTodas as traduções estão sincronizadas com en.json.");
}

main();