const fs = require("fs");
const path = require("path");

const TRANSLATIONS_DIR = path.join(__dirname, "..", "translations");
const REFERENCE_LANG = "en.json";

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function main() {
  const referencePath = path.join(TRANSLATIONS_DIR, REFERENCE_LANG);

  if (!fs.existsSync(referencePath)) {
    console.error(`❌ Reference file not found: ${referencePath}`);
    process.exit(1);
  }

  const reference = loadJson(referencePath);
  const referenceKeys = new Set(flattenKeys(reference));

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
      console.error(`❌ ${file}: invalid JSON — ${err.message}`);
      hasErrors = true;
      continue;
    }

    const fileKeys = new Set(flattenKeys(translation));

    const missingKeys = [...referenceKeys].filter((k) => !fileKeys.has(k));
    const extraKeys = [...fileKeys].filter((k) => !referenceKeys.has(k));

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      console.log(`✅ ${file}: OK (${fileKeys.size} keys)`);
      continue;
    }

    hasErrors = true;
    console.error(`❌ ${file}:`);

    if (missingKeys.length > 0) {
      console.error(`   Missing (${missingKeys.length}):`);
      for (const key of missingKeys) console.error(`     - ${key}`);
    }

    if (extraKeys.length > 0) {
      console.error(`   Extra / possible typos (${extraKeys.length}):`);
      for (const key of extraKeys) console.error(`     - ${key}`);
    }
  }

  if (hasErrors) {
    console.error("\nTranslation validation failed.");
    process.exit(1);
  }

  console.log("\nAll translations are synchronized with en.json.");
}

main();
