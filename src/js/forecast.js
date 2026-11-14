// ---------- UI ----------
const ui = { expectedEdited: false };

function settings() {
  const k = num($("#kOverride").value);
  return { n: +$("#nMonths").value, kFixed: k > 0.5 && k < 1.5 ? k : null };
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = tr(el.dataset.t); });
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  $("#how").innerHTML = tr("how");
  $("#erHow").innerHTML = tr("erHow");
  document.title = tr("title");
  fillMonths();
  renderTaxEditor();
  renderEarnEditors();
  renderStats();
  render();
  setStatus(ui.status || ["stEmbedded"]);
}

function fillMonths() {
  const sel = $("#month");
  const keep = sel.value;
  const first = [...S.company.keys()].sort()[0] || todayIso().slice(0, 7);
  const lastData = (lastCbrDate() || todayIso()).slice(0, 7);
  let end = todayIso().slice(0, 7);
  if (lastData > end) end = lastData;
  end = nextMonth(end);
  const opts = [];
  for (let m = first; m <= end; m = nextMonth(m)) opts.push(m);
  sel.innerHTML = opts.reverse().map((m) => `<option value="${m}">${showMonth(m)}</option>`).join("");
  sel.value = keep && opts.includes(keep) ? keep : todayIso().slice(0, 7);
  if (!sel.value) sel.value = opts[0];
  fillRateMonths();
}

/** Months offered in the "add company rate" form: those with CBR data up to the current month, newest first. */
function fillRateMonths() {
  const sel = $("#crMonth");
  const keep = sel.value;
  const now = todayIso().slice(0, 7);
  const opts = [...S.months.keys()].filter((m) => m <= now).reverse();
  sel.innerHTML = opts.map((m) => `<option value="${m}">${showMonth(m)}${S.company.has(m) ? "" : " •"}</option>`).join("");
  const pending = opts.filter((m) => !S.company.has(m)).pop(); // oldest month still without a rate
  sel.value = keep && opts.includes(keep) ? keep : pending || opts[0] || "";
}

/** Finished months with CBR data after the last known company rate: shown with the model's estimate only. */
function pendingRows(n) {
  const now = todayIso().slice(0, 7), last = lastCompanyMonth() || "";
  return [...S.months.keys()].filter((ym) => ym > last && ym < now && !S.company.has(ym)).map((ym) => {
    const ratios = ratiosBefore(ym, n);
    const avg = monthAvg(ym);
    return { ym, avg, days: S.months.get(ym).length, actual: null, ratio: null, model: ratios.length >= 3 ? median(ratios) * avg : null };
  });
}

function companyCsv() {
  const lines = [...S.company.keys()].sort().map((ym) => `1,01.${ym.slice(5, 7)}.${ym.slice(0, 4)},${S.company.get(ym)},Доллар США`);
  return ["nominal,monthyear,curs,cdx", ...lines].join("\n") + "\n";
}

function latest() {
  const d = lastCbrDate();
  return d ? { d, v: S.cbr.get(d) } : null;
}

function syncExpected() {
  const l = latest();
  if (l && !ui.expectedEdited) $("#expected").value = fmt(l.v, 4).replace(/\s/g, "");
  $("#useLatest").textContent = l ? tr("useLatest", { v: fmt(l.v, 4), d: showDate(l.d) }) : "";
}

function render() {
  syncExpected();
  const { n, kFixed } = settings();
  const ym = $("#month").value;
  const expected = num($("#expected").value);
  const facts = $("#facts");
  let pred = null;

  if (!(expected > 0)) {
    $("#pred").textContent = "–";
    $("#range").textContent = tr("badExpected");
    $("#actual").textContent = "";
    facts.innerHTML = "";
  } else {
    pred = predict(ym, expected, n, kFixed);
    if (pred.k == null) {
      $("#pred").textContent = "–";
      $("#range").textContent = tr("noHistory");
      facts.innerHTML = "";
      pred = null;
    } else {
      $("#pred").textContent = fmt(pred.value);
      $("#range").textContent = tr("range", { lo: fmt(pred.low), hi: fmt(pred.high) });
      facts.innerHTML = [
        tr("known", { n: pred.known, r: pred.remaining }),
        tr("cbrAvg", { v: fmt(pred.avg, 4) }),
        tr("spread", { k: fmt(pred.k, 4), src: kFixed ? tr("spreadManual") : tr("spreadAuto", { n: pred.used }) }),
        pred.remaining ? tr("sens", { x: fmt(pred.sens) }) : "",
      ].filter(Boolean).map((s) => `<li>${s}</li>`).join("");
    }
    const actual = S.company.get(ym);
    $("#actual").textContent = actual && pred ? tr("actual", { v: fmt(actual), e: fmt(pred.value - actual) }) : "";
  }

  const rows = backtest(n);
  const pending = pendingRows(n);
  renderTable([...rows, ...pending]);
  const recent = rows.filter((r) => r.model != null).slice(-12);
  $("#mae").textContent = recent.length
    ? tr("mae", { n: recent.length, mae: fmt(mean(recent.map((r) => Math.abs(r.model - r.actual)))) })
    : "";
  ui.chartRows = [...rows, ...pending].map((r) => ({ ym: r.ym, cbr: r.avg, company: r.actual, model: r.model }));
  if (pred && !S.company.has(ym) && ym > (lastCompanyMonth() || "") && !pending.some((r) => r.ym === ym)) {
    ui.chartRows.push({ ym, cbr: null, company: null, model: pred.value, projected: true });
  }
  drawChart();
  renderSalary(pred);
}

function renderTable(rows) {
  const head = ["thMonth", "thCbr", "thDays", "thCompany", "thRatio", "thModel", "thErr"].map((k) => `<th>${tr(k)}</th>`).join("");
  const body = [...rows].reverse().map((r) => {
    const err = r.model == null || r.actual == null ? null : r.model - r.actual;
    return `<tr><td>${showMonth(r.ym)}</td><td>${fmt(r.avg)}</td><td>${r.days}</td><td>${r.actual == null ? "–" : fmt(r.actual)}</td>
      <td>${r.ratio == null ? "–" : fmt(r.ratio, 4)}</td><td>${r.model == null ? "–" : fmt(r.model)}</td>
      <td>${err == null ? "–" : (err > 0 ? "+" : "") + fmt(err)}</td></tr>`;
  }).join("");
  $("#table").innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
}
