// ---------- salary ----------
const SAL_FIELDS = { salary: "#salary", raise: "#salRaise", fixed: "#salFixed", lower: "#salLower", base: "#salBase", upper: "#salUpper", yMin: "#salYMin", yMax: "#salYMax" };
const SAL_DEFAULTS = { salary: "", raise: "0", fixed: "0.5", lower: "50", base: "80", upper: "100", yMin: "0", yMax: "2", mode: "piecewise" };

function loadSal() {
  const saved = { ...SAL_DEFAULTS, ...(store.get("sp.salary") || {}) };
  for (const [k, sel] of Object.entries(SAL_FIELDS)) $(sel).value = saved[k];
  ui.salMode = saved.mode === "line" ? "line" : "piecewise";
}

function saveSal() {
  const out = { mode: ui.salMode };
  for (const [k, sel] of Object.entries(SAL_FIELDS)) out[k] = $(sel).value;
  store.set("sp.salary", out);
}

function salParams() {
  const p = { mode: ui.salMode };
  for (const k of ["fixed", "lower", "base", "upper", "yMin", "yMax"]) p[k] = num($(SAL_FIELDS[k]).value);
  return p;
}

const salParamsOk = (p) =>
  ["fixed", "lower", "base", "upper", "yMin", "yMax"].every((k) => Number.isFinite(p[k])) &&
  p.lower < p.base && p.base < p.upper && p.yMin <= 1 && p.yMax >= 1 && p.fixed >= 0 && p.fixed <= 1;

const lineSlope = (p) => (1 - p.yMin) / (p.base - p.lower);
/** Rate at which the one-line formula reaches yMax (Infinity if the line is flat). */
const lineCap = (p) => (lineSlope(p) > 0 ? p.base + (p.yMax - 1) / lineSlope(p) : Infinity);

function multiplier(r, p, mode = p.mode) {
  let y;
  if (mode === "line") y = 1 + lineSlope(p) * (r - p.base);
  else if (r <= p.base) y = 1 - ((1 - p.yMin) * (p.base - r)) / (p.base - p.lower);
  else y = 1 + ((p.yMax - 1) * (r - p.base)) / (p.upper - p.base);
  return Math.min(p.yMax, Math.max(p.yMin, y));
}

/** Inverse of multiplier(): the rate at which Y equals y, or null if no rate gives it. */
function rateForMultiplier(y, p) {
  if (y < p.yMin || y > p.yMax) return null;
  if (p.mode === "line") return lineSlope(p) > 0 ? p.base + (y - 1) / lineSlope(p) : null;
  if (y === 1) return p.base;
  if (y < 1) return p.yMin < 1 ? p.base - ((1 - y) * (p.base - p.lower)) / (1 - p.yMin) : null;
  return p.yMax > 1 ? p.base + ((y - 1) * (p.upper - p.base)) / (p.yMax - 1) : null;
}

/** Rate at which the raised salary equals the current one: {r}, {always} (any rate) or {never}. */
function breakEvenRate(raise, p) {
  if (p.fixed >= 1) return raise > 0 ? { always: true } : { never: true };
  const y = (1 / (1 + raise / 100) - p.fixed) / (1 - p.fixed);
  if (y <= p.yMin) return { always: true };
  const r = rateForMultiplier(y, p);
  return r === null ? { never: true } : { r };
}

function salaryAt(x, r, p) {
  const y = multiplier(r, p);
  const fixed = p.fixed * x, variable = (1 - p.fixed) * x * y;
  return { y, fixed, variable, total: fixed + variable };
}

const money = (v) => fmt(v, 0);
const signed = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);

