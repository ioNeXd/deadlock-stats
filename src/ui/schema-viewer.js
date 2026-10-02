function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function schemaExampleValue(value) {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function schemaNodeHtml(node) {
  if (!node) return "";

  const typeMeta = [
    node.type,
    node.format,
    node.required ? "required" : "optional",
    node.nullable ? "nullable" : "",
  ].filter(Boolean).join(" · ");

  const constraints = [];
  if (node.minimum != null) constraints.push("min " + node.minimum);
  if (node.maximum != null) constraints.push("max " + node.maximum);
  if (node.exclusiveMinimum != null) constraints.push("exclusive min " + node.exclusiveMinimum);
  if (node.exclusiveMaximum != null) constraints.push("exclusive max " + node.exclusiveMaximum);
  if (node.multipleOf != null) constraints.push("multiple of " + node.multipleOf);
  if (node.minLength != null) constraints.push("min length " + node.minLength);
  if (node.maxLength != null) constraints.push("max length " + node.maxLength);
  if (node.pattern) constraints.push("pattern " + node.pattern);
  if (node.minItems != null) constraints.push("min items " + node.minItems);
  if (node.maxItems != null) constraints.push("max items " + node.maxItems);
  if (node.uniqueItems) constraints.push("unique items");

  const enumHtml = node.enum?.length
    ? '<div class="schema-view-enum"><span>ENUM</span><code>' + escapeHtml(node.enum.map(value => schemaExampleValue(value)).join(" · ")) + '</code></div>'
    : "";

  const example = node.example !== undefined
    ? '<div class="schema-view-example"><span>EXAMPLE</span><code>' + escapeHtml(schemaExampleValue(node.example)) + '</code></div>'
    : (node.examples?.length
      ? '<div class="schema-view-example"><span>EXAMPLES</span><code>' + escapeHtml(node.examples.map(schemaExampleValue).join(" · ")) + '</code></div>'
      : "");

  const defaultValue = node.default !== undefined
    ? '<div class="schema-view-example"><span>DEFAULT</span><code>' + escapeHtml(schemaExampleValue(node.default)) + '</code></div>'
    : "";

  const variants = ["oneOf", "anyOf", "allOf"].flatMap(keyword =>
    (node[keyword] ?? []).map(variant =>
      '<div class="schema-view-variant"><span>' + keyword.toUpperCase() + '</span>' + schemaNodeHtml(variant) + '</div>'
    )
  ).join("");

  const children = node.type === "object"
    ? (node.properties ?? []).map(schemaNodeHtml).join("")
    : node.type === "array" && node.items
      ? '<div class="schema-view-item"><span>ITEMS</span>' + schemaNodeHtml(node.items) + '</div>'
      : "";

  let additional = "";
  if (node.type === "object" && node.additionalProperties !== undefined) {
    if (node.additionalProperties === false) {
      additional = '<div class="schema-view-item"><span>ADDITIONAL PROPERTIES</span><code>false</code></div>';
    } else if (node.additionalProperties === true) {
      additional = '<div class="schema-view-item"><span>ADDITIONAL PROPERTIES</span><code>true</code></div>';
    } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
      additional = '<div class="schema-view-item"><span>ADDITIONAL PROPERTIES</span>' + schemaNodeHtml(node.additionalProperties) + '</div>';
    }
  }

  return '<div class="schema-view-node" style="--schema-depth:' + Math.min(node.depth ?? 0, 8) + '">' +
    '<div class="schema-view-title"><strong>' + escapeHtml(node.name) + '</strong><span>' + escapeHtml(typeMeta) + '</span></div>' +
    (node.title && node.title !== node.name ? '<div class="schema-view-meta">' + escapeHtml(node.title) + '</div>' : '') +
    (node.description ? '<p class="muted">' + escapeHtml(node.description) + '</p>' : '') +
    (constraints.length ? '<div class="schema-view-constraints">' + escapeHtml(constraints.join(" · ")) + '</div>' : '') +
    enumHtml + defaultValue + example + children + additional + variants +
    '</div>';
}

export function renderSchemaViewer(model, title = "Schema") {
  if (!model) return "";
  return '<details class="schema-viewer"><summary><span class="eyebrow">SCHEMA</span><strong>' +
    escapeHtml(title) +
    '</strong></summary><div class="schema-view-body">' +
    schemaNodeHtml(model) +
    '</div></details>';
}
