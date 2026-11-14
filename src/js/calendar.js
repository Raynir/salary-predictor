// ---------- production calendar ----------
/** Public holidays fixed by the Labour Code (art. 112) as MM-DD. They are never paid vacation days. */
const PUBLIC_HOLIDAYS = new Set(["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"]);
const CAL = { days: new Map(), years: new Set() };

/**
 * Read a holiday file into {days: Map(iso → "holiday" | "dayoff" | "workday"), years}. Accepts:
 * - simple CSV `date,type` (type holiday / dayoff / workday; anything else non-working means dayoff),
 * - the official production calendar CSV (data.gov.ru): a row per year, a column per month listing its non-working days,
 *   `*` marks a shortened working day, `+` a transferred day off,
 * - xmlcalendar.ru XML (`<day d="MM.DD" t="1|2|3" h="…"/>`).
 */
function parseHolidays(text) {
  text = String(text || "").replace(/^﻿/, "");
  const days = new Map(), years = new Set();
  if (/^\s*</.test(text)) {
    const year = (text.match(/<calendar[^>]*year="(\d{4})"/) || [])[1];
    if (!year) return { days, years };
    years.add(+year);
    for (const m of text.matchAll(/<day\s+d="(\d\d)\.(\d\d)"\s+t="(\d)"([^>]*)>/g)) {
      const d = `${year}-${m[1]}-${m[2]}`;
      if (m[3] === "1") days.set(d, /\bh="/.test(m[4]) ? "holiday" : "dayoff");
      else if (isWeekend(d)) days.set(d, "workday");
    }
    return { days, years };
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { days, years };
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((l) => splitRow(l, sep));
  const official = rows.some((c) => /^\d{4}$/.test(c[0]) && c.length >= 13);
  if (official) {
    for (const c of rows) {
      if (!/^\d{4}$/.test(c[0]) || c.length < 13) continue;
      const y = +c[0];
      years.add(y);
      const off = new Set();
      for (let m = 1; m <= 12; m++) {
        for (const tok of c[m].split(",")) {
          const n = parseInt(tok, 10);
          if (n > 0 && !tok.includes("*")) off.add(iso(y, m, n));
        }
      }
      for (let d = iso(y, 1, 1); d <= iso(y, 12, 31); d = addDays(d, 1)) {
        if (off.has(d) && !isWeekend(d)) days.set(d, PUBLIC_HOLIDAYS.has(d.slice(5)) ? "holiday" : "dayoff");
        else if (!off.has(d) && isWeekend(d)) days.set(d, "workday");
      }
    }
    return { days, years };
  }
  for (const c of rows) {
    const d = parseDate(c[0]);
    if (!d) continue;
    const t = (c[1] || "").toLowerCase();
    years.add(+d.slice(0, 4));
    days.set(d, /work|рабоч/.test(t) && !/non|не/.test(t) ? "workday" : /holiday|праздн/.test(t) ? "holiday" : "dayoff");
  }
  return { days, years };
}

/** Built-in calendar, with an uploaded file replacing it for the years the file covers. */
function loadCalendar() {
  const base = parseHolidays(EMBEDDED.holidays);
  const up = parseHolidays(store.get("sp.holidays") || "");
  CAL.days = new Map([...base.days].filter(([d]) => !up.years.has(+d.slice(0, 4))));
  for (const [d, t] of up.days) CAL.days.set(d, t);
  CAL.years = new Set([...base.years, ...up.years]);
  CAL.loaded = up.years;
}

/** Simple `date;type` CSV for the days of `years` that differ from Monday–Friday. */
function holidaysCsv(days, years) {
  const rows = [...days].filter(([d]) => years.has(+d.slice(0, 4))).sort(([a], [b]) => (a < b ? -1 : 1));
  return ["date;type", ...rows.map(([d, t]) => `${d};${t}`)].join("\n") + "\n";
}

/** Keep a loaded or downloaded calendar: its years replace the same years loaded earlier. */
function saveHolidays(parsed) {
  const old = parseHolidays(store.get("sp.holidays") || "");
  const days = new Map([...old.days].filter(([d]) => !parsed.years.has(+d.slice(0, 4))));
  for (const [d, t] of parsed.days) days.set(d, t);
  const years = new Set([...old.years, ...parsed.years]);
  store.set("sp.holidays", holidaysCsv(days, years));
}

/** The year's calendar as a simple CSV that loads back unchanged: public holidays, days off, working weekends. */
function holidayTemplate(year) {
  const days = new Map();
  for (let d = iso(year, 1, 1); d <= iso(year, 12, 31); d = addDays(d, 1)) {
    const t = dayType(d);
    if (t === "holiday" || t === "dayoff" || (t === "workday" && isWeekend(d))) days.set(d, t);
  }
  return holidaysCsv(days, new Set([year]));
}

// xmlcalendar.ru doesn't allow cross-origin requests; its data repository on GitHub has the same files and does
const CALENDAR_URL = "https://raw.githubusercontent.com/xmlcalendar/data/master/ru/{y}/calendar.xml";

/** Download the calendars for `years`: {got: Map(year → parsed), missing: [...]}, missing = not published (or unreachable). */
async function fetchCalendars(years) {
  const got = new Map(), missing = [];
  let reached = false;
  await Promise.all(years.map(async (y) => {
    try {
      const res = await fetch(CALENDAR_URL.replace("{y}", y), { cache: "no-store" });
      reached = true;
      const parsed = res.ok ? parseHolidays(await res.text()) : null;
      if (parsed && parsed.years.has(y)) got.set(y, parsed);
      else missing.push(y);
    } catch {
      missing.push(y);
    }
  }));
  return { got, missing: missing.sort(), reached };
}

const isWeekend = (d) => { const wd = toUTC(d).getUTCDay(); return wd === 0 || wd === 6; };
const isPublicHoliday = (d) => dayType(d) === "holiday";

/** "workday", "weekend", "dayoff" (non-working weekday) or "holiday" (public holiday, on any weekday). */
function dayType(d) {
  const o = CAL.days.get(d);
  if (o === "workday") return "workday";
  if (o === "holiday" || PUBLIC_HOLIDAYS.has(d.slice(5))) return "holiday";
  if (isWeekend(d)) return "weekend";
  return o || "workday";
}
const isWorkday = (d) => dayType(d) === "workday";

/** Working days of month ym. */
function workdaysIn(ym) {
  const out = [];
  for (let d = ym + "-01", end = monthEnd(ym); d <= end; d = addDays(d, 1)) if (isWorkday(d)) out.push(d);
  return out;
}

function lastWorkdayBefore(d) {
  do d = addDays(d, -1); while (!isWorkday(d));
  return d;
}

/** A payment due on d is made on d, or on the last working day before it. */
const payDate = (d) => (isWorkday(d) ? d : lastWorkdayBefore(d));
