// ---------- earnings: pay schedule ----------
// Salary for month M is paid twice: an advance on the 25th of M for the days worked on the 1st–15th, and the rest
// on the 10th of M+1. Both move back to the last working day if they fall on a day off. Under the new system the
// advance covers only the fixed share; the rate-linked part comes with the rest on the 10th.
// Work on a weekend or holiday pays twice the month's daily rate and is paid the same way, by the day's date. In the
// advance such a day on the 1st–15th also counts as a worked day, which moves one day of salary from the 10th to the 25th.
const VAC_DAYS_PER_MONTH = 29.3; // Russian Labour Code, art. 139

function loadEarnings() {
  const saved = store.get("sp.earnings") || {};
  const rows = (a, keys) => (Array.isArray(a) ? a : []).map((r) => Object.fromEntries(keys.map((k) => [k, String(r[k] ?? "")])));
  ui.earn = {
    periods: rows(saved.periods, ["from", "salary", "system"]),
    vacations: rows(saved.vacations, ["from", "to", "kind"]),
    extra: rows(saved.extra, ["date"]),
    year: +todayIso().slice(0, 4),
  };
  ui.earn.periods.forEach((p) => { if (p.system !== "new") p.system = "old"; });
  ui.earn.vacations.forEach((v) => { v.kind = vacKind(v.kind); });
}

/**
 * "vac" is a real vacation: the days are not worked and not paid as salary. "comp" is compensation: the same
 * vacation pay for the days, but the person keeps working and gets the salary as usual.
 */
const vacKind = (s) => (/^\s*(comp|compensation|компенсация)\s*$/i.test(String(s || "")) ? "comp" : "vac");

/**
 * A real date between 2000 and 2099, or null. Date inputs report half-typed years such as 0002-01-15 as valid,
 * and a schedule starting there would take minutes to compute.
 */
function earnDate(s) {
  const d = parseDate(s);
  return d && d >= "2000-01-01" && d <= "2099-12-31" && fromUTC(toUTC(d)) === d ? d : null;
}

const saveEarnings = () => store.set("sp.earnings", { periods: ui.earn.periods, vacations: ui.earn.vacations, extra: ui.earn.extra });

/**
 * Vacation CSV: `start,end[,type]` per line (a single date is a one-day vacation; type `comp` marks compensation).
 * Lines without a date are skipped.
 */
function parseVacations(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const out = [];
  for (const line of lines) {
    const c = splitRow(line, line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",");
    const from = earnDate(c[0]);
    if (!from) continue;
    const to = earnDate(c[1]) || from;
    out.push({ from, to: to < from ? from : to, kind: vacKind(c[2]) });
  }
  return out;
}

/** Valid periods sorted by start, and how many rows were skipped. */
function earnPeriods() {
  const ok = ui.earn.periods
    .map((p) => ({ from: earnDate(p.from), salary: num(p.salary), system: p.system }))
    .filter((p) => p.from && p.salary > 0)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  return { list: ok, bad: ui.earn.periods.length - ok.length };
}

/**
 * Valid vacations and compensations sorted by start, overlapping or adjacent ones of the same kind merged into one.
 * A compensation that overlaps a real vacation is left out: those days can't be both worked and not worked.
 */
function earnVacations() {
  const all = ui.earn.vacations
    .map((v) => ({ from: earnDate(v.from), to: earnDate(v.to), kind: vacKind(v.kind) }))
    .filter((v) => v.from && v.to && v.from <= v.to)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  const real = all.filter((v) => v.kind === "vac");
  const ok = all.filter((v) => v.kind === "vac" || !real.some((r) => r.from <= v.to && v.from <= r.to));
  const merged = [];
  for (const kind of ["vac", "comp"]) {
    let last = null;
    for (const v of ok.filter((x) => x.kind === kind)) {
      if (last && v.from <= addDays(last.to, 1)) { if (v.to > last.to) last.to = v.to; }
      else merged.push((last = { ...v }));
    }
  }
  merged.sort((a, b) => (a.from < b.from ? -1 : 1));
  return { list: merged, bad: ui.earn.vacations.length - ok.length };
}

