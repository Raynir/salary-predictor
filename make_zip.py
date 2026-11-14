"""Pack predictor.html and src/ into a .zip to hand out, optionally with the statistics URL filled in.

The repository keeps STATS_URL in src/js/stats.js empty. This script writes the URL only into the copy inside the
archive, so the URL never has to be committed. Python 3.8+ standard library only. Usage:

    python make_zip.py                          # URL from stats_url.txt if it exists, else statistics stay off
    python make_zip.py --stats-url https://script.google.com/macros/s/.../exec
    python make_zip.py --no-stats               # ignore stats_url.txt
    python make_zip.py --with-sources           # also data/, update_data.py and README.md
    python make_zip.py -o my.zip

stats_url.txt (one line, the Apps Script /exec URL) and dist/ are in .gitignore.

Values kept out of the repository go in private/ (also gitignored) and are filled into the archive only:
    private/company_rates.csv   real company rates: embedded in the archive's src/data.js (and data/ with sources)
    private/scheme.json         pay-scheme defaults for SAL_DEFAULTS, e.g. {"fixed": "0.5", "lower": "50", ...}
"""

import argparse
import datetime as dt
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL_FILE = ROOT / "stats_url.txt"
STATS_JS = "src/js/stats.js"
STATS_LINE = 'const STATS_URL = "";'
TOP = "SalaryPredictor"
PRIVATE_RATES = ROOT / "private" / "company_rates.csv"
PRIVATE_SCHEME = ROOT / "private" / "scheme.json"
SALARY_JS = "src/js/salary.js"
SCHEME_KEYS = ("fixed", "lower", "base", "upper", "yMin", "yMax", "mode")


def with_scheme(text):
    """salary.js with the SAL_DEFAULTS values from private/scheme.json."""
    scheme = json.loads(PRIVATE_SCHEME.read_text(encoding="utf-8"))
    bad = [k for k in scheme if k not in SCHEME_KEYS]
    if bad:
        sys.exit(f"{PRIVATE_SCHEME.name}: unknown keys {bad}; allowed: {', '.join(SCHEME_KEYS)}")
    rows = text.split("\n")
    at = [i for i, line in enumerate(rows) if line.startswith("const SAL_DEFAULTS = {")]
    if len(at) != 1:
        sys.exit(f"{SALARY_JS} must contain exactly one line starting with 'const SAL_DEFAULTS = {{'.")
    for k, v in scheme.items():
        rows[at[0]], n = re.subn(rf'\b{k}: "[^"]*"', lambda _: f"{k}: {json.dumps(str(v))}", rows[at[0]])
        if n != 1:
            sys.exit(f"{SALARY_JS}: SAL_DEFAULTS has no {k}.")
    return "\n".join(rows)


def stats_url(args):
    if args.no_stats:
        return ""
    url = args.stats_url
    if url is None and URL_FILE.exists():
        url = URL_FILE.read_text(encoding="utf-8").strip()
    url = (url or "").strip()
    if url and not url.startswith("https://"):
        sys.exit(f"Statistics URL must start with https://, got: {url}")
    if url and not (url.startswith("https://script.google.com/") and url.endswith("/exec")):
        print("Warning: this doesn't look like an Apps Script /exec URL.", file=sys.stderr)
    return url


def files(with_sources):
    yield ROOT / "predictor.html"
    yield from sorted(p for p in (ROOT / "src").rglob("*") if p.is_file())
    if with_sources:  # for people who want to rebuild src/data.js themselves
        yield from sorted(p for p in (ROOT / "data").rglob("*") if p.is_file())
        yield ROOT / "update_data.py"
        yield ROOT / "README.md"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stats-url", help="Apps Script /exec URL (default: contents of stats_url.txt)")
    ap.add_argument("--no-stats", action="store_true", help="leave statistics off even if stats_url.txt exists")
    ap.add_argument("--with-sources", action="store_true", help="also include data/, update_data.py and README.md")
    ap.add_argument("-o", "--output", help="archive path (default: dist/SalaryPredictor-YYYY-MM-DD.zip)")
    args = ap.parse_args()

    url = stats_url(args)
    if (ROOT / STATS_JS).read_text(encoding="utf-8").count(STATS_LINE) != 1:
        sys.exit(f"{STATS_JS} must contain exactly one line {STATS_LINE!r}. Put the URL in stats_url.txt instead.")
    out = Path(args.output) if args.output else ROOT / "dist" / f"{TOP}-{dt.date.today().isoformat()}.zip"
    out.parent.mkdir(parents=True, exist_ok=True)

    rates, scheme = PRIVATE_RATES.exists(), PRIVATE_SCHEME.exists()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files(args.with_sources):
            rel = p.relative_to(ROOT).as_posix()
            data = p.read_bytes()
            if rel == STATS_JS:
                text = data.decode("utf-8")
                if url:
                    text = text.replace(STATS_LINE, f"const STATS_URL = {json.dumps(url)};")
                data = text.encode("utf-8")
            elif rel == SALARY_JS and scheme:
                data = with_scheme(data.decode("utf-8")).encode("utf-8")
            elif rel == "src/data.js" and rates:
                import update_data  # next to this script, standard library only
                data = update_data.data_js_text(PRIVATE_RATES).encode("utf-8")
            elif rel == "data/company_rates.csv" and rates:
                data = PRIVATE_RATES.read_bytes()
            z.writestr(f"{TOP}/{rel}", data)

    print(f"Wrote {out}")
    print(f"Statistics: {'on, sending to ' + url if url else 'off'}")
    print(f"Company rates: {'from private/company_rates.csv' if rates else 'as in the repository'}")
    print(f"Pay-scheme defaults: {'from private/scheme.json' if scheme else 'as in the repository'}")


if __name__ == "__main__":
    main()
