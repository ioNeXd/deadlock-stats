export function safeExternalUrl(value) {
  if (value == null || value === "") return "";

  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
