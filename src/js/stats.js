// ---------- opt-in salary statistics ----------
// Participants send their current salary, raise and Earnings salary periods to a Google Apps Script web app
// (tools/stats-apps-script.gs) that keeps one row per anonymous ID in the owner's sheet. Nothing is sent before the
// person says yes. With STATS_URL empty the feature is hidden.
const STATS_URL = "";
const STATS_DELAY = 5000;

const statsOn = () => !!STATS_URL;
const loadStats = () => store.get("sp.stats") || {};
const saveStats = (s) => store.set("sp.stats", s);

function newStatsId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Exactly what is sent. The ID is left out of the preview before the person has one. */
function statsPayload(id) {
  const salary = num($("#salary").value), raise = num($("#salRaise").value);
  return {
    v: 1, action: "upsert", id, built: EMBEDDED.builtAt,
    salary: salary > 0 ? salary : null,
    raise: Number.isFinite(raise) ? raise : 0,
    periods: earnPeriods().list,
  };
}

const postStats = (body) =>
  fetch(STATS_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .then((r) => { if (!r.ok) throw new Error(r.error); });

async function syncStats() {
  const s = loadStats();
  if (!statsOn() || s.choice !== "yes" || !s.id) return;
  const body = JSON.stringify(statsPayload(s.id));
  if (body === s.lastSent) return;
  try {
    await postStats(JSON.parse(body));
    saveStats({ ...loadStats(), lastSent: body, lastAt: new Date().toISOString() });
    ui.statsErr = false;
  } catch {
    ui.statsErr = true;
  }
  renderStats();
}

let statsTimer;
/** Called after salary or earnings edits; sends once the person stops typing. */
function statsChanged() {
  if (!statsOn()) return;
  renderStats();
  clearTimeout(statsTimer);
  statsTimer = setTimeout(syncStats, STATS_DELAY);
}

function setStatsChoice(yes) {
  const s = loadStats();
  if (yes) {
    saveStats({ choice: "yes", id: s.id || newStatsId() });
    syncStats();
  } else {
    if (s.id) postStats({ v: 1, action: "delete", id: s.id }).catch(() => {});
    saveStats({ choice: "no" });
  }
  ui.statsErr = false;
  renderStats();
}

function renderStats() {
  $("#statsCard").hidden = !statsOn();
  if (!statsOn()) return;
  const s = loadStats();
  const preview = JSON.stringify(statsPayload(s.id || "…"), null, 2);
  $("#statsOn").checked = s.choice === "yes";
  $("#statsPreview").textContent = preview;
  $("#statsAskPreview").textContent = preview;
  $("#statsState").textContent =
    s.choice !== "yes" ? tr("statsOff")
    : ui.statsErr ? tr("statsErr")
    : s.lastAt ? tr("statsSent", { id: s.id, t: new Date(s.lastAt).toLocaleString(locale()) })
    : tr("statsPending", { id: s.id });
  $("#statsState").classList.toggle("bad", s.choice === "yes" && !!ui.statsErr);
}

/** First launch: ask until the person picks an answer. Closing the dialog asks again next time. */
function askStats() {
  if (!statsOn() || loadStats().choice) return;
  renderStats();
  $("#statsAsk").showModal();
  $("#statsAsk").focus(); // not the first link: neither answer should look picked
}
