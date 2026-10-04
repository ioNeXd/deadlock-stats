const COMMANDS = [
  { label: "Dashboard", hint: "Command Center", href: "#/" },
  { label: "Matches", hint: "Match explorer", href: "#/matches" },
  { label: "Players", hint: "Player search", href: "#/players" },
  { label: "Heroes", hint: "Hero catalog", href: "#/heroes" },
  { label: "Maps", hint: "Map intelligence", href: "#/maps" },
  { label: "Items", hint: "Item catalog", href: "#/items" },
  { label: "Builds", hint: "Build catalog", href: "#/builds" },
  { label: "Analytics", hint: "Game analytics", href: "#/analytics" },
  { label: "Leaderboard", hint: "Regional ranking", href: "#/leaderboard" },
  { label: "Data Explorer", hint: "OpenAPI operations", href: "#/data" },
  { label: "GraphQL", hint: "GraphQL playground", href: "#/graphql" },
  { label: "Advanced Tools", hint: "Demo, live query and custom matches", href: "#/tools" },
  { label: "API Status", hint: "Health and diagnostics", href: "#/api" },
];

const state = { open: false, index: 0, query: "" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function filteredCommands() {
  const query = state.query.trim().toLowerCase();
  if (!query) return COMMANDS;
  return COMMANDS.filter(command =>
    (command.label + " " + command.hint).toLowerCase().includes(query)
  );
}

function render() {
  const root = document.querySelector("#command-palette");
  if (!root) return;
  const commands = filteredCommands();
  state.index = Math.max(0, Math.min(state.index, Math.max(0, commands.length - 1)));
  root.hidden = !state.open;
  if (!state.open) return;
  root.querySelector("[data-command-palette-input]").value = state.query;
  root.querySelector("[data-command-palette-list]").innerHTML = commands.length
    ? commands.map((command, index) =>
        '<button type="button" class="command-palette-item' + (index === state.index ? " selected" : "") +
        '" data-command-index="' + index + '">' +
        '<span><strong>' + escapeHtml(command.label) + '</strong><small>' + escapeHtml(command.hint) + '</small></span>' +
        '<kbd>↵</kbd></button>'
      ).join("")
    : '<p class="command-palette-empty">No commands match your search.</p>';
  root.querySelector("[data-command-palette-count]").textContent = commands.length + " commands";
}

function open() {
  state.open = true;
  state.index = 0;
  render();
  requestAnimationFrame(() => document.querySelector("[data-command-palette-input]")?.focus());
}

function close() {
  state.open = false;
  state.query = "";
  render();
}

function execute(index = state.index) {
  const command = filteredCommands()[index];
  if (!command) return;
  close();
  location.hash = command.href;
}

function bind() {
  loadStyles();
  if (document.querySelector("#command-palette")) return;
  const root = document.createElement("div");
  root.id = "command-palette";
  root.className = "command-palette";
  root.hidden = true;
  root.innerHTML =
    '<div class="command-palette-backdrop" data-command-close></div>' +
    '<section class="command-palette-dialog" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">' +
      '<div class="command-palette-head"><div><span class="eyebrow">NAVIGATION / COMMAND</span><h2 id="command-palette-title">Command Palette</h2></div><kbd>ESC</kbd></div>' +
      '<input data-command-palette-input class="command-palette-input" type="search" autocomplete="off" spellcheck="false" placeholder="Jump to a section…" aria-label="Search commands">' +
      '<div class="command-palette-meta"><span data-command-palette-count></span><span>↑ ↓ navigate · Enter open</span></div>' +
      '<div data-command-palette-list class="command-palette-list"></div>' +
    '</section>';
  document.body.appendChild(root);

  root.addEventListener("click", event => {
    if (event.target.closest("[data-command-close]")) close();
    const item = event.target.closest("[data-command-index]");
    if (item) execute(Number(item.dataset.commandIndex));
  });
  root.querySelector("[data-command-palette-input]").addEventListener("input", event => {
    state.query = event.target.value;
    state.index = 0;
    render();
  });
  document.addEventListener("keydown", event => {
    if (!state.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      state.index = Math.min(state.index + 1, Math.max(0, filteredCommands().length - 1));
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.index = Math.max(state.index - 1, 0);
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute();
    }
  });
}

function loadStyles() {
  if (document.querySelector('link[data-command-palette-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/styles-command-palette.css";
  link.dataset.commandPaletteStyles = "true";
  document.head.appendChild(link);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bind, { once: true });
} else {
  bind();
}

export { open };
