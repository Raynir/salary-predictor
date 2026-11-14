// ---------- salary history ----------
/** Salary X under the current scheme for every month with an actual company rate. */
function renderSalaryHistory(p, x, rate) {
  const note = $("#shNote"), table = $("#shTable");
  const net = netView(), br = net ? taxBrackets() : null;
  ui.salRows = [];
  ui.salGross = new Map();
  ui.salX = x;
  ui.salNet = net;
  $("#shBaseLg").textContent = tr(net ? "shBaseNet" : "shBase");
  const err = !p ? "salBadParams" : !x ? "salNeedSalary" : net && !br ? "taxBad" : "";
  $("#shLegend").style.display = err ? "none" : "";
  if (err) {
    note.textContent = tr(err);
    table.innerHTML = "";
    drawSalaryChart();
    return;
  }
  const months = [...S.company.keys()].sort().map((ym) => ({ ym, rate: S.company.get(ym), forecast: false }));
  const ym = $("#month").value;
  if (rate && ym > (lastCompanyMonth() || "")) months.push({ ym, rate, forecast: true });
  for (const m of months) ui.salGross.set(m.ym, salaryAt(x, m.rate, p).total);

  ui.salRows = months.map((m) => {
    const s = salaryAt(x, m.rate, p);
    if (!net) return { ...m, y: s.y, gross: s.total, tax: 0, salary: s.total, base: x, diff: s.total - x };
    // Withholding is year to date, so compare with what plain X would leave in the same month of the year
    const tax = monthTax(ytdGrossBefore(m.ym, (k) => ui.salGross.get(k) ?? x), s.total, br);
    const base = x - monthTax(ytdGrossBefore(m.ym, () => x), x, br);
    return { ...m, y: s.y, gross: s.total, tax, salary: s.total - tax, base, diff: s.total - tax - base };
  });

  const past = ui.salRows.filter((r) => !r.forecast);
  const sum = past.reduce((t, r) => t + r.diff, 0);
  note.textContent = past.length ? tr(net ? "shSummaryNet" : "shSummary", {
    x: money(x), n: past.length, sum: signed(sum, 0), avg: signed(sum / past.length, 0),
    a: past.filter((r) => r.diff > 0.5).length, b: past.filter((r) => r.diff < -0.5).length,
  }) : "";

  const cls = (d) => (d > 0.5 ? "up" : d < -0.5 ? "down" : "");
  const cols = net ? ["thSalaryGross", "thTax", "thSalaryNet"] : ["thSalary"];
  const head = ["thMonth", "thCompany", "shY", ...cols, "thDiff"].map((k) => `<th>${tr(k)}</th>`).join("");
  const body = [...ui.salRows].reverse().map((r) =>
    `<tr><td>${showMonth(r.ym)}${r.forecast ? ` (${tr("shForecast")})` : ""}</td><td>${fmt(r.rate)}</td><td>${fmt(r.y, 3)}</td>
      ${net ? `<td>${money(r.gross)}</td><td>${money(r.tax)}</td>` : ""}<td>${money(r.salary)}</td><td class="${cls(r.diff)}">${signed(r.diff, 0)}</td></tr>`).join("");
  table.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  drawSalaryChart();
}

function niceStep(span, n = 5) {
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw);
}

/** Bars grow up (green) or down (red) from the X line. After tax, X's line steps down when X alone would cross a bracket. */
function drawSalaryChart() {
  const svg = $("#shSvg"), rows = ui.salRows || [], X = ui.salX;
  $("#shTip").style.display = "none";
  svg.style.display = rows.length && X ? "" : "none";
  if (!rows.length || !X) { svg.innerHTML = ""; return; }
  const W = svg.clientWidth || 600, H = 260, m = { l: 64, r: 40, t: 14, b: 28 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const vals = rows.flatMap((r) => [r.base, r.salary]);
  const step = niceStep(Math.max(...vals) - Math.min(...vals) || X * 0.1);
  const lo = Math.floor(Math.min(...vals) / step) * step;
  let hi = Math.ceil(Math.max(...vals) / step) * step;
  if (hi <= lo) hi = lo + step;
  const bw = (W - m.l - m.r) / rows.length;
  const x = (i) => m.l + bw * (i + 0.5);
  const y = (v) => m.t + ((hi - v) * (H - m.t - m.b)) / (hi - lo);
  let g = "";
  for (let v = lo; v <= hi + step / 2; v += step) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${money(v)}</text>`;
  }
  const every = Math.ceil(rows.length / Math.max(2, Math.floor((W - m.l) / 52)));
  rows.forEach((r, i) => {
    if (i % every === 0 || i === rows.length - 1)
      g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${shortMonth(r.ym)}</text>`;
    const color = r.diff > 0.5 ? "var(--good)" : r.diff < -0.5 ? "var(--bad)" : "var(--axis)";
    const top = Math.min(y(r.salary), y(r.base)), h = Math.max(1, Math.abs(y(r.salary) - y(r.base)));
    g += `<rect x="${x(i) - bw * 0.35}" y="${top}" width="${bw * 0.7}" height="${h}" rx="1" fill="${color}"${r.forecast ? ' fill-opacity="0.45"' : ""}/>`;
  });
  const steps = rows.map((r, i) => `L${m.l + bw * i} ${y(r.base)} L${m.l + bw * (i + 1)} ${y(r.base)}`).join(" ");
  g += `<path d="M${steps.slice(1)}" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  g += `<text x="${W - 2}" y="${y(rows[rows.length - 1].base) + 4}" text-anchor="end" font-size="11" fill="var(--ink-2)">Y = 1</text>`;
  g += `<rect id="shHl" y="${m.t}" height="${H - m.t - m.b}" width="${bw}" fill="var(--ink)" fill-opacity="0.06" visibility="hidden"/>`;
  g += `<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="shHit"/>`;
  svg.innerHTML = g;
  svg.setAttribute("aria-label", tr("shTitle"));

  const tip = $("#shTip"), hl = svg.querySelector("#shHl"), hit = svg.querySelector("#shHit");
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) * W) / rect.width;
    const i = Math.max(0, Math.min(rows.length - 1, Math.floor((px - m.l) / bw)));
    const r = rows[i];
    hl.setAttribute("x", x(i) - bw / 2); hl.setAttribute("visibility", "visible");
    tip.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${showMonth(r.ym)}${r.forecast ? ` (${tr("shForecast")})` : ""}</div>` +
      `<div>${tr("shRate")}: <b>${fmt(r.rate)} ₽</b></div><div>${tr("shY")}: <b>${fmt(r.y, 3)}</b></div>` +
      (ui.salNet
        ? `<div>${tr("viewGross")}: <b>${money(r.gross)} ₽</b></div><div>${tr("shTax")}: <b>${money(r.tax)} ₽</b></div>` +
          `<div>${tr("viewNet")}: <b>${money(r.salary)} ₽</b></div>`
        : `<div>${tr("shSalary")}: <b>${money(r.salary)} ₽</b></div>`) +
      `<div>${tr(ui.salNet ? "shDiffNet" : "shDiff")}: <b class="${r.diff > 0.5 ? "up" : r.diff < -0.5 ? "down" : ""}">${signed(r.diff, 0)} ₽</b></div>`;
    tip.style.display = "block";
    const left = (x(i) * rect.width) / W;
    tip.style.left = Math.min(Math.max(0, left + 12), rect.width - tip.offsetWidth) + "px";
    tip.style.top = "8px";
  };
  const leave = () => { tip.style.display = "none"; hl.setAttribute("visibility", "hidden"); };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", leave);
}