/** Every date from each range's first to last day. */
const rangeDays = (list) => {
  const out = new Set();
  for (const v of list) for (let d = v.from; d <= v.to; d = addDays(d, 1)) out.add(d);
  return out;
};

/**
 * Why a worked day off counts or not: "weekend" / "dayoff" / "holiday" when it counts,
 * otherwise "bad" (no date yet), "workday", "vac" or "noPeriod".
 */
function extraStatus(raw, periods, vacs) {
  const d = earnDate(raw);
  if (!d) return { d: null, why: "bad" };
  const t = dayType(d);
  if (t === "workday") return { d, why: "workday" };
  if (vacs.some((v) => v.kind === "vac" && v.from <= d && d <= v.to)) return { d, why: "vac" };
  if (!periods.length || periods[0].from > d) return { d, why: "noPeriod" };
  return { d, why: t, ok: true };
}

/** Worked days off that count, sorted and without repeats, and how many rows don't count. */
function earnExtra() {
  const periods = earnPeriods().list, vacs = earnVacations().list;
  const st = ui.earn.extra.map((x) => extraStatus(x.date, periods, vacs));
  return { list: [...new Set(st.filter((s) => s.ok).map((s) => s.d))].sort(), bad: st.filter((s) => !s.ok).length, st };
}

/**
 * The whole schedule: every payment from the first salary period through the end of `year`.
 * Returns {payments, months, vacDays, err}. Amounts are before tax.
 */
