// ---------- status ----------
function setStatus(args) {
  ui.status = args;
  const [key, vars = {}] = args;
  const d = lastCbrDate(), m = lastCompanyMonth();
  $("#status").textContent = tr(key, { d: d ? showDate(d) : "–", m: m ? showMonth(m) : "–", ...vars });
}

// ---------- online refresh (cbr-xml-daily.ru mirrors CBR with CORS enabled) ----------
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function takeUsd(json, added) {
  const usd = json && json.Valute && json.Valute.USD;
  if (!usd || !json.Date) return;
  const d = json.Date.slice(0, 10);
  if (!S.cbr.has(d)) { S.cbr.set(d, usd.Value / (usd.Nominal || 1)); added[d] = S.cbr.get(d); }
}

async function refreshOnline() {
  setStatus(["stChecking"]);
  const checking = ui.status;
  // Don't overwrite a message the user triggered (e.g. a file load) while we were fetching
  const finish = (args) => { if (ui.status === checking) setStatus(args); };
  const added = {};
  try {
    const latestJson = await fetchJson("https://www.cbr-xml-daily.ru/daily_json.js");
    if (!latestJson) throw new Error("no data");
    takeUsd(latestJson, added);
    // Fetch every missing day after the built-in data, at most ~4 months back. Rates saved on earlier
    // visits leave holes between them, so look for missing days rather than starting after the last one.
    // CBR sets a rate for day d only on a working day d-1 (per the production calendar). Other days return
    // 404 without CORS headers, which the browser reports as a CORS error, so don't request them.
    const builtIn = parseRates(EMBEDDED.cbr).map((r) => r[0]).sort().pop();
    let from = addDays(builtIn || todayIso(), 1);
    const floor = addDays(todayIso(), -120);
    if (from < floor) from = floor;
    const days = [];
    for (let d = from; d <= todayIso(); d = addDays(d, 1)) {
      if (isWorkday(addDays(d, -1)) && !S.cbr.has(d)) days.push(d);
    }
    for (let i = 0; i < days.length; i += 6) {
      const batch = days.slice(i, i + 6).map((d) =>
        fetchJson(`https://www.cbr-xml-daily.ru/archive/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/daily_json.js`).catch(() => null));
      (await Promise.all(batch)).forEach((j) => takeUsd(j, added));
    }
    const n = Object.keys(added).length;
    if (n) {
      store.set("sp.cbr", { ...(store.get("sp.cbr") || {}), ...added });
      reindex();
      fillMonths();
    }
    render();
    finish([n ? "stLive" : "stUpToDate", { n }]);
  } catch {
    finish(["stOffline"]);
  }
}

// ---------- events ----------
async function readFile(input, apply) {
  const f = input.files[0];
  if (!f) return;
  try {
    const text = await f.text();
    const rows = parseRates(text);
    if (!rows.length) { setStatus(["stBadFile", { f: f.name }]); return; }
    apply(rows, text);
    reindex();
    fillMonths();
    render();
    setStatus(["stLoaded", { f: f.name, n: rows.length }]);
  } catch {
    setStatus(["stBadFile", { f: f.name }]);
  } finally {
    input.value = ""; // so picking the same file again still fires "change"
  }
}

/** Read a file that isn't a rates CSV; apply(text, fileName) returns the status to show. */
async function readTextFile(input, apply) {
  const f = input.files[0];
  if (!f) return;
  try {
    setStatus(apply(await f.text(), f.name));
  } catch {
    setStatus(["stBadFile", { f: f.name }]);
  } finally {
    input.value = ""; // so picking the same file again still fires "change"
  }
}

/** Hand the user a text file. A UTF-8 BOM lets Excel open Russian text correctly. Works from file:// too. */
function downloadText(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function refreshCalendars() {
  const btn = $("#holFetch");
  btn.disabled = true;
  setStatus(["stHolChecking"]);
  try {
    const { got, missing, reached } = await fetchCalendars(calendarYears());
    if (!reached) return setStatus(["stHolOffline"]);
    if (!got.size) return setStatus(["stHolNone", { m: missing.join(", ") }]);
    const years = new Set(got.keys()), days = new Map();
    for (const p of got.values()) for (const [d, t] of p.days) days.set(d, t);
    saveHolidays({ years, days });
    calendarChanged();
    setStatus([missing.length ? "stHolFetchedSome" : "stHolFetched", { y: [...years].sort().join(", "), m: missing.join(", ") }]);
  } finally {
    btn.disabled = false;
  }
}
