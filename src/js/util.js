// ---------- dates ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUTC = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
const fromUTC = (dt) => iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
const addDays = (s, n) => { const d = toUTC(s); d.setUTCDate(d.getUTCDate() + n); return fromUTC(d); };
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const showDate = (s) => toUTC(s).toLocaleDateString(locale(), { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const showMonth = (ym) => toUTC(ym + "-01").toLocaleDateString(locale(), { timeZone: "UTC", month: "long", year: "numeric" });
const shortMonth = (ym) => ym.slice(5, 7) + "." + ym.slice(2, 4);
const nextMonth = (ym) => { let [y, m] = ym.split("-").map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${pad(m)}`; };
const monthEnd = (ym) => addDays(nextMonth(ym) + "-01", -1);

function parseDate(s) {
  s = (s || "").trim().replace(/^"|"$/g, "");
  let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return iso(+m[3], +m[1], +m[2]); // M/D/YYYY
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return iso(+m[3], +m[2], +m[1]); // DD.MM.YYYY
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  return null;
}
const num = (s) => parseFloat(String(s ?? "").trim().replace(/\s/g, "").replace(",", "."));

// ---------- CSV ----------
function splitRow(line, sep) {
  const out = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parse a nominal,date,curs[,cdx] CSV into [[isoDate, ratePerUnit], ...]. */
function parseRates(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const head = splitRow(lines[0], sep).map((h) => h.toLowerCase());
  let iN = head.findIndex((h) => /nominal|номинал/.test(h));
  let iD = head.findIndex((h) => /^(data|date|monthyear)$|дата/.test(h));
  let iC = head.findIndex((h) => /curs|rate|курс/.test(h));
  const hasHeader = iD >= 0 && iC >= 0;
  if (!hasHeader) { iN = 0; iD = 1; iC = 2; }
  const out = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const c = splitRow(line, sep);
    const d = parseDate(c[iD]);
    const v = num(c[iC]);
    const n = iN >= 0 ? num(c[iN]) : 1;
    if (d && v > 0) out.push([d, v / (n > 0 ? n : 1)]);
  }
  return out;
}
