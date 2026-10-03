import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

test("shell exposes skip navigation and labelled primary navigation", () => {
  assert.match(index, /class="skip-link"[^>]+href="#main-content"/);
  assert.match(index, /<nav class="nav" aria-label="Primary navigation">/);
  assert.match(index, /<main class="main" id="main-content">/);
});

test("router exposes the active page to assistive technology", () => {
  assert.match(app, /setAttribute\("aria-current", "page"\)/);
  assert.match(app, /removeAttribute\("aria-current"\)/);
});

test("keyboard focus remains visibly distinguishable", () => {
  assert.match(css, /:where\(a,button,input,select,textarea\):focus-visible/);
  assert.match(css, /\.skip-link:[^\{]*focus/);
});
