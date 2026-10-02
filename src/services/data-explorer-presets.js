const STORAGE_KEY = "deadlock-stats:data-explorer:user-presets:v1";

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readAll() {
  const store = storage();
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.presets) ? parsed.presets.filter(isValidPreset) : [];
  } catch {
    return [];
  }
}

function writeAll(presets) {
  const store = storage();
  if (!store) return false;

  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, presets }));
    return true;
  } catch {
    return false;
  }
}

function isValidPreset(preset) {
  return Boolean(
    preset &&
    typeof preset === "object" &&
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    preset.name.trim() &&
    typeof preset.operationKey === "string" &&
    typeof preset.mediaType === "string" &&
    Object.prototype.hasOwnProperty.call(preset, "value"),
  );
}

function cloneValue(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Preset value must be JSON-serializable.");
  return JSON.parse(serialized);
}

function presetId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "preset-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

export function listUserRequestPresets(operationKey, mediaType) {
  if (!operationKey || !mediaType) return [];

  return readAll()
    .filter(preset => preset.operationKey === operationKey && preset.mediaType === mediaType)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function saveUserRequestPreset({ operationKey, mediaType, name, value }) {
  if (!operationKey || !mediaType) throw new TypeError("Preset operation and media type are required.");

  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) throw new TypeError("Preset name is required.");

  const clonedValue = cloneValue(value);
  const now = new Date().toISOString();
  const presets = readAll();
  const existing = presets.find(
    preset => preset.operationKey === operationKey &&
      preset.mediaType === mediaType &&
      preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
  );

  if (existing) {
    existing.name = normalizedName;
    existing.value = clonedValue;
    existing.updatedAt = now;
  } else {
    presets.push({
      id: presetId(),
      name: normalizedName,
      operationKey,
      mediaType,
      value: clonedValue,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!writeAll(presets)) throw new Error("Unable to persist request preset.");
  return listUserRequestPresets(operationKey, mediaType).find(
    preset => preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
  ) ?? null;
}

export function deleteUserRequestPreset(id) {
  if (!id) return false;
  const presets = readAll();
  const next = presets.filter(preset => preset.id !== id);
  if (next.length === presets.length) return false;
  if (!writeAll(next)) throw new Error("Unable to persist request preset.");
  return true;
}

export function clearUserRequestPresets() {
  const store = storage();
  if (!store) return false;

  try {
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export const USER_REQUEST_PRESET_STORAGE_KEY = STORAGE_KEY;