function earningsSchedule(year) {
  const periods = earnPeriods().list, vacs = earnVacations().list;
  if (!periods.length) return { err: "erNeedPeriod" };
  const p = salParams();
  const needScheme = periods.some((x) => x.system === "new");
  if (needScheme && !salParamsOk(p)) return { err: "erNeedScheme" };

  const extraByMonth = new Map();
  for (const d of earnExtra().list) {
    if (!extraByMonth.has(d.slice(0, 7))) extraByMonth.set(d.slice(0, 7), []);
    extraByMonth.get(d.slice(0, 7)).push(d);
  }
  const extraPay = new Map();
  // Only real vacations take days out of work; compensated days are worked and paid as usual
  const vacDays = rangeDays(vacs.filter((v) => v.kind === "vac"));
  const compDays = rangeDays(vacs.filter((v) => v.kind === "comp"));
  const periodAt = (d) => { let cur = null; for (const x of periods) if (x.from <= d) cur = x; return cur; };

  // Months without an actual company rate use the forecast: up to the current month that month's own prediction
  // (CBR rates published so far + the expected rate), after it the current month's prediction
  const { n, kFixed } = settings();
  const expected = num($("#expected").value);
  const nowYm = todayIso().slice(0, 7);
  const rateCache = new Map();
  const rateFor = (ym) => {
    if (rateCache.has(ym)) return rateCache.get(ym);
    let r = null;
    if (S.company.has(ym)) r = { rate: S.company.get(ym), forecast: false };
    else {
      const pr = expected > 0 ? predict(ym < nowYm ? ym : nowYm, expected, n, kFixed) : null;
      if (pr && pr.k != null) r = { rate: pr.value, forecast: true };
      else if (lastCompanyMonth()) r = { rate: S.company.get(lastCompanyMonth()), forecast: true };
    }
    rateCache.set(ym, r);
    return r;
  };

  const monthCache = new Map();
  /** Salary accrued for ym (vacation days excluded), and the part paid as the advance. */
  const month = (ym) => {
    if (monthCache.has(ym)) return monthCache.get(ym);
    const work = workdaysIn(ym), W = work.length;
    const m = { ym, W, worked: 0, adv: 0, total: 0, rate: null, y: null, forecast: false, isNew: false, extra: 0, extraAdv: 0, extraDays: 0 };
    /** Accrue one day's pay (`times` daily rates). Returns {total, adv} of what it added. */
    const accrue = (d, times) => {
      const per = periodAt(d), share = (times * per.salary) / W, early = +d.slice(8) <= 15;
      if (per.system === "old") return { total: share, adv: early ? share : 0 };
      if (!m.isNew) {
        m.isNew = true;
        const r = rateFor(ym);
        if (r) { m.rate = r.rate; m.forecast = r.forecast; m.y = multiplier(r.rate, p); }
      }
      const fixed = p.fixed * share, variable = (1 - p.fixed) * share * (m.y ?? 1);
      return { total: fixed + variable, adv: early ? fixed : 0 };
    };
    for (const d of work) {
      if (!periodAt(d) || vacDays.has(d)) continue;
      m.worked++;
      const a = accrue(d, 1);
      m.total += a.total; m.adv += a.adv;
    }
    for (const d of extraByMonth.get(ym) || []) {
      const a = accrue(d, 2);
      m.total += a.total; m.adv += a.adv;
      m.extra += a.total; m.extraAdv += a.adv; m.extraDays++;
      extraPay.set(d, a.total);
      // The advance also counts the day as a worked day: one more day of salary comes on the 25th and the same
      // amount less on the 10th, so the month's total doesn't change
      m.adv += accrue(d, 1).adv;
    }
    m.adv = Math.min(m.adv, m.total);
    monthCache.set(ym, m);
    return m;
  };

  const first = periods[0].from;
  const payments = [];
  const add = (nominal, kind, gross, extra) => {
    if (gross < 0.005) return;
    payments.push({ date: payDate(nominal), nominal, kind, gross, ...extra });
  };
  for (let ym = first.slice(0, 7); ym <= `${year}-12`; ym = nextMonth(ym)) {
    const m = month(ym);
    const info = { ym, rate: m.rate, y: m.y, forecast: m.forecast };
    add(ym + "-25", "adv", m.adv, { ...info, rate: null, y: null, forecast: false, extra: m.extraAdv });
    add(nextMonth(ym) + "-10", "final", m.total - m.adv, { ...info, extra: m.extra - m.extraAdv });
  }

  for (const ym of extraByMonth.keys()) month(ym); // so every listed day shows its pay, whatever year is selected

  // Vacation pay: average daily earnings over the 12 full months before the vacation month. Compensation is paid
  // the same way and on the same date as a vacation starting on its first day would be.
  for (const v of vacs) {
    if (v.from < first) continue;
    const startYm = v.from.slice(0, 7);
    let earned = 0, days = 0, forecast = false;
    let ym = startYm;
    for (let i = 0; i < 12; i++) {
      ym = addDays(ym + "-01", -1).slice(0, 7);
      if (monthEnd(ym) < first) break;
      const cal = +monthEnd(ym).slice(8);
      let away = 0;
      for (let d = ym + "-01"; d <= monthEnd(ym); d = addDays(d, 1)) if (vacDays.has(d) || d < first) away++;
      if (away === cal) continue;
      const m = month(ym);
      earned += m.total;
      days += VAC_DAYS_PER_MONTH * (cal - away) / cal;
      forecast = forecast || m.forecast;
    }
    let avg;
    if (days > 0) avg = earned / days;
    else {
      // No earnings before the vacation: the salary for a full month at the start
      const per = periodAt(v.from), r = per.system === "new" ? rateFor(startYm) : null;
      const full = per.system === "new" ? per.salary * (p.fixed + (1 - p.fixed) * (r ? multiplier(r.rate, p) : 1)) : per.salary;
      avg = full / VAC_DAYS_PER_MONTH;
      forecast = !!(r && r.forecast);
    }
    let paid = 0;
    for (let d = v.from; d <= v.to; d = addDays(d, 1)) if (!isPublicHoliday(d)) paid++;
    payments.push({ date: lastWorkdayBefore(v.from), nominal: null, kind: v.kind, gross: avg * paid, avg, paid, from: v.from, to: v.to, forecast });
  }

  const order = { final: 0, vac: 1, comp: 1, adv: 2 };
  payments.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : order[a.kind] - order[b.kind]));
  return { payments, vacDays, compDays, month, periodAt, extraPay };
}

