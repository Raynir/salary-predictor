// Google Apps Script backend for the opt-in salary statistics (src/js/stats.js).
// Setup: create a Google Sheet, open Extensions → Apps Script, paste this file, then Deploy → New deployment →
// Web app, "Execute as: Me", "Who has access: Anyone". Put the /exec URL into STATS_URL in src/js/stats.js.
// Keeps one row per anonymous ID: id | updated | built | salary | raise | periods (JSON).

const SHEET = "stats";
const HEADER = ["id", "updated", "built", "salary", "raise", "periods"];
const MAX_BODY = 10000;
const MAX_SALARY = 1e7;

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || "";
    if (raw.length > MAX_BODY) return reply({ ok: false, error: "too large" });
    const d = JSON.parse(raw);
    if (d.v !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(d.id)) {
      return reply({ ok: false, error: "bad id" });
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet();
      const row = findRow(sh, d.id);
      if (d.action === "delete") {
        if (row) sh.deleteRow(row);
        return reply({ ok: true });
      }
      if (d.action !== "upsert") return reply({ ok: false, error: "bad action" });
      const err = check(d);
      if (err) return reply({ ok: false, error: err });
      const periods = d.periods.map((p) => ({ from: p.from, salary: p.salary, system: p.system }));
      const values = [[d.id, new Date(), String(d.built || "").slice(0, 40), d.salary, d.raise, JSON.stringify(periods)]];
      sh.getRange(row || sh.getLastRow() + 1, 1, 1, HEADER.length).setValues(values);
      return reply({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply({ ok: false, error: "bad request" });
  }
}

function check(d) {
  const money = (x) => typeof x === "number" && isFinite(x) && x > 0 && x <= MAX_SALARY;
  if (d.salary !== null && !money(d.salary)) return "bad salary";
  if (typeof d.raise !== "number" || !isFinite(d.raise) || d.raise < -100 || d.raise > 1000) return "bad raise";
  if (!Array.isArray(d.periods) || d.periods.length > 50) return "bad periods";
  for (const p of d.periods) {
    if (!p || !/^20\d\d-\d\d-\d\d$/.test(p.from) || !money(p.salary) || (p.system !== "old" && p.system !== "new")) {
      return "bad period";
    }
  }
  return "";
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

const reply = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
