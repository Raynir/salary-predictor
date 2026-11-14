// ---------- income tax ----------
/** Yearly brackets, Russian NDFL 2025. Each rate applies to the part of yearly income from its `from` up to the next `from`. */
const TAX_DEFAULTS = {
  on: false,
  view: "gross",
  brackets: [["0", "13"], ["2400000", "15"], ["5000000", "18"], ["20000000", "20"], ["50000000", "22"]].map(([from, rate]) => ({ from, rate })),
};

function loadTax() {
  const saved = store.get("sp.tax") || {};
  const br = Array.isArray(saved.brackets) && saved.brackets.length ? saved.brackets : TAX_DEFAULTS.brackets;
  ui.tax = {
    on: saved.on === true,
    view: saved.view === "net" ? "net" : "gross",
    brackets: br.map((b) => ({ from: String(b.from ?? ""), rate: String(b.rate ?? "") })),
  };
}

const saveTax = () => store.set("sp.tax", ui.tax);

/** Parsed brackets sorted by `from`, or null if any row is invalid. The first row always starts at 0. */
function taxBrackets() {
  const br = ui.tax.brackets.map((b, i) => ({ from: i ? num(b.from) : 0, rate: num(b.rate) }));
  if (!br.length || br.some((b) => !(b.from >= 0) || !(b.rate >= 0 && b.rate <= 100))) return null;
  br.sort((a, b) => a.from - b.from);
  return br.some((b, i) => i && b.from === br[i - 1].from) ? null : br;
}

function yearTax(income, br) {
  let t = 0;
  br.forEach((b, i) => {
    const top = i + 1 < br.length ? br[i + 1].from : Infinity;
    if (income > b.from) t += ((Math.min(income, top) - b.from) * b.rate) / 100;
  });
  return t;
}

/** Year-to-date withholding: tax on everything earned so far this year minus what was already withheld. */
const monthTax = (ytdBefore, gross, br) => yearTax(ytdBefore + gross, br) - yearTax(ytdBefore, br);

/** True when salaries should be shown after tax. Check taxBrackets() for null before using it. */
const netView = () => ui.tax.on && ui.tax.view === "net";

/** Gross earned from January of ym's year up to the month before ym. */
function ytdGrossBefore(ym, grossOf) {
  let t = 0;
  for (let m = ym.slice(0, 4) + "-01"; m < ym; m = nextMonth(m)) t += grossOf(m);
  return t;
}

function checkTax() {
  $("#taxBad").textContent = ui.tax.on && !taxBrackets() ? tr("taxBad") : "";
}

function renderTaxEditor() {
  $("#taxOn").checked = ui.tax.on;
  $("#taxBody").classList.toggle("off", !ui.tax.on);
  const rows = ui.tax.brackets.map((b, i) => `<div class="taxrow">
    <input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" data-k="from" aria-label="${tr("taxFrom")}"${i ? "" : " disabled"}>
    <input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" data-k="rate" aria-label="${tr("taxRate")}">
    ${i ? `<button type="button" class="linkbtn" data-remove="${i}" aria-label="${tr("taxRemove")}" title="${tr("taxRemove")}">✕</button>` : "<span></span>"}
  </div>`).join("");
  $("#taxRows").innerHTML = `<div class="taxrow taxhead"><span>${tr("taxFrom")}</span><span>${tr("taxRate")}</span><span></span></div>` + rows;
  // Values go in through the DOM so whatever the user typed never gets parsed as HTML
  $("#taxRows").querySelectorAll("input").forEach((el) => {
    const b = ui.tax.brackets[+el.dataset.i];
    el.value = el.dataset.k === "from" && el.dataset.i === "0" ? "0" : b[el.dataset.k];
  });
  checkTax();
}