/** Adds .tax and .net to each payment: withheld year to date, by payment date. */
function taxPayments(payments, br) {
  let year = "", cum = 0;
  for (const x of payments) {
    if (x.date.slice(0, 4) !== year) { year = x.date.slice(0, 4); cum = 0; }
    x.tax = br ? monthTax(cum, x.gross, br) : 0;
    x.net = x.gross - x.tax;
    cum += x.gross;
  }
}

function payLabel(x) {
  const extra = x.extra > 0.5 ? tr("pkExtra", { v: money(x.extra) }) : "";
  if (x.kind === "adv") return tr("pkAdv", { m: showMonth(x.ym) }) + extra;
  if (x.kind === "final") return tr("pkFinal", { m: showMonth(x.ym) }) + extra;
  return tr(x.kind === "comp" ? "pkComp" : "pkVac", { a: showDate(x.from), b: showDate(x.to), n: x.paid, v: money(x.avg) });
}

function renderEarnings() {
  if (!ui.earn) return;
  const year = ui.earn.year;
  fillEarnYears();
  const net = netView(), br = net ? taxBrackets() : null;
  $("#erTotalLabel").textContent = tr(!ui.tax.on ? "erTotal" : net ? "erTotalNet" : "erTotalGross", { y: year });
  const warn = [
    earnPeriods().bad ? tr("erBadPeriods") : "",
    earnVacations().bad ? tr("erBadVac") : "",
    earnExtra().bad ? tr("erBadExtra") : "",
    !CAL.years.has(year) ? tr("erNoCal", { y: year }) : "",
  ].filter(Boolean);
  $("#erWarn").innerHTML = warn.map((w) => `<p class="note">${w}</p>`).join("");

  const sch = earningsSchedule(year);
  const err = sch.err || (net && !br ? "taxBad" : "");
  if (err) {
    $("#erTotal").textContent = "–";
    $("#erFacts").innerHTML = `<li>${tr(err)}</li>`;
    $("#erTable").innerHTML = "";
    renderCalendars(year, sch.err ? null : sch);
    updateExtraInfo(null);
    return;
  }
  taxPayments(sch.payments, br);
  const amt = (x) => (net ? x.net : x.gross);
  const rows = sch.payments.filter((x) => +x.date.slice(0, 4) === year);
  const today = todayIso();
  const sum = (a) => a.reduce((t, x) => t + amt(x), 0);
  const done = rows.filter((x) => x.date <= today), left = rows.filter((x) => x.date > today);
  const next = sch.payments.find((x) => x.date > today);
  const nowYm = today.slice(0, 7), cur = sch.month(nowYm);

  $("#erTotal").textContent = rows.length ? money(sum(rows)) : "–";
  $("#erFacts").innerHTML = [
    done.length ? tr("erPaid", { v: money(sum(done)), n: done.length }) : "",
    left.length ? tr("erLeft", { v: money(sum(left)), n: left.length }) : "",
    next ? tr("erNext", { d: showDate(next.date), k: payLabel(next), v: money(amt(next)) }) : "",
    cur.isNew && cur.rate ? tr("erRateNow", { m: showMonth(nowYm), r: fmt(cur.rate), src: tr(cur.forecast ? "shForecast" : "erActual"), y: fmt(cur.y, 3) }) : "",
    extraFact(sch, year),
    ui.tax.on && br && rows.length ? tr("erTax", { v: money(rows.reduce((t, x) => t + x.tax, 0)) }) : "",
    !rows.length ? tr("erNoPayments", { y: year }) : "",
  ].filter(Boolean).map((f) => `<li>${f}</li>`).join("");

  const cols = net ? ["thGross", "thTax", "thNet"] : ["thAmount"];
  const head = ["thDate", "thPayment", "thRateY", ...cols].map((k) => `<th>${tr(k)}</th>`).join("");
  const body = rows.map((x) => {
    const due = x.nominal && x.nominal !== x.date ? ` <span class="muted">(${tr("erDue", { d: showDate(x.nominal) })})</span>` : "";
    const fc = x.forecast ? ` <span class="muted">(${tr("shForecast")})</span>` : "";
    const rate = x.rate ? `${fmt(x.rate)} (${fmt(x.y, 3)})` : "";
    const money3 = net ? `<td>${money(x.gross)}</td><td>${money(x.tax)}</td><td>${money(x.net)}</td>` : `<td>${money(x.gross)}</td>`;
    return `<tr class="${x.date <= today ? "past" : ""}"><td>${showDate(x.date)}${due}</td><td>${payLabel(x)}${fc}</td><td>${rate}</td>${money3}</tr>`;
  }).join("");
  $("#erTable").innerHTML = rows.length ? `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>` : "";
  renderCalendars(year, sch);
  updateExtraInfo(sch);
}

