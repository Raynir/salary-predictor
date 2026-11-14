// ---------- state ----------
const S = { cbr: new Map(), company: new Map(), months: new Map(), firstMonth: "" };

function loadData() {
  S.cbr = new Map(parseRates(EMBEDDED.cbr));
  const extra = store.get("sp.cbr") || {};
  for (const [d, v] of Object.entries(extra)) S.cbr.set(d, v); // loaded files win over built-in data
  const company = store.get("sp.company");
  S.company = new Map(parseRates(company || EMBEDDED.company).map(([d, v]) => [d.slice(0, 7), v]));
  for (const [ym, v] of Object.entries(store.get("sp.companyAdded") || {})) S.company.set(ym, v); // entered in the UI
  reindex();
}

function reindex() {
  S.months = new Map();
  for (const d of [...S.cbr.keys()].sort()) {
    const ym = d.slice(0, 7);
    if (!S.months.has(ym)) S.months.set(ym, []);
    S.months.get(ym).push([d, S.cbr.get(d)]);
  }
  S.firstMonth = [...S.months.keys()][0] || "";
}

const lastCbrDate = () => [...S.cbr.keys()].sort().pop();
const lastCompanyMonth = () => [...S.company.keys()].sort().pop();

// ---------- model (mirrors the Python in update_data.py, change both together) ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function percentile(values, p) {
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.min(lo + 1, v.length - 1);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
const median = (v) => percentile(v, 0.5);

function monthAvg(ym) {
  const rows = S.months.get(ym);
  return rows ? mean(rows.map((r) => r[1])) : null;
}

/** company ÷ CBR-average ratios for complete months strictly before ym. */
function ratiosBefore(ym, n) {
  const out = [];
  for (const m of [...S.company.keys()].sort()) {
    if (m >= ym || !S.months.has(m) || m === S.firstMonth || S.months.get(m).length < 5) continue;
    out.push(S.company.get(m) / monthAvg(m));
  }
  return n > 0 ? out.slice(-n) : out;
}

function remainingDays(after, ym) {
  let n = 0;
  for (let d = addDays(after, 1), end = monthEnd(ym); d <= end; d = addDays(d, 1)) {
    const wd = toUTC(d).getUTCDay();
    if (wd >= 2 && wd <= 6) n++; // CBR rates are dated Tuesday through Saturday
  }
  return n;
}

function predict(ym, expected, n, kFixed) {
  const known = (S.months.get(ym) || []).map((r) => r[1]);
  const rows = S.months.get(ym);
  const last = rows ? rows[rows.length - 1][0] : addDays(ym + "-01", -1);
  const r = remainingDays(last, ym);
  const avg = known.length + r ? (known.reduce((s, x) => s + x, 0) + r * expected) / (known.length + r) : expected;
  const ratios = ratiosBefore(ym, n);
  if (!ratios.length && !kFixed) return { known: known.length, remaining: r, avg, k: null };
  const med = ratios.length ? median(ratios) : kFixed;
  const k = kFixed || med;
  const lo = ratios.length ? percentile(ratios, 0.1) - med + k : k;
  const hi = ratios.length ? percentile(ratios, 0.9) - med + k : k;
  return {
    known: known.length, remaining: r, avg, k, used: ratios.length,
    value: k * avg, low: lo * avg, high: hi * avg,
    sens: k * r / (known.length + r || 1),
  };
}

function backtest(n) {
  const rows = [];
  for (const ym of [...S.company.keys()].sort()) {
    if (!S.months.has(ym)) continue;
    const avg = monthAvg(ym), actual = S.company.get(ym);
    const ratios = ratiosBefore(ym, n);
    const model = ratios.length >= 3 ? median(ratios) * avg : null;
    rows.push({ ym, avg, days: S.months.get(ym).length, actual, ratio: actual / avg, model });
  }
  return rows;
}
