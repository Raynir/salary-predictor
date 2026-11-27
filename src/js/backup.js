// ---------- export / import of everything the page keeps in this browser ----------
// Moves data between copies of the app: the archive opened from a file, another browser, the web version.
const BACKUP_APP = "salary-predictor";
const BACKUP_SKIP = new Set(["sp.section", "sp.welcome"]); // per copy, not data

function savedKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sp.")) out.push(k);
    }
  } catch {}
  return out;
}

/** Anything saved besides the open section and the language. */
const hasSavedData = () => savedKeys().some((k) => !BACKUP_SKIP.has(k) && k !== "sp.lang");

// Read before startup code saves anything, so a first visit is still recognized.
const FIRST_VISIT = !hasSavedData() && !store.get("sp.welcome");

function exportData() {
  const data = {};
  for (const k of savedKeys()) {
    if (BACKUP_SKIP.has(k)) continue;
    const v = store.get(k);
    if (v !== null) data[k] = v;
  }
  // Company rates built into this copy (the archive has them, the web version doesn't) go along too.
  if (!("sp.company" in data) && parseRates(EMBEDDED.company).length) data["sp.company"] = EMBEDDED.company;
  const name = `salary-predictor-${todayIso()}.json`;
  const file = { app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), data };
  downloadText(name, JSON.stringify(file, null, 2), "application/json");
  setStatus(["stExported", { f: name }]);
}

/** Replace the saved data with an export file's and reload. Returns the status to show. */
function importData(text, name) {
  let file = null;
  try { file = JSON.parse(text); } catch {}
  const data = file && file.app === BACKUP_APP && file.data && typeof file.data === "object" ? file.data : null;
  const keys = data ? Object.keys(data).filter((k) => k.startsWith("sp.") && !BACKUP_SKIP.has(k)) : [];
  if (!keys.length) return ["stImportBad", { f: name }];
  if (hasSavedData() && !confirm(tr("importConfirm"))) return ["stImportCancelled"];
  for (const k of savedKeys()) if (!BACKUP_SKIP.has(k)) store.del(k);
  for (const k of keys) store.set(k, data[k]);
  store.set("sp.welcome", true);
  location.reload();
  return ["stImported", { f: name }];
}

/** First visit with nothing saved: offer to import an export. Then the statistics question, if any. */
function askWelcome() {
  if (!FIRST_VISIT) return askStats();
  const dlg = $("#welcome");
  dlg.addEventListener("close", () => { store.set("sp.welcome", true); askStats(); }, { once: true });
  dlg.showModal();
  dlg.focus(); // not the first button: neither answer should look picked
}