/** Days off worked in the year and what they add before tax, by the month they were worked. */
function extraFact(sch, year) {
  let n = 0, v = 0;
  for (const [d, a] of sch.extraPay) if (+d.slice(0, 4) === year) { n++; v += a; }
  return n ? tr("erXFact", { y: year, n, v: money(v) }) : "";
}

/** Day type and doubled pay next to each worked-day-off row. */
function updateExtraInfo(sch) {
  const { st } = earnExtra();
  document.querySelectorAll("[data-xkind]").forEach((el) => {
    const s = st[+el.dataset.xkind];
    el.textContent = s.why === "bad" ? "–" : tr("xk_" + s.why);
    el.classList.toggle("bad", !s.ok && s.why !== "bad");
  });
  document.querySelectorAll("[data-xpay]").forEach((el) => {
    const s = st[+el.dataset.xpay], v = s.ok && sch?.extraPay ? sch.extraPay.get(s.d) : null;
    el.textContent = v ? money(v) : "–";
  });
}

function fillEarnYears() {
  const sel = $("#erYear");
  const now = +todayIso().slice(0, 4);
  const first = earnPeriods().list[0];
  const from = Math.min(now, first ? +first.from.slice(0, 4) : now, ...CAL.years);
  const opts = [];
  for (let y = now + 1; y >= from; y--) opts.push(y);
  if (!opts.includes(ui.earn.year)) ui.earn.year = now;
  sel.innerHTML = opts.map((y) => `<option value="${y}">${y}</option>`).join("");
  sel.value = ui.earn.year;
  $("#holTemplate").textContent = tr("holTemplate", { y: ui.earn.year });
}

