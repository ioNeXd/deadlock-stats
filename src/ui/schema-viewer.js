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
  for (const [label, value] of Object.entries(node.constraints ?? {})) {
    if (value != null && value !== false) constraints.push(label + " " + value);
  }

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
