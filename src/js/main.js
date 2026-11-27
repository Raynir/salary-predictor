// ---------- events ----------
$("#fileCbr").addEventListener("change", (e) => readFile(e.target, (rows) => {
  const extra = store.get("sp.cbr") || {};
  for (const [d, v] of rows) { S.cbr.set(d, v); extra[d] = v; }
  store.set("sp.cbr", extra);
}));
$("#fileCompany").addEventListener("change", (e) => readFile(e.target, (rows, text) => {
  S.company = new Map(rows.map(([d, v]) => [d.slice(0, 7), v]));
  store.set("sp.company", text);
  store.del("sp.companyAdded"); // the file is the full list now
}));
$("#reset").addEventListener("click", () => {
  store.del("sp.cbr"); store.del("sp.company"); store.del("sp.companyAdded");
  ui.expectedEdited = false;
  loadData(); fillMonths(); render();
  setStatus(["stEmbedded"]);
});
$("#refresh").addEventListener("click", refreshOnline);
$("#crSave").addEventListener("click", () => {
  const ym = $("#crMonth").value, v = num($("#crRate").value);
  if (!ym || !(v > 0)) return setStatus(["stCompanyBad"]);
  S.company.set(ym, v);
  store.set("sp.companyAdded", { ...(store.get("sp.companyAdded") || {}), [ym]: v });
  $("#crRate").value = "";
  fillMonths(); render();
  setStatus(["stCompanySaved", { mm: showMonth(ym), v: fmt(v) }]);
});
$("#crExport").addEventListener("click", () => downloadText("company_rates.csv", companyCsv()));
$("#useLatest").addEventListener("click", () => { ui.expectedEdited = false; render(); });
$("#expected").addEventListener("input", () => { ui.expectedEdited = true; render(); });
["#month", "#nMonths"].forEach((s) => $(s).addEventListener("change", render));
$("#kOverride").addEventListener("input", render);
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang; store.set("sp.lang", lang); applyLang();
}));
Object.values(SAL_FIELDS).forEach((sel) => $(sel).addEventListener("input", () => { saveSal(); renderSalary(ui.salPred); statsChanged(); }));
$("#salRate").addEventListener("input", () => { ui.salRateEdited = true; renderSalary(ui.salPred); });
$("#useSalPred").addEventListener("click", () => { ui.salRateEdited = false; renderSalary(ui.salPred); });
document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  ui.salMode = b.dataset.mode; saveSal(); renderSalary(ui.salPred);
}));
$("#salReset").addEventListener("click", () => {
  const x = $("#salary").value, raise = $("#salRaise").value;
  store.del("sp.salary"); loadSal(); $("#salary").value = x; $("#salRaise").value = raise;
  saveSal(); renderSalary(ui.salPred);
});
const taxChanged = (rows) => { saveTax(); if (rows) renderTaxEditor(); else checkTax(); renderSalary(ui.salPred); };
$("#taxOn").addEventListener("change", (e) => {
  ui.tax.on = e.target.checked;
  $("#taxBody").classList.toggle("off", !ui.tax.on);
  taxChanged(false);
});
$("#taxRows").addEventListener("input", (e) => {
  const { i, k } = e.target.dataset;
  if (i == null) return;
  ui.tax.brackets[+i][k] = e.target.value;
  taxChanged(false);
});
$("#taxRows").addEventListener("click", (e) => {
  const b = e.target.closest("[data-remove]");
  if (!b) return;
  ui.tax.brackets.splice(+b.dataset.remove, 1);
  taxChanged(true);
});
$("#taxAdd").addEventListener("click", () => {
  ui.tax.brackets.push({ from: "", rate: "" });
  taxChanged(true);
  $("#taxRows").querySelector(`[data-i="${ui.tax.brackets.length - 1}"]`).focus();
});
$("#taxReset").addEventListener("click", () => {
  ui.tax.brackets = TAX_DEFAULTS.brackets.map((b) => ({ ...b }));
  taxChanged(true);
});
document.querySelectorAll("[data-taxview]").forEach((b) => b.addEventListener("click", () => {
  ui.tax.view = b.dataset.taxview; saveTax(); renderSalary(ui.salPred);
}));
const earnChanged = (rows) => { saveEarnings(); if (rows) renderEarnEditors(); else updateVacDays(); renderEarnings(); statsChanged(); };
const earnInput = (e) => {
  const { list, i, k } = e.target.dataset;
  if (!list || i == null || !k) return;
  ui.earn[list][+i][k] = e.target.value;
  earnChanged(false);
};
["#erPeriods", "#erVacs", "#erExtra"].forEach((s) => {
  $(s).addEventListener("input", earnInput);
  $(s).addEventListener("change", earnInput);
  $(s).addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    ui.earn[b.dataset.list].splice(+b.dataset.remove, 1);
    earnChanged(true);
  });
});
$("#erAddPeriod").addEventListener("click", () => {
  const last = ui.earn.periods[ui.earn.periods.length - 1];
  ui.earn.periods.push({ from: "", salary: last ? last.salary : "", system: last ? last.system : "new" });
  earnChanged(true);
  $("#erPeriods").querySelector(`[data-i="${ui.earn.periods.length - 1}"]`).focus();
});
$("#erAddVac").addEventListener("click", () => {
  ui.earn.vacations.push({ from: "", to: "", kind: "vac" });
  earnChanged(true);
  $("#erVacs").querySelector(`[data-i="${ui.earn.vacations.length - 1}"]`).focus();
});
$("#erAddExtra").addEventListener("click", () => {
  ui.earn.extra.push({ date: "" });
  earnChanged(true);
  $("#erExtra").querySelector(`[data-i="${ui.earn.extra.length - 1}"]`).focus();
});
/** Clicking a day off in the calendar marks it as worked, or unmarks it. */
const toggleWorkedDay = (cell) => {
  const d = cell?.dataset.date;
  if (!d) return;
  const i = ui.earn.extra.findIndex((x) => earnDate(x.date) === d);
  if (i >= 0) ui.earn.extra = ui.earn.extra.filter((x) => earnDate(x.date) !== d);
  else ui.earn.extra.push({ date: d });
  earnChanged(true);
  $(`#erCal [data-date="${d}"]`)?.focus();
};
$("#erCal").addEventListener("click", (e) => toggleWorkedDay(e.target.closest("[data-date]")));
$("#erCal").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  toggleWorkedDay(e.target.closest("[data-date]"));
});
$("#erYear").addEventListener("change", (e) => { ui.earn.year = +e.target.value; renderEarnings(); });
$("#fileVac").addEventListener("change", (e) => readTextFile(e.target, (text, f) => {
  const v = parseVacations(text);
  if (!v.length) return ["stBadVac", { f }];
  ui.earn.vacations = v;
  earnChanged(true);
  return ["stVacLoaded", { f, n: v.length }];
}));
$("#fileHol").addEventListener("change", (e) => readTextFile(e.target, (text, f) => {
  const h = parseHolidays(text);
  if (!h.years.size) return ["stBadHol", { f }];
  saveHolidays(h);
  calendarChanged();
  return ["stHolLoaded", { f, y: [...h.years].sort().join(", ") }];
}));
const calendarChanged = () => { loadCalendar(); renderEarnEditors(); renderEarnings(); };
$("#holReset").addEventListener("click", () => { store.del("sp.holidays"); calendarChanged(); });
$("#holFetch").addEventListener("click", refreshCalendars);
$("#holTemplate").addEventListener("click", () => downloadText(`holidays-${ui.earn.year}.csv`, holidayTemplate(ui.earn.year)));
$("#vacTemplate").addEventListener("click", () => downloadText("vacations.csv", vacationTemplate()));
document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => showSection(b.dataset.nav)));
$("#statsOn").addEventListener("change", (e) => setStatsChoice(e.target.checked));
$("#statsYes").addEventListener("click", () => { setStatsChoice(true); $("#statsAsk").close(); });
$("#statsNo").addEventListener("click", () => { setStatsChoice(false); $("#statsAsk").close(); });
$("#exportData").addEventListener("click", exportData);
$("#importData").addEventListener("click", () => $("#fileImport").click());
$("#fileImport").addEventListener("change", (e) => {
  if ($("#welcome").open) $("#welcome").close();
  readTextFile(e.target, importData);
});
$("#welcomeImport").addEventListener("click", () => $("#fileImport").click());
$("#welcomeSkip").addEventListener("click", () => $("#welcome").close());
window.addEventListener("hashchange", () => showSection(location.hash.slice(1)));
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { drawChart(); drawSalaryChart(); }, 100); });

loadData();
loadSal();
loadTax();
loadCalendar();
loadEarnings();
applyLang();
showSection(initialSection());
refreshOnline();
syncStats();
askWelcome();