/** Twelve month grids for the year, plus the year's day counts. */
function renderCalendars(year, sch) {
  const vacs = sch ? null : earnVacations().list;
  const vac = sch ? sch.vacDays : rangeDays(vacs.filter((v) => v.kind === "vac"));
  const comp = sch ? sch.compDays : rangeDays(vacs.filter((v) => v.kind === "comp"));
  const pays = new Map();
  for (const x of sch?.payments || []) {
    if (!pays.has(x.date)) pays.set(x.date, []);
    pays.get(x.date).push(x);
  }
  const net = netView() && taxBrackets();
  const today = todayIso();
  // 2024-01-01 is a Monday
  const wd = [...Array(7)].map((_, i) => toUTC(iso(2024, 1, 1 + i)).toLocaleDateString(locale(), { timeZone: "UTC", weekday: "short" }));
  const st = { cal: 0, work: 0, off: 0, hol: 0, vac: 0, vacPaid: 0, worked: 0, xw: 0, comp: 0, compPaid: 0 };
  const xw = new Set(earnExtra().list);
  let html = "";
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${pad(m)}`;
    const lead = (toUTC(ym + "-01").getUTCDay() + 6) % 7;
    let cells = wd.map((w) => `<div class="cal-wd">${w}</div>`).join("") + "<div></div>".repeat(lead);
    let mWork = 0, mVac = 0, mComp = 0;
    for (let d = ym + "-01"; d <= monthEnd(ym); d = addDays(d, 1)) {
      const t = dayType(d), onVac = vac.has(d), onComp = comp.has(d), employed = !sch || !!sch.periodAt(d);
      st.cal++;
      if (t === "workday") { st.work++; mWork++; if (!onVac && employed) st.worked++; }
      else if (t === "holiday") st.hol++;
      else st.off++;
      if (onVac) { st.vac++; mVac++; if (t !== "holiday") st.vacPaid++; }
      if (onComp) { st.comp++; mComp++; if (t !== "holiday") st.compPaid++; }
      const worked = xw.has(d);
      if (worked) st.xw++;
      // Days off outside a vacation can be clicked to mark them as worked
      const pick = t !== "workday" && !onVac;
      const cls = ["cal-d", "t-" + t, onVac ? "vac" : "", onComp ? "comp" : "", worked ? "xw" : "", pays.has(d) ? "pay" : "", d === today ? "today" : "", pick ? "pick" : ""].filter(Boolean).join(" ");
      const tip = [showDate(d), tr({ workday: "lgWork", weekend: "lgWeekend", dayoff: "lgDayoff", holiday: "lgHol" }[t])]
        .concat(onVac ? [tr("lgVac")] : [])
        .concat(onComp ? [tr("lgComp")] : [])
        .concat(worked ? [tr("lgXwork") + (sch?.extraPay?.get(d) ? `: ${money(sch.extraPay.get(d))} ₽` : "")] : [])
        .concat((pays.get(d) || []).map((x) => `${payLabel(x)}: ${money(net ? x.net : x.gross)} ₽`))
        .concat(pick ? [tr(worked ? "calUnpick" : "calPick")] : []);
      cells += `<div class="${cls}"${pick ? ` data-date="${d}" role="button" tabindex="0"` : ""} title="${tip.join("\n")}">${+d.slice(8)}</div>`;
    }
    const foot = tr("erMonthFoot", { w: mWork }) + (mVac ? tr("erMonthVac", { v: mVac }) : "") + (mComp ? tr("erMonthComp", { v: mComp }) : "");
    html += `<div class="cal-month"><div class="cal-title">${toUTC(ym + "-01").toLocaleDateString(locale(), { timeZone: "UTC", month: "long" })}</div>` +
      `<div class="cal-grid">${cells}</div><div class="cal-foot">${foot}</div></div>`;
  }
  $("#erCal").innerHTML = html;
  $("#erStats").innerHTML = tr("erStats", { y: year, ...st }) + (st.comp ? tr("erStatsComp", { n: st.comp, p: st.compPaid }) : "") +
    (st.xw ? tr("erStatsXw", { n: st.xw }) : "");
}

function renderEarnEditors() {
  const sysOpts = (v) => ["old", "new"].map((s) => `<option value="${s}"${s === v ? " selected" : ""}>${tr(s === "old" ? "sysOld" : "sysNew")}</option>`).join("");
  const remove = (list, i) => `<button type="button" class="linkbtn" data-remove="${i}" data-list="${list}" aria-label="${tr("erRemove")}" title="${tr("erRemove")}">✕</button>`;
  $("#erPeriods").innerHTML = `<div class="erow per head"><span>${tr("thFrom")}</span><span>${tr("thMonthly")}</span><span>${tr("thSystem")}</span><span></span></div>` +
    ui.earn.periods.map((x, i) => `<div class="erow per">
      <input type="date" data-list="periods" data-i="${i}" data-k="from" aria-label="${tr("thFrom")}">
      <input type="text" inputmode="decimal" autocomplete="off" data-list="periods" data-i="${i}" data-k="salary" aria-label="${tr("thMonthly")}" placeholder="100000">
      <select data-list="periods" data-i="${i}" data-k="system" aria-label="${tr("thSystem")}">${sysOpts(x.system)}</select>
      ${remove("periods", i)}</div>`).join("");
  const kindOpts = (v) => ["vac", "comp"].map((s) => `<option value="${s}"${s === v ? " selected" : ""}>${tr(s === "vac" ? "vacKindVac" : "vacKindComp")}</option>`).join("");
  $("#erVacs").innerHTML = `<div class="erow vacrow head"><span>${tr("thVacFrom")}</span><span>${tr("thVacTo")}</span><span>${tr("thVacKind")}</span><span>${tr("thVacDays")}</span><span></span></div>` +
    ui.earn.vacations.map((x, i) => `<div class="erow vacrow">
      <input type="date" data-list="vacations" data-i="${i}" data-k="from" aria-label="${tr("thVacFrom")}">
      <input type="date" data-list="vacations" data-i="${i}" data-k="to" aria-label="${tr("thVacTo")}">
      <select data-list="vacations" data-i="${i}" data-k="kind" aria-label="${tr("thVacKind")}">${kindOpts(x.kind)}</select>
      <span class="vdays" data-days="${i}"></span>
      ${remove("vacations", i)}</div>`).join("");
  $("#erExtra").innerHTML = `<div class="erow xrow head"><span>${tr("thXDate")}</span><span>${tr("thXKind")}</span><span>${tr("thXPay")}</span><span></span></div>` +
    ui.earn.extra.map((x, i) => `<div class="erow xrow">
      <input type="date" data-list="extra" data-i="${i}" data-k="date" aria-label="${tr("thXDate")}">
      <span class="xkind" data-xkind="${i}"></span>
      <span class="vdays" data-xpay="${i}"></span>
      ${remove("extra", i)}</div>`).join("");
  // Values go in through the DOM so whatever the user typed never gets parsed as HTML
  document.querySelectorAll("#erPeriods input, #erVacs input, #erExtra input").forEach((el) => {
    el.value = ui.earn[el.dataset.list][+el.dataset.i][el.dataset.k];
  });
  updateVacDays();
  const up = [...(CAL.loaded || [])].sort();
  $("#erHolNote").textContent = tr("erHolNote", { y: [...CAL.years].sort().join(", ") || "–", u: up.length ? tr("erHolLoaded", { y: up.join(", ") }) : "" });
  $("#holTemplate").textContent = tr("holTemplate", { y: ui.earn.year });
}

/** Vacations as a CSV that loads back: the current list, or just the header to fill in. */
function vacationTemplate() {
  const rows = earnVacations().list.map((v) => `${v.from};${v.to};${v.kind === "comp" ? "compensation" : "vacation"}`);
  return ["first_day;last_day;type", ...rows].join("\n") + "\n";
}

/** Years the calendar download asks for: the years in the year list, i.e. from the earliest data to next year. */
const calendarYears = () => [...$("#erYear").options].map((o) => +o.value).sort();

/** Calendar days of each vacation row, without public holidays. */
function updateVacDays() {
  document.querySelectorAll("[data-days]").forEach((el) => {
    const v = ui.earn.vacations[+el.dataset.days];
    const a = earnDate(v.from), b = earnDate(v.to);
    let n = 0;
    if (a && b && a <= b) for (let d = a; d <= b; d = addDays(d, 1)) if (!isPublicHoliday(d)) n++;
    el.textContent = n ? String(n) : "–";
  });
}
