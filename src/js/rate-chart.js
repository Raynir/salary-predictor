// ---------- chart ----------
const SERIES = [
  { key: "cbr", color: "var(--s1)", label: "lgCbr" },
  { key: "company", color: "var(--s2)", label: "lgCompany" },
  { key: "model", color: "var(--s3)", label: "lgModel" },
];

function drawChart() {
  const svg = $("#svg"), rows = ui.chartRows || [];
  const W = svg.clientWidth || 600, H = 300, m = { l: 44, r: 12, t: 10, b: 28 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (rows.length < 2) { svg.innerHTML = ""; return; }
  const vals = rows.flatMap((r) => SERIES.map((s) => r[s.key])).filter((v) => v != null);
  let lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
  if (hi === lo) hi = lo + 5;
  const x = (i) => m.l + (i * (W - m.l - m.r)) / (rows.length - 1);
  const y = (v) => m.t + ((hi - v) * (H - m.t - m.b)) / (hi - lo);
  let g = "";
  const step = (hi - lo) / 5 >= 5 ? 10 : 5;
  for (let v = lo; v <= hi; v += step) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`;
  }
  const every = Math.ceil(rows.length / Math.max(2, Math.floor((W - m.l) / 52)));
  rows.forEach((r, i) => {
    if (i % every === 0 || i === rows.length - 1)
      g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${shortMonth(r.ym)}</text>`;
  });
  for (const s of SERIES) {
    let d = "", pen = false;
    rows.forEach((r, i) => {
      if (r[s.key] == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(r[s.key]).toFixed(1)}`;
      pen = true;
    });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const last = rows[rows.length - 1];
  if (last.projected) {
    g += `<circle cx="${x(rows.length - 1)}" cy="${y(last.model)}" r="5" fill="var(--s3)" stroke="var(--surface)" stroke-width="2"/>`;
  }
  g += `<line id="cross" y1="${m.t}" y2="${H - m.b}" stroke="var(--axis)" stroke-width="1" visibility="hidden"/>`;
  g += `<g id="dots"></g>`;
  g += `<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="hit"/>`;
  svg.innerHTML = g;
  svg.setAttribute("aria-label", tr("history"));

  const tip = $("#tip"), cross = svg.querySelector("#cross"), dots = svg.querySelector("#dots");
  const hit = svg.querySelector("#hit");
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) * W) / rect.width;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - m.l) * (rows.length - 1)) / (W - m.l - m.r))));
    const r = rows[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    dots.innerHTML = SERIES.filter((s) => r[s.key] != null)
      .map((s) => `<circle cx="${x(i)}" cy="${y(r[s.key])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("");
    tip.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${showMonth(r.ym)}</div>` +
      SERIES.filter((s) => r[s.key] != null)
        .map((s) => `<div><span class="k" style="background:${s.color}"></span>${tr(s.label)}: <b>${fmt(r[s.key])}</b></div>`).join("");
    tip.style.display = "block";
    const left = (x(i) * rect.width) / W;
    tip.style.left = Math.min(Math.max(0, left + 12), rect.width - tip.offsetWidth) + "px";
    tip.style.top = "8px";
  };
  const leave = () => { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); dots.innerHTML = ""; };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", leave);
}
