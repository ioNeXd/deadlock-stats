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

export function renderDemoExplorer() {
  if (!location.hash.replace(/^#\/?/, "").startsWith("demos")) return;
  const signal = abortPrevious();
  root.innerHTML = `
    <section class="page-head demo-page-head">
      <span class="eyebrow">ADVANCED / DEMO INTELLIGENCE</span>
      <h2>THE DEMO ARCHIVE</h2>
      <p>Inspect a match demo's queryable schema, compose SQL against its entity and event tables, and monitor queued extraction jobs through the official Deadlock API.</p>
      <div class="pills"><span>SCHEMA</span><span>SQL EXTRACTION</span><span>PARQUET / NDJSON</span><span>JOB STATUS</span></div>
    </section>
    <section class="dashboard-grid demo-grid">
      <article class="panel demo-lab">
        <div class="section-head"><div><span class="eyebrow">01 / SCHEMA</span><h3>Inspect tables</h3></div><span id="demo-status" class="muted">READY</span></div>
        <form id="demo-form" class="tool-form">
          <label>Match ID <input name="match_id" type="number" min="0" placeholder="optional for schema"></label>
          <label>Output format <select name="format"><option value="">Default</option><option value="parquet">Parquet</option><option value="ndjson">NDJSON</option></select></label>
          <label>SQL extraction <textarea name="query" rows="9" placeholder="select * from player_stats limit 20"></textarea></label>
          <div class="panel-actions"><button class="button" type="button" id="demo-schema">Inspect schema</button><button class="button" type="submit">Queue extraction</button></div>
        </form>
      </article>
      <article class="panel demo-output-panel">
        <div class="section-head"><div><span class="eyebrow">02 / TELEMETRY</span><h3>Extraction result</h3></div><span class="muted">RAW RESPONSE</span></div>
        <pre id="demo-output" class="tool-output" aria-live="polite">No demo operation yet.</pre>
      </article>
    </section>`;
  bindDemoExplorer(signal);
}
function bindDemoExplorer(signal) {
  const demoForm = document.querySelector("#demo-form");
  const schemaButton = document.querySelector("#demo-schema");
  schemaButton.addEventListener("click", async () => {
    const matchId = demoForm.elements.match_id.value;
    write("#demo-status", "LOADING");
    try {
      const result = await loadDemoSchema(matchId, { signal });
      const model = normalizeDemoSchema(result);
      const summary = model.tables.map(table => table.name + " (" + table.columns.length + " columns)\\n" + table.columns.map(column => "  " + column.name + ": " + column.arrowType).join("\\n")).join("\\n\\n");
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
}
export function renderLiveQuery() {
  if (!location.hash.replace(/^#\/?/, "").startsWith("live")) return;
  const signal = abortPrevious();
  root.innerHTML = `
    <section class="page-head live-page-head">
      <span class="eyebrow">ADVANCED / REAL-TIME TELEMETRY</span>
      <h2>THE LIVE QUERY DESK</h2>
      <p>Run SQL against an active broadcast and read the official Server-Sent Events stream as it arrives. Choose a match or an API-provided broadcast URL.</p>
      <div class="pills"><span>SSE</span><span>LIVE BROADCASTS</span><span>SQL</span><span>STREAM CONTROL</span></div>
    </section>
    <section class="dashboard-grid live-grid">
      <article class="panel live-lab">
        <div class="section-head"><div><span class="eyebrow">01 / CONNECT</span><h3>Open a stream</h3></div><span id="live-status" class="muted">READY</span></div>
        <form id="live-form" class="tool-form">
          <label>Match ID <input name="match_id" type="number" min="0" placeholder="optional"></label>
          <label>Broadcast URL <input name="broadcast_url" type="url" placeholder="https://…"></label>
          <label>SQL query <textarea name="query" rows="9" placeholder="select * from player_stats"></textarea></label>
          <div class="panel-actions"><button class="button" type="submit">Start SSE query</button><button class="button" type="button" id="live-refresh">Find broadcasts</button><button class="button" type="button" id="live-stop">Stop stream</button></div>
        </form>
      </article>
      <article class="panel live-output-panel">
        <div class="section-head"><div><span class="eyebrow">02 / STREAM</span><h3>Live telemetry</h3></div><span class="muted">SERVER-SENT EVENTS</span></div>
        <pre id="live-output" class="tool-output" aria-live="polite">Waiting for a live query.</pre>
      </article>
    </section>`;
  bindLiveQuery(signal);
}
function bindLiveQuery(signal) {
  const form = document.querySelector("#live-form");
  const stop = () => controller?.abort();
  document.querySelector("#live-stop").addEventListener("click", stop);
  document.querySelector("#live-refresh").addEventListener("click", async () => {
    write("#live-status", "DISCOVERING");
    try {
      const result = normalizeLiveUrls(await loadLiveUrls({ signal }));
      write("#live-output", result.length ? result : "No live broadcasts returned.");
      write("#live-status", result.length ? "LIVE SOURCES" : "NO SOURCES");
    } catch (error) {
      if (!signal.aborted) { write("#live-status", "ERROR"); write("#live-output", error.message); }
    }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!values.match_id && !values.broadcast_url) { write("#live-status", "INPUT REQUIRED"); write("#live-output", "Provide match_id or broadcast_url."); return; }
    if (!values.query?.trim()) { write("#live-status", "INPUT REQUIRED"); write("#live-output", "Provide a SQL query."); return; }
    write("#live-status", "CONNECTING");
    try {
      const result = await runLiveQuery({ query: values.query, matchId: values.match_id, broadcastUrl: values.broadcast_url }, { signal });
      const stream = result.data;
      if (!stream) throw new Error("The API returned no SSE stream.");
      const reader = stream.getReader(), decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.replace(/\r\n/g, "\n").split("\n\n"); buffer = events.pop() ?? "";
        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          const parsed = parseSseEventBlock(eventBlock);
          write("#live-output", parsed.type === "message" ? parsed.data : parsed.type.toUpperCase() + ": " + parsed.data);
          if (parsed.type === "end") { await reader.cancel(); break; }
          if (parsed.type === "error") throw new Error(parsed.data || "Live query stream reported an error.");
        }
      }
      if (!signal.aborted) write("#live-status", "ENDED");
    } catch (error) {
      if (!signal.aborted) { write("#live-status", "ERROR"); write("#live-output", error.message); }
    }
  });
}

export function renderAdvancedTools() {
  if (!location.hash.replace(/^#\/?/, "").startsWith("tools")) return;
  const signal = abortPrevious();
  root.innerHTML = `
    <section class="page-head custom-match-page-head">
      <span class="eyebrow">TOOLS / CUSTOM MATCHES</span>
      <h2>THE MATCHMAKER'S OFFICE</h2>
      <p>Configure a custom Deadlock lobby through the official Custom Matches API, receive the generated party code, control the bot, and resolve the resulting match ID.</p>
      <div class="pills"><span>LOBBY CREATION</span><span>PARTY CODE</span><span>BOT CONTROL</span><span>MATCH ID</span></div>
    </section>
    <section class="custom-match-grid">
      <article class="panel custom-match-brief">
        <div class="section-head"><div><span class="eyebrow">01 / CONTRACT</span><h3>Lobby specification</h3></div><span id="custom-status" class="custom-match-status">READY</span></div>
        <form id="custom-form" class="tool-form custom-match-form">
          <div class="custom-match-fieldset">
            <span class="custom-match-fieldset-title">GAME RULES</span>
            <label>Game mode
              <select name="game_mode">
                <option value="">API default</option>
                <option value="normal">normal</option>
                <option value="street_brawl">street_brawl</option>
                <option value="explore_n_y_c">explore_n_y_c</option>
                <option value="internal">internal</option>
              </select>
            </label>
            <label>Minimum roster size
              <input name="min_roster_size" type="number" min="0" step="1" placeholder="optional">
            </label>
            <label>Corrupted shop spawn minute
              <input name="corrupted_item_shop_spawn_minutes" type="number" min="0" step="1" placeholder="optional">
            </label>
          </div>
          <div class="custom-match-fieldset">
            <span class="custom-match-fieldset-title">SERVER</span>
            <label>Server region
              <select name="server_region">
                <option value="">API default</option>
                <option value="europe">europe</option><option value="eu_amsterdam">eu_amsterdam</option><option value="eu_poland">eu_poland</option><option value="eu_stockholm">eu_stockholm</option><option value="eu_helsinki">eu_helsinki</option><option value="eu_falkenstein">eu_falkenstein</option><option value="eu_spain">eu_spain</option><option value="eu_east">eu_east</option><option value="eu_london">eu_london</option><option value="south_africa">south_africa</option>
                <option value="us_west">us_west</option><option value="us_east">us_east</option><option value="us_north_central">us_north_central</option><option value="us_south_central">us_south_central</option><option value="us_south_east">us_south_east</option><option value="us_south_west">us_south_west</option>
                <option value="australia">australia</option><option value="singapore">singapore</option><option value="japan">japan</option><option value="hong_kong">hong_kong</option><option value="mp_hong_kong">mp_hong_kong</option><option value="seoul">seoul</option>
                <option value="chile">chile</option><option value="peru">peru</option><option value="argentina">argentina</option><option value="south_america">south_america</option>
              </select>
            </label>
            <label>Callback URL
              <input name="callback_url" type="url" placeholder="optional">
            </label>
          </div>
          <div class="custom-match-fieldset custom-match-switches">
            <span class="custom-match-fieldset-title">LOBBY SWITCHES</span>
            <label><input name="disable_auto_ready" type="checkbox"> Disable auto-ready</label>
            <label><input name="duplicate_heroes_enabled" type="checkbox"> Allow duplicate heroes</label>
            <label><input name="cheats_enabled" type="checkbox"> Enable cheats</label>
            <label><input name="is_publicly_visible" type="checkbox"> Publicly visible</label>
            <label><input name="randomize_lanes" type="checkbox"> Randomize lanes</label>
          </div>
          <div class="panel-actions custom-match-submit">
            <button class="primary-button" type="submit">Create custom lobby</button>
          </div>
        </form>
        <p class="custom-match-rate">Creation is rate-limited by the API: 10 requests/hour per IP, with higher key/global limits. The bot leaves automatically after 15 minutes.</p>
      </article>
      <article class="panel custom-match-telemetry">
        <div class="section-head"><div><span class="eyebrow">02 / CONTROL ROOM</span><h3>Party telemetry</h3></div><span class="muted">OFFICIAL RESPONSE</span></div>
        <div id="custom-response-grid" class="custom-response-grid">
          <div><span>PARTY ID</span><strong id="custom-party-id">—</strong></div>
          <div><span>PARTY CODE</span><strong id="custom-party-code">—</strong></div>
          <div><span>CALLBACK SECRET</span><strong id="custom-callback-secret">—</strong></div>
        </div>
        <div class="custom-match-actions" id="custom-actions" hidden>
          <div class="custom-match-action-head"><span class="eyebrow">BOT CONTROL</span><span class="muted">LOBBY ID</span></div>
          <input id="custom-lobby-id" placeholder="Party / lobby ID" aria-label="Party or lobby ID">
          <div class="panel-actions">
            <button class="button" data-custom-action="ready">Ready</button>
            <button class="button" data-custom-action="unready">Unready</button>
            <button class="button" data-custom-action="start">Start</button>
            <button class="button" data-custom-action="leave">Leave</button>
          </div>
        </div>
        <div class="custom-match-id-box">
          <div><span class="eyebrow">MATCH RESOLUTION</span><h4>Find match ID</h4></div>
          <label>Numeric party ID <input id="custom-party-id-lookup" type="number" min="0" placeholder="API party ID"></label>
          <button class="button" type="button" id="custom-match-id-button">Resolve match ID</button>
          <strong id="custom-match-id-result">—</strong>
        </div>
        <pre id="custom-output" class="tool-output custom-match-output" aria-live="polite">No custom lobby created yet.</pre>
      </article>
    </section>`;
  bindCustomMatch(signal);
}

function bindCustomMatch(signal) {
  const form = document.querySelector("#custom-form");
  const checkboxKeys = ["disable_auto_ready", "duplicate_heroes_enabled", "cheats_enabled", "is_publicly_visible", "randomize_lanes"];
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    for (const key of checkboxKeys) values[key] = form.elements[key].checked;
    if (values.min_roster_size !== "") values.min_roster_size = Number(values.min_roster_size);
    if (values.corrupted_item_shop_spawn_minutes !== "") values.corrupted_item_shop_spawn_minutes = Number(values.corrupted_item_shop_spawn_minutes);
    write("#custom-status", "CREATING");
    try {
      const result = await createCustomMatchFromForm(buildCustomMatchBody(values), { signal });
      const data = result.data ?? result;
      const partyId = data?.party_id ?? null;
      document.querySelector("#custom-party-id").textContent = partyId ?? "—";
      document.querySelector("#custom-party-code").textContent = data?.party_code ?? "—";
      document.querySelector("#custom-callback-secret").textContent = data?.callback_secret ?? "—";
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
    if (!lobbyId) {
      write("#custom-status", "LOBBY ID REQUIRED");
      return;
    }
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

  document.querySelector("#custom-match-id-button").addEventListener("click", async () => {
    const partyId = document.querySelector("#custom-party-id-lookup").value.trim();
    if (!partyId) {
      write("#custom-status", "PARTY ID REQUIRED");
      return;
    }
    write("#custom-status", "RESOLVING");
    try {
      const result = await loadCustomMatchId(partyId, { signal });
      const data = result.data ?? result;
      const matchId = data?.match_id ?? data?.matchId ?? data?.id ?? data;
      write("#custom-match-id-result", matchId);
      write("#custom-output", data);
      write("#custom-status", "MATCH ID READY");
    } catch (error) {
      if (!signal.aborted) {
        write("#custom-status", "ERROR");
        write("#custom-output", error.message);
      }
    }
  });
}

function write(id, value) {
  const node = document.querySelector(id);
  if (node) node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
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
