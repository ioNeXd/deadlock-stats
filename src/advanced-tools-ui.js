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

function render() {
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
          <label>Game mode <select name="game_mode"><option value="">API default</option><option value="normal">normal</option><option value="street_brawl">street_brawl</option></select></label>
          <label>Server region <input name="server_region" placeholder="optional"></label>
          <label>Roster size <input name="min_roster_size" type="number" min="0" placeholder="optional"></label>
          <label>Callback URL <input name="callback_url" type="url" placeholder="optional"></label>
          <label><input name="disable_auto_ready" type="checkbox"> Disable auto-ready</label>
          <label><input name="duplicate_heroes_enabled" type="checkbox"> Allow duplicate heroes</label>
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
      write("#demo-output", result.data);
      write("#demo-status", "READY");
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
      const result = await runLiveQuery({ query: values.query, match_id: values.match_id || undefined, broadcast_url: values.broadcast_url || undefined, signal });
      const stream = result.data;
      if (!stream) throw new Error("The API returned no SSE stream.");
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          if (event.trim()) write("#live-output", event);
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
    values.disable_auto_ready = form.elements.disable_auto_ready.checked;
    values.duplicate_heroes_enabled = form.elements.duplicate_heroes_enabled.checked;
    if (values.min_roster_size) values.min_roster_size = Number(values.min_roster_size);
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

window.addEventListener("hashchange", render);
render();
