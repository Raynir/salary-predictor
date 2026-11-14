// ---------- sidebar navigation ----------
const SECTIONS = { forecast: "navForecast", salary: "navSalary", "salary-history": "navSalHistory", earnings: "navEarnings", settings: "navSettings" };

function showSection(id) {
  if (!(id in SECTIONS)) id = "forecast";
  ui.section = id;
  document.querySelectorAll("[data-section]").forEach((s) => { s.hidden = s.dataset.section !== id; });
  document.querySelectorAll("[data-nav]").forEach((b) => {
    if (b.dataset.nav === id) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const title = $("#sectionTitle");
  title.dataset.t = SECTIONS[id];
  title.textContent = tr(SECTIONS[id]);
  if (location.hash.slice(1) !== id) {
    try { history.replaceState(null, "", "#" + id); } catch { location.hash = id; } // some browsers restrict history on file://
  }
  store.set("sp.section", id);
  // Charts drawn while hidden measure 0 px wide, so redraw them now that they are visible
  drawChart();
  drawSalaryChart();
}

const initialSection = () => location.hash.slice(1) || store.get("sp.section") || "forecast";
