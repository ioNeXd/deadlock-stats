import {
  buildCustomMatchBody,
  customMatchAction,
  createCustomMatchFromForm,
  getDemoQueryStatusSnapshot,
  ingestLiveUrlsFromForm,
  loadCustomMatchId,
  loadDemoSchema,
  loadLiveUrls,
  normalizeDemoStatus,
  parseSseEventBlock,
  normalizeDemoSchema,
  normalizeLiveUrls,
  runLiveQuery,
  submitDemoQueryFromForm,
} from "./services/advanced-tools.js";
import { safeExternalUrl } from "./ui/security.js";

const root = document.querySelector("#page-content");
let controller = null;
let statusTimer = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const abortPrevious = () => {
  controller?.abort();
  controller = new AbortController();
  clearTimeout(statusTimer);
  return controller.signal;
};

export function renderAdvancedTools() {
  if (!location.hash.replace(/^#\/?/, "").startsWith("tools")) return;
  const signal = abortPrevious();
  root.innerHTML = `
    <section class="page-head">
      <span class="eyebrow">TOOLS / ADVANCED</span>
      <h2>Advanced Match Tools</h2>
      <p>Direct interfaces for the current Demo, Live Query and Custom Match API capabilities.</p>
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <div class="section-head"><div><span class="eyebrow">DEMO</span><h3>Schema & SQL</h3></div><span id="demo-status" class="muted">READY</span></div>
        <form id="demo-form" class="tool-form">
          <label>Match ID <input name="match_id" type="number" min="0" placeholder="optional for schema"></label>
          <label>Output <select name="format"><option value="">Default</option><option value="parquet">Parquet</option><option value="ndjson">NDJSON</option></select></label>
          <label>SQL query <textarea name="query" rows="7" placeholder="select * from player_stats limit 20"></textarea></label>
          <div class="panel-actions"><button class="button" type="button" id="demo-schema">Load schema</button><button class="button" type="submit">Queue query</button></div>
        </form>
        <pre id="demo-output" class="tool-output" aria-live="polite">No demo operation yet.</pre>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="eyebrow">LIVE</span><h3>Live Query / Broadcasts</h3></div><span id="live-status" class="muted">READY</span></div>
        <form id="live-form" class="tool-form">
          <label>Match ID <input name="match_id" type="number" min="0"></label>
          <label>Broadcast URL <input name="broadcast_url" type="url" placeholder="https://…"></label>
          <label>SQL query <textarea name="query" rows="5" placeholder="select * from player_stats"></textarea></label>
          <div class="panel-actions"><button class="button" type="submit">Start SSE query</button><button class="button" type="button" id="live-refresh">Refresh broadcasts</button></div>
        </form>
        <pre id="live-output" class="tool-output" aria-live="polite">No live operation yet.</pre>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="eyebrow">CUSTOM MATCH</span><h3>Lobby controls</h3></div><span id="custom-status" class="muted">READY</span></div>
        <form id="custom-form" class="tool-form">
          <label>Game mode <select name="game_mode"><option value="">API default</option><option value="normal">normal</option><option value="street_brawl">street_brawl</option><option value="explore_n_y_c">explore_n_y_c</option><option value="internal">internal</option></select></label>
          <label>Server region <select name="server_region"><option value="">API default</option><option value="europe">europe</option><option value="eu_amsterdam">eu_amsterdam</option><option value="eu_poland">eu_poland</option><option value="eu_stockholm">eu_stockholm</option><option value="eu_helsinki">eu_helsinki</option><option value="eu_falkenstein">eu_falkenstein</option><option value="eu_spain">eu_spain</option><option value="eu_east">eu_east</option><option value="eu_london">eu_london</option><option value="south_africa">south_africa</option><option value="us_west">us_west</option><option value="us_east">us_east</option><option value="us_north_central">us_north_central</option><option value="us_south_central">us_south_central</option><option value="us_south_east">us_south_east</option><option value="us_south_west">us_south_west</option><option value="australia">australia</option><option value="singapore">singapore</option><option value="japan">japan</option><option value="hong_kong">hong_kong</option><option value="mp_hong_kong">mp_hong_kong</option><option value="seoul">seoul</option><option value="chile">chile</option><option value="peru">peru</option><option value="argentina">argentina</option><option value="south_america">south_america</option></select></label>
          <label>Roster size <input name="min_roster_size" type="number" min="0" step="1" placeholder="optional"></label>
          <label>Corrupted shop spawn (min) <input name="corrupted_item_shop_spawn_minutes" type="number" min="0" step="1" placeholder="optional"></label>
          <label>Callback URL <input name="callback_url" type="url" placeholder="optional"></label>
          <label><input name="disable_auto_ready" type="checkbox"> Disable auto-ready</label>
          <label><input name="duplicate_heroes_enabled" type="checkbox"> Allow duplicate heroes</label>
          <label><input name="cheats_enabled" type="checkbox"> Enable cheats</label>
          <label><input name="is_publicly_visible" type="checkbox"> Publicly visible</label>
          <label><input name="randomize_lanes" type="checkbox"> Randomize lanes</label>
          <div class="panel-actions"><button class="button" type="submit">Create lobby</button></div>
        </form>
        <div id="custom-actions" class="panel-actions" hidden>
          <input id="custom-lobby-id" placeholder="Lobby ID">
          <button class="button" data-custom-action="ready">Ready</button>
          <button class="button" data-custom-action="unready">Unready</button>
          <button class="button" data-custom-action="start">Start</button>
          <button class="button" data-custom-action="leave">Leave</button>
        </div>
        <pre id="custom-output" class="tool-output" aria-live="polite">No custom lobby yet.</pre>
      </article>
    </section>`;
  bind(signal);
}

function write(id, value) {
  const node = document.querySelector(id);
  if (node) node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function bind(signal) {
  const demoForm = document.querySelector("#demo-form");
  const schemaButton = document.querySelector("#demo-schema");
  schemaButton.addEventListener("click", async () => {
    const matchId = demoForm.elements.match_id.value;
    write("#demo-status", "LOADING");
    try {
      const result = await loadDemoSchema(matchId, { signal });
      const model = normalizeDemoSchema(result);
      const summary = model.tables.map(table => table.name + " (" + table.columns.length + " columns)\n" + table.columns.map(column => "  " + column.name + ": " + column.arrowType).join("\n")).join("\n\n");
      write("#demo-output", summary || model.raw);
      write("#demo-status", "READY · " + model.tables.length + " tables");
    } catch (error) {
      if (signal.aborted) return;
      write("#demo-status", "ERROR");
      write("#demo-output", error.message);
    }
  });
  demoForm.addEventListener("submit", async event => {
    event.preventDefault();
    write("#demo-status", "QUEUING");
    try {
      const values = Object.fromEntries(new FormData(demoForm));
      const result = await submitDemoQueryFromForm(values, { signal });
      const model = normalizeDemoStatus(result);
      write("#demo-output", model.raw);
      write("#demo-status", model.status ?? "QUEUED");
      if (model.jobId) pollDemo(model.jobId, signal);
    } catch (error) {
      if (signal.aborted) return;
      write("#demo-status", "ERROR");
      write("#demo-output", error.message);
    }
  });

  document.querySelector("#live-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (!values.match_id && !values.broadcast_url) {
      write("#live-output", "Provide match_id or broadcast_url.");
      return;
    }
    write("#live-status", "CONNECTING");
    try {
      const result = await runLiveQuery({ query: values.query, matchId: values.match_id, broadcastUrl: values.broadcast_url }, { signal });
      const stream = result.data;
      if (!stream) throw new Error("The API returned no SSE stream.");
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.replace(/\r\n/g, "\n").split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          if (!event.trim()) continue;
          const parsed = parseSseEventBlock(event);
          const payload = parsed.data;
          write("#live-output", parsed.type === "message" ? payload : parsed.type.toUpperCase() + ": " + payload);
          if (parsed.type === "end") {
            await reader.cancel();
            break;
          }
          if (parsed.type === "error") throw new Error(payload || "Live query stream reported an error.");
        }
      }
      write("#live-status", signal.aborted ? "CANCELLED" : "ENDED");
    } catch (error) {
      if (signal.aborted) return;
      write("#live-status", "ERROR");
      write("#live-output", error.message);
    }
  });

  document.querySelector("#live-refresh").addEventListener("click", async () => {
    try {
      const result = normalizeLiveUrls(await loadLiveUrls({ signal }));
      write("#live-output", result.length ? result.map(row => ({
        match_id: row.matchId, lobby_id: row.lobbyId, broadcast_url: row.broadcastUrl
      })) : "No live broadcasts returned.");
    } catch (error) {
      if (!signal.aborted) write("#live-output", error.message);
    }
  });

  document.querySelector("#custom-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    for (const key of ["disable_auto_ready", "duplicate_heroes_enabled", "cheats_enabled", "is_publicly_visible", "randomize_lanes"]) {
      values[key] = form.elements[key].checked;
    }
    if (values.min_roster_size !== "") values.min_roster_size = Number(values.min_roster_size);
    if (values.corrupted_item_shop_spawn_minutes !== "") values.corrupted_item_shop_spawn_minutes = Number(values.corrupted_item_shop_spawn_minutes);
    const body = buildCustomMatchBody(values);
    write("#custom-status", "CREATING");
    try {
      const result = await createCustomMatchFromForm(body, { signal });
      const data = result.data ?? result;
      const partyId = data.party_id;
      document.querySelector("#custom-lobby-id").value = partyId ?? "";
      document.querySelector("#custom-actions").hidden = !partyId;
      write("#custom-output", data);
      write("#custom-status", "CREATED");
    } catch (error) {
      if (signal.aborted) return;
      write("#custom-status", "ERROR");
      write("#custom-output", error.message);
    }
  });

  document.querySelectorAll("[data-custom-action]").forEach(button => button.addEventListener("click", async () => {
    const lobbyId = document.querySelector("#custom-lobby-id").value.trim();
    if (!lobbyId) return;
    write("#custom-status", button.dataset.customAction.toUpperCase());
    try {
      const result = await customMatchAction(button.dataset.customAction, lobbyId, { signal });
      write("#custom-output", result.data ?? result);
      write("#custom-status", "OK");
    } catch (error) {
      if (!signal.aborted) {
        write("#custom-status", "ERROR");
        write("#custom-output", error.message);
      }
    }
  }));

  document.querySelector("#custom-lobby-id").addEventListener("change", async event => {
    const partyId = event.target.value.trim();
    if (!/^\d+$/.test(partyId)) return;
    try {
      const result = await loadCustomMatchId(partyId, { signal });
      write("#custom-output", result.data ?? result);
    } catch (error) {
      if (!signal.aborted) write("#custom-output", error.message);
    }
  });
}

async function pollDemo(jobId, signal) {
  if (!jobId) return;
  clearTimeout(statusTimer);
  try {
    const result = normalizeDemoStatus(await getDemoQueryStatusSnapshot(jobId, { signal }));
    write("#demo-output", result.raw);
    write("#demo-status", result.status ?? "UNKNOWN");
    if (result.status === "queued" || result.status === "running") {
      statusTimer = setTimeout(() => pollDemo(jobId, signal), Math.max(1000, Math.min(10000, Number(result.estimatedWaitSeconds || 3) * 1000)));
      return;
    }
    if (result.resultUrl) {
      const url = safeExternalUrl(result.resultUrl);
      const output = document.querySelector("#demo-output");
      if (output && url) output.insertAdjacentHTML("beforebegin", '<p class="panel-actions"><a class="button" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open result artifact ↗</a></p>');
    }
  } catch (error) {
    if (!signal.aborted) write("#demo-output", error.message);
  }
}


