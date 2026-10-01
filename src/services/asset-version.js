import { getClientVersions, getColors } from "./assets.js";

const STORAGE_KEY = "deadlock-stats:client-version";

function normalizeVersions(payload) {
  const values = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
}

export function normalizeColorValue(color) {
  if (Array.isArray(color)) return color.length >= 3 ? color.slice(0, 4).map(Number) : null;
  if (!color || typeof color !== "object") return null;

  const rgba = color.rgba ?? color.value ?? color.color;
  if (Array.isArray(rgba)) return rgba.length >= 3 ? rgba.slice(0, 4).map(Number) : null;

  const channels = ["r", "g", "b"].map(key => color[key]);
  if (channels.every(value => Number.isFinite(Number(value)))) {
    return [...channels, color.a ?? color.alpha ?? 255].map(Number);
  }

  return null;
}

export function colorToCss(color) {
  if (typeof color === "string") return color;
  const rgba = normalizeColorValue(color);
  if (!rgba) return "";
  const [r, g, b, a = 255] = rgba;
  if (![r, g, b, a].every(Number.isFinite)) return "";
  const alpha = a > 1 ? a / 255 : a;
  return "rgba(" + [r, g, b].map(value => Math.max(0, Math.min(255, value))).join(",") + "," +
    Math.max(0, Math.min(1, alpha)) + ")";
}

export function createAssetVersionContext({ storage = globalThis.localStorage } = {}) {
  let selectedVersion = null;
  let versions = [];

  try {
    const stored = Number(storage?.getItem(STORAGE_KEY));
    if (Number.isInteger(stored) && stored >= 0) selectedVersion = stored;
  } catch {}

  return {
    async load(options = {}) {
      const result = await getClientVersions(options);
      versions = normalizeVersions(result?.data);
      if (selectedVersion != null && !versions.includes(selectedVersion)) selectedVersion = null;
      return { ...result, raw: result?.data, data: versions };
    },

    async loadColors(options = {}) {
      return getColors({
        ...options,
        ...(selectedVersion == null ? {} : { clientVersion: selectedVersion }),
      });
    },

    get() {
      return selectedVersion;
    },

    list() {
      return [...versions];
    },

    set(version) {
      if (version === null || version === "" || version === undefined) {
        selectedVersion = null;
      } else {
        const value = Number(version);
        if (!Number.isInteger(value) || value < 0) throw new TypeError("Invalid client version");
        if (versions.length && !versions.includes(value)) throw new RangeError("Unknown client version");
        selectedVersion = value;
      }
      try {
        if (selectedVersion == null) storage?.removeItem(STORAGE_KEY);
        else storage?.setItem(STORAGE_KEY, String(selectedVersion));
      } catch {}
      return selectedVersion;
    },

    options(extra = {}) {
      return selectedVersion == null ? { ...extra } : { ...extra, clientVersion: selectedVersion };
    },
  };
}

export { STORAGE_KEY };