function renderSalaryHow(p, x) {
  const cap = lineCap(p);
  const vars = {
    yMin: fmt(p.yMin, 2), yMax: fmt(p.yMax, 2), l: fmt(p.lower, 2), b: fmt(p.base, 2), u: fmt(p.upper, 2),
    s1: fmt(lineSlope(p), 4), s2: fmt((p.yMax - 1) / (p.upper - p.base), 4),
    cap: Number.isFinite(cap) ? fmt(cap, 2) : "∞", yu: fmt(multiplier(p.upper, p, "line"), 3),
  };
  const rates = [p.lower - 5, p.lower, (p.lower + p.base) / 2, p.base, (p.base + p.upper) / 2, p.upper, p.upper + 5];
  if (Number.isFinite(cap) && cap > p.base && cap < p.upper + 5) rates.push(cap);
  const uniq = [...new Set(rates.map((r) => Math.round(r * 100) / 100))].sort((a, b) => a - b);
  const head = ["thRate", "thYPiece", "thYLine", ...(x ? [ui.tax.on ? "thSalaryGross" : "thSalary"] : [])].map((k) => `<th>${tr(k)}</th>`).join("");
  const body = uniq.map((r) => {
    const sal = x ? `<td>${money(salaryAt(x, r, p).total)}</td>` : "";
    const hl = [p.lower, p.base, p.upper].includes(r) ? ' class="hl"' : "";
    return `<tr${hl}><td>${fmt(r, 2)}</td><td>${fmt(multiplier(r, p, "piecewise"), 3)}</td><td>${fmt(multiplier(r, p, "line"), 3)}</td>${sal}</tr>`;
  }).join("");
  $("#salHow").innerHTML = tr("salHowPiece", vars) + tr("salHowLine", vars) +
    tr("salHowEx", { x: x ? tr("salHowExX", { x: money(x) }) : "" }) +
    `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderSalary(pred) {
  ui.salPred = pred;
  $("#useSalPred").textContent = pred ? tr("useSalPred", { v: fmt(pred.value) }) : "";
  if (pred && !ui.salRateEdited) $("#salRate").value = fmt(pred.value).replace(/\s/g, "");
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === ui.salMode));
  $("#salUpperField").classList.toggle("off", ui.salMode === "line");
  document.querySelectorAll("[data-taxview]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.taxview === ui.tax.view));
  document.querySelectorAll(".taxview").forEach((el) => { el.style.display = ui.tax.on ? "" : "none"; });
  const net = netView(), br = net ? taxBrackets() : null;
  $("#salExpected").textContent = tr(!ui.tax.on ? "salExpected" : net ? "salExpectedNet" : "salExpectedGross");

  const p = salParams(), x = num($("#salary").value), r = num($("#salRate").value);
  const raise = $("#salRaise").value.trim() ? num($("#salRaise").value) : 0;
  const ok = salParamsOk(p) && Number.isFinite(raise) && raise > -100;
  renderSalaryHistory(ok ? p : null, x > 0 ? x : null, r > 0 ? r : null);
  renderEarnings();
  const show = (hero, range, facts = []) => {
    $("#salOut").textContent = hero;
    $("#salRange").textContent = range;
    $("#salFacts").innerHTML = facts.filter(Boolean).map((f) => `<li>${f}</li>`).join("");
  };
  if (!ok) { $("#salHow").innerHTML = ""; return show("–", tr("salBadParams")); }
  const base = x * (1 + raise / 100); // the raise applies before the fixed / rate-linked split
  renderSalaryHow(p, x > 0 ? base : null);
  if (!(x > 0)) return show("–", tr("salNeedSalary"));
  if (!(r > 0)) return show("–", tr("salNeedRate"));
  if (net && !br) return show("–", tr("taxBad"));

  const s = salaryAt(base, r, p);
  const fromPred = pred && !ui.salRateEdited;
  const cap = lineCap(p);
  const of = raise ? tr("salOfRaised", { v: money(base) }) : tr("salOfX");
  // Earlier months this year count at the history's salaries (actual rates, no raise); the raise starts this month
  const ytd = net ? ytdGrossBefore($("#month").value, (k) => ui.salGross.get(k) ?? x) : 0;
  const after = (g) => (net ? g - monthTax(ytd, g, br) : g);
  const total = after(s.total), ref = after(x), tax = s.total - total;
  const pct = (v) => signed((v / ref) * 100, 1);
  // Net pay grows with gross, so the gross break-even rate is also the net one
  const be = raise ? breakEvenRate(raise, p) : null;
  let beFact = "";
  if (be?.always) beFact = tr("salBEAlways", { x: money(ref) });
  else if (be?.never) beFact = tr("salBENever", { x: money(ref) });
  else if (be) {
    beFact = tr(raise > 0 ? "salBEUp" : "salBEDown", { r: fmt(be.r, 2), x: money(ref), m: signed(be.r - r, 2) });
    if (fromPred) {
      const key = pred.low >= be.r ? "salBERangeAbove" : pred.high < be.r ? "salBERangeBelow" : "salBERangeIn";
      beFact += tr(key, { lo: fmt(pred.low), hi: fmt(pred.high) });
    }
  }
  show(money(total), fromPred ? tr("salRangeTxt", {
    lo: fmt(pred.low), hi: fmt(pred.high),
    a: money(after(salaryAt(base, pred.low, p).total)), b: money(after(salaryAt(base, pred.high, p).total)),
  }) : "", [
    net ? tr("salGrossFact", { v: money(s.total) }) : "",
    net ? tr("salTaxFact", { v: money(tax), p: fmt((tax / s.total) * 100, 1) }) : "",
    net && ytd ? tr("salYtdFact", { v: money(ytd) }) : "",
    tr("salY", { r: fmt(r), y: fmt(s.y, 3) }),
    tr("salFixedPart", { p: fmt(p.fixed * 100, 0), of, v: money(s.fixed) }),
    tr("salVarPart", { p: fmt((1 - p.fixed) * 100, 0), of, v: money(s.variable) }),
    tr("salDiff", { d: signed(total - ref, 0), pc: pct(total - ref) }),
    raise ? tr("salFromRaise", { d: signed(after(base) - ref, 0), pc: pct(after(base) - ref) }) : "",
    raise ? tr("salFromRate", { d: signed(total - after(base), 0), pc: pct(total - after(base)) }) : "",
    beFact,
    p.mode === "line" && Number.isFinite(cap) ? tr("salCap", { y: fmt(p.yMax, 2), r: fmt(cap, 2) }) : "",
  ]);
}
