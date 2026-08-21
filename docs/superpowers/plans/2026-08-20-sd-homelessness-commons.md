# SD Homelessness Data Commons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An idempotent pipeline (`python run.py`) that builds `commons.duckdb` + CSV/GeoJSON marts fusing five homelessness signal layers onto a shared spatial grid and time index, with auto-generated data dictionary and QA report.

**Architecture:** A `commons/` Python package: a cached HTTP fetcher writes to `raw/`; per-source staging loaders (one module per source) load native-grain tables into DuckDB; a geo module assigns `geo_block`/`h3_r8`/`neighborhood` via shapely STRtree + h3; marts unify everything into long-format signal tables; docs/QA generators read a central `TABLE_DOCS` registry. `run.py` runs steps in priority order C→A→D→B→F→E→G with fail-soft wrapping; `refresh.py` re-runs only C and D.

**Tech Stack:** Python 3.11+, duckdb, pandas, pyarrow, requests, shapely>=2.0, h3>=4.0, pdfplumber, pytest.

**Spec:** `docs/superpowers/specs/2026-08-20-sd-homelessness-commons-spec.md` (read it first; it contains the verified source URLs and schemas).

## Global Constraints

- Python 3.11+; deps exactly: `duckdb`, `pandas`, `pyarrow`, `requests`, `shapely>=2.0`, `h3>=4`, `pdfplumber`, `pytest` (no geopandas — too heavy for tonight).
- `python run.py` must rebuild everything from `raw/` cache; safe to run twice (idempotent: staging tables are `CREATE OR REPLACE`).
- Never re-download unchanged files: conditional GET (ETag/Last-Modified) + manifest in `raw/_manifest.json`.
- Fail soft: any single source failure must not stop the run; record gap in `meta_sources.load_status` and QA report. Priority order: C → A → D → B → F → E → G.
- No PII: never load `public_description` or `street_address` into the DB. Public-tier export (`marts/monthly_by_neighborhood.csv`) is neighborhood grain only — no block IDs, no lat/lng, no free text.
- Never present complaint (311) or enforcement counts as counts of people — enforced by wording in `measures`/`known_bias` registry entries and QA interpretation lines.
- Source A does NOT apply post-April-2017 occupancy multipliers; do not add them; note in `known_bias`.
- Every task ends with a commit. Commit messages: `feat:`/`test:`/`docs:`/`chore:` prefixes.
- All timestamps naive local dates as published by sources; months stored as first-of-month `DATE`.

## Canonical column conventions (all tasks)

- `obs_month DATE` — first of month. `obs_date DATE` — native date. `requested_at TIMESTAMP`.
- Geo columns on every fact table: `geo_block TEXT` (nullable, geoid10 like `10100US060730054004032`), `h3_r8 TEXT` (nullable), `neighborhood TEXT` (nullable, snake_case: `east_village, city_center, columbia, marina, cortez, gaslamp`), `zip TEXT` (nullable).
- `signal_type` ∈ {observation, complaint, enforcement, capacity, context}.
- `LoadResult` dataclass (defined Task 2): `status: str` ('ok'|'partial'|'failed'|'stubbed'), `rows: int`, `note: str`.

---

### Task 0: Repo scaffold

**Files:**
- Create: `.gitignore`, `requirements.txt`, `README.md`, `commons/__init__.py`, `commons/config.py`, `seeds/.gitkeep`, `tests/__init__.py`

**Interfaces:**
- Produces: `commons.config` constants used by every later task: `ROOT, RAW_DIR, MARTS_DIR, DB_PATH, SRC_A_FILES, GID_CLOSED_URL, GID_OPEN_URL, GID_DICT_URL, V72_URL, CITATIONS_URL, NOAA_URL, ZORI_URL, DOWNTOWN_NEIGHBORHOODS, GID_YEARS, CITATION_YEARS`

- [ ] **Step 1: Write files**

`.gitignore`:
```
raw/
commons.duckdb
__pycache__/
*.pyc
.pytest_cache/
.venv/
```

`requirements.txt`:
```
duckdb>=1.0
pandas>=2.0
pyarrow>=15
requests>=2.31
shapely>=2.0
h3>=4.0
pdfplumber>=0.11
pytest>=8.0
```

`commons/config.py`:
```python
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "raw"
MARTS_DIR = ROOT / "marts"
SEEDS_DIR = ROOT / "seeds"
DB_PATH = ROOT / "commons.duckdb"

_METATAB = "http://library.metatab.org/sandiegodata.org-dowtown_homeless-2.1.1/data"
SRC_A_FILES = {  # rel raw path -> url
    "src_a/homeless_counts.csv": f"{_METATAB}/homeless_counts.csv",
    "src_a/imputed_counts.csv": f"{_METATAB}/imputed_counts.csv",
    "src_a/monthly_totals.csv": f"{_METATAB}/monthly_totals.csv",
    "src_a/neighborhood_totals.csv": f"{_METATAB}/neighborhood_totals.csv",
    "src_a/downtown_blocks.csv": f"{_METATAB}/downtown_blocks.csv",
}
SRC_A_PAGE = "https://data.sandiegodata.org/dataset/sandiegodata-org-dowtown-homeless/"

GID_YEARS = range(2016, dt.date.today().year + 1)
GID_CLOSED_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_closed_{year}_datasd.csv"
GID_OPEN_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_open_datasd.csv"
GID_DICT_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_dictionary_datasd.csv"
GID_PAGE = "https://data.sandiego.gov/datasets/get-it-done-311/"

V72_URL = "https://seshat.datasd.org/get_it_done_parking_violations/get_it_done_72_hour_violation_requests_datasd.csv"
V72_PAGE = "https://data.sandiego.gov/datasets/gid-72-hour-violation/"
CITATION_YEARS = range(2014, dt.date.today().year + 1)
CITATIONS_URL = "https://seshat.datasd.org/parking_citations/parking_citations_{year}_part{part}_datasd.csv"
CITATIONS_PAGE = "https://data.sandiego.gov/datasets/parking-citations/"

NOAA_STATION = "USW00023188"  # San Diego Intl Airport
NOAA_URL = (
    "https://www.ncei.noaa.gov/access/services/data/v1"
    "?dataset=daily-summaries&stations=USW00023188&dataTypes=TMAX,TMIN,PRCP"
    "&startDate=2012-01-01&endDate={end}&format=csv&units=metric"
)
ZORI_URL = "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv"

DOWNTOWN_NEIGHBORHOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]
DOWNTOWN_ZIP = "92101"
```

`README.md` (skeleton — finalized in Task 14):
```markdown
# SD Homelessness Data Commons
Reproducible pipeline fusing San Diego homelessness signals into one DuckDB.
## Run
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python run.py        # full build
    python refresh.py    # incremental refresh of 311 + enforcement only
```

- [ ] **Step 2: Verify package imports**

Run: `cd /Users/pynay/Documents/DSAHacks && python3 -c "from commons import config; print(config.DB_PATH, len(config.SRC_A_FILES))"`
Expected: prints DB path and `5`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold repo, config with verified source URLs"
```

**Exit criteria:**
1. `python3 -c "from commons import config"` succeeds.
2. All URLs in config match the spec's verified-live URLs exactly.
3. `git log --oneline` shows the scaffold commit; `raw/` is gitignored.

---

### Task 1: Cached fetcher (`commons/fetch.py`)

**Files:**
- Create: `commons/fetch.py`, `tests/test_fetch.py`

**Interfaces:**
- Produces: `fetch(url: str, rel_path: str, force: bool = False, timeout: int = 120) -> FetchResult` where `FetchResult` is a dataclass with `path: Path`, `status: str` ('downloaded'|'cached'|'failed'), `fetched_at: str | None`. On failure with no cached copy, `path` may not exist — callers check `status`.
- Manifest: `raw/_manifest.json` maps rel_path → `{url, etag, last_modified, sha256, fetched_at, size}`.

- [ ] **Step 1: Write failing tests**

`tests/test_fetch.py`:
```python
import json
from unittest import mock
import commons.fetch as fetch_mod
from commons.fetch import fetch

def _resp(status=200, body=b"a,b\n1,2\n", headers=None):
    r = mock.Mock()
    r.status_code = status
    r.headers = headers or {"ETag": '"abc"'}
    r.iter_content = lambda chunk_size: iter([body])
    return r

def test_downloads_then_caches(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", return_value=_resp()) as g:
        r1 = fetch("http://x/f.csv", "t/f.csv")
    assert r1.status == "downloaded" and r1.path.read_bytes() == b"a,b\n1,2\n"
    man = json.loads((tmp_path / "_manifest.json").read_text())
    assert man["t/f.csv"]["etag"] == '"abc"'
    # second call: server says 304 -> cached, no rewrite
    with mock.patch("commons.fetch.requests.get", return_value=_resp(status=304)) as g:
        r2 = fetch("http://x/f.csv", "t/f.csv")
        sent = g.call_args.kwargs["headers"]
    assert r2.status == "cached" and sent.get("If-None-Match") == '"abc"'

def test_failure_with_cache_falls_back(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", return_value=_resp()):
        fetch("http://x/f.csv", "t/f.csv")
    with mock.patch("commons.fetch.requests.get", side_effect=OSError("net down")):
        r = fetch("http://x/f.csv", "t/f.csv")
    assert r.status == "cached" and r.path.exists()

def test_failure_no_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", side_effect=OSError("net down")):
        r = fetch("http://x/g.csv", "t/g.csv")
    assert r.status == "failed"
```

- [ ] **Step 2: Run tests, verify fail**

Run: `python3 -m pytest tests/test_fetch.py -v`
Expected: FAIL (ModuleNotFoundError / ImportError)

- [ ] **Step 3: Implement**

`commons/fetch.py`:
```python
import datetime as dt
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import requests

from commons.config import RAW_DIR as _RAW_DIR

RAW_DIR = _RAW_DIR  # module attr so tests can monkeypatch


@dataclass
class FetchResult:
    path: Path
    status: str  # downloaded | cached | failed
    fetched_at: str | None = None


def _manifest_path() -> Path:
    return RAW_DIR / "_manifest.json"


def _load_manifest() -> dict:
    p = _manifest_path()
    return json.loads(p.read_text()) if p.exists() else {}


def _save_manifest(man: dict) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    _manifest_path().write_text(json.dumps(man, indent=1))


def fetch(url: str, rel_path: str, force: bool = False, timeout: int = 120) -> FetchResult:
    dest = RAW_DIR / rel_path
    man = _load_manifest()
    entry = man.get(rel_path, {})
    headers = {}
    if dest.exists() and not force:
        if entry.get("etag"):
            headers["If-None-Match"] = entry["etag"]
        if entry.get("last_modified"):
            headers["If-Modified-Since"] = entry["last_modified"]
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, stream=True)
    except Exception:
        if dest.exists():
            return FetchResult(dest, "cached", entry.get("fetched_at"))
        return FetchResult(dest, "failed")
    if resp.status_code == 304 and dest.exists():
        return FetchResult(dest, "cached", entry.get("fetched_at"))
    if resp.status_code != 200:
        if dest.exists():
            return FetchResult(dest, "cached", entry.get("fetched_at"))
        return FetchResult(dest, "failed")
    dest.parent.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            f.write(chunk)
            h.update(chunk)
    man[rel_path] = {
        "url": url,
        "etag": resp.headers.get("ETag"),
        "last_modified": resp.headers.get("Last-Modified"),
        "sha256": h.hexdigest(),
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        "size": dest.stat().st_size,
    }
    _save_manifest(man)
    return FetchResult(dest, "downloaded", man[rel_path]["fetched_at"])
```

- [ ] **Step 4: Run tests, verify pass**

Run: `python3 -m pytest tests/test_fetch.py -v` — Expected: 3 PASS

- [ ] **Step 5: Smoke against a real small URL**

Run: `python3 -c "from commons.fetch import fetch; r=fetch('https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_dictionary_datasd.csv','src_c/dictionary.csv'); print(r.status, r.path.stat().st_size); r2=fetch('https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_dictionary_datasd.csv','src_c/dictionary.csv'); print(r2.status)"`
Expected: `downloaded <size>` then `cached` (seshat serves ETags)

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: cached conditional-GET fetcher with manifest"`

**Exit criteria:**
1. `pytest tests/test_fetch.py` green.
2. Real-URL smoke shows second call returns `cached` (no re-download of unchanged files).
3. `raw/_manifest.json` contains url, etag/last_modified, sha256, fetched_at, size.

---

### Task 2: DuckDB schema, lineage registry, run orchestrator skeleton

**Files:**
- Create: `commons/db.py`, `commons/registry.py`, `run.py`, `tests/test_db.py`

**Interfaces:**
- Produces: `db.connect(path=DB_PATH) -> duckdb connection`; `db.ensure_schema(con)` (creates meta tables); `registry.LoadResult(status, rows, note)`; `registry.TABLE_DOCS: dict[str, dict]` with keys `grain, signal_type, source_id, source_url, refresh, measures, known_bias`; `registry.SOURCES: dict[str, dict]` (source_id → name, url, signal_type, refresh_cadence, measures, known_bias); `run.py` STEPS list of `(step_name, source_id, callable(con) -> LoadResult)` executed fail-soft, writing `meta_sources` + `meta_runs`.

- [ ] **Step 1: Write failing test**

`tests/test_db.py`:
```python
import duckdb
from commons import db, registry

def test_schema_and_source_upsert():
    con = duckdb.connect()
    db.ensure_schema(con)
    db.record_load(con, "C", registry.LoadResult("ok", 123, "loaded"))
    row = con.execute("SELECT source_id, load_status, rows_loaded FROM meta_sources WHERE source_id='C'").fetchone()
    assert row == ("C", "ok", 123)
    assert registry.SOURCES["C"]["signal_type"] == "complaint"
    for t, doc in registry.TABLE_DOCS.items():
        assert doc["measures"] and doc["known_bias"], t

def test_fail_soft_runner():
    con = duckdb.connect()
    db.ensure_schema(con)
    def boom(con): raise RuntimeError("nope")
    results = db.run_steps(con, [("bad_step", "C", boom)])
    assert results["bad_step"].status == "failed" and "nope" in results["bad_step"].note
```

- [ ] **Step 2: Run, verify fail** — `python3 -m pytest tests/test_db.py -v` → ImportError

- [ ] **Step 3: Implement registry**

`commons/registry.py` — the single place lineage/bias language lives. Every later task ADDS its tables here (the dict literals below are complete for meta tables; later tasks append entries in their own steps):
```python
from dataclasses import dataclass

@dataclass
class LoadResult:
    status: str  # ok | partial | failed | stubbed
    rows: int = 0
    note: str = ""

SOURCES = {
    "A": dict(name="Downtown block-level monthly counts (sandiegodata.org)",
        url="https://data.sandiegodata.org/dataset/sandiegodata-org-dowtown-homeless/",
        signal_type="observation", refresh_cadence="static (2014-2019 archive)",
        measures="People, tent/structures, and vehicles physically counted on downtown streets monthly by Downtown San Diego Partnership contractors.",
        known_bias="Single monthly early-morning count; undercounts people in vehicles/hidden locations. 3 months imputed (Aug/Sep 2014, Jun 2015). Methodology changed Apr 2017 (occupancy multipliers) but THIS dataset does NOT apply multipliers - series is raw counted units throughout."),
    "B": dict(name="Downtown SD Partnership monthly report totals",
        url="https://downtownsandiego.org/",
        signal_type="observation", refresh_cadence="monthly (manual/PDF)",
        measures="Monthly unsheltered totals reported by DSDP for downtown neighborhoods.",
        known_bias="Same single-count limits as A; post-2017 reports may apply occupancy multipliers, so levels are not directly comparable to source A raw counts. Collected partly from press coverage."),
    "C": dict(name="Get It Done 311 requests (homelessness-related)",
        url="https://data.sandiego.gov/datasets/get-it-done-311/",
        signal_type="complaint", refresh_cadence="daily (auto)",
        measures="Resident-submitted 311 reports whose service category relates to homelessness (encampments, outreach requests). Measures complaint volume, NOT people.",
        known_bias="Reporting propensity varies by neighborhood, app adoption, and category renames over time. One encampment can generate many reports. Never interpret as a count of people."),
    "D": dict(name="Enforcement: 72-hr violations + selected parking citations",
        url="https://data.sandiego.gov/datasets/parking-citations/",
        signal_type="enforcement", refresh_cadence="daily/annual (auto)",
        measures="72-hour parking violation reports and citations under oversize-vehicle/72-hour/habitation-adjacent codes. Measures enforcement activity, NOT people.",
        known_bias="Driven by complaint volume and patrol priorities; policy changes shift enforcement independent of homelessness. Citations lack coordinates (citywide only)."),
    "E": dict(name="Shelter capacity (City/SDHC monthly reports)",
        url="https://www.sandiego.gov/homelessness-strategies-and-solutions/data-reports",
        signal_type="capacity", refresh_cadence="monthly (manual/PDF)",
        measures="Shelter beds available and occupancy by program/site.",
        known_bias="Reporting formats change; some programs missing months; occupancy definitions vary by provider."),
    "F": dict(name="Annual Point-in-Time counts (RTFH)",
        url="https://www.rtfhsd.org/",
        signal_type="observation", refresh_cadence="annual (manual seed)",
        measures="Annual one-night sheltered/unsheltered counts.",
        known_bias="One night per year; methodology changes across years; known undercount of hidden homelessness."),
    "G_weather": dict(name="NOAA GHCN-Daily USW00023188", url="https://www.ncei.noaa.gov/",
        signal_type="context", refresh_cadence="daily (auto)",
        measures="Daily TMAX/TMIN (C) and precipitation (mm) at San Diego Intl Airport.",
        known_bias="Single station; microclimates differ across the city."),
    "G_zori": dict(name="Zillow ZORI zip-level rents", url="https://www.zillow.com/research/data/",
        signal_type="context", refresh_cadence="monthly (auto)",
        measures="Smoothed typical asking rent by zip.",
        known_bias="Asking rents of listed units only; smoothed/seasonally adjusted; zips partially covered."),
    "G_events": dict(name="Policy events (hand-curated)", url="seeds/events.csv",
        signal_type="context", refresh_cadence="manual",
        measures="Dated policy/shelter/sweep events with source URLs.",
        known_bias="Curated selection; some dates uncertain and flagged for verification."),
}

TABLE_DOCS: dict[str, dict] = {}  # table_name -> doc dict; loaders register at import

def register_table(name, grain, signal_type, source_id, measures, known_bias, refresh):
    TABLE_DOCS[name] = dict(grain=grain, signal_type=signal_type, source_id=source_id,
                            source_url=SOURCES[source_id]["url"], refresh=refresh,
                            measures=measures, known_bias=known_bias)
```

- [ ] **Step 4: Implement db module**

`commons/db.py`:
```python
import datetime as dt
import traceback

import duckdb

from commons.config import DB_PATH
from commons.registry import SOURCES, LoadResult

META_DDL = """
CREATE TABLE IF NOT EXISTS meta_sources (
  source_id TEXT PRIMARY KEY, name TEXT, url TEXT, signal_type TEXT,
  refresh_cadence TEXT, measures TEXT, known_bias TEXT,
  load_status TEXT, rows_loaded BIGINT, load_note TEXT, loaded_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS meta_runs (
  run_at TIMESTAMP, step TEXT, source_id TEXT, status TEXT, rows BIGINT, note TEXT);
"""

def connect(path=DB_PATH):
    return duckdb.connect(str(path))

def ensure_schema(con):
    con.execute(META_DDL)
    for sid, s in SOURCES.items():
        con.execute("""
            INSERT INTO meta_sources (source_id,name,url,signal_type,refresh_cadence,measures,known_bias)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT (source_id) DO UPDATE SET name=excluded.name, url=excluded.url,
              signal_type=excluded.signal_type, refresh_cadence=excluded.refresh_cadence,
              measures=excluded.measures, known_bias=excluded.known_bias
        """, [sid, s["name"], s["url"], s["signal_type"], s["refresh_cadence"], s["measures"], s["known_bias"]])

def record_load(con, source_id, res: LoadResult):
    now = dt.datetime.now()
    con.execute("UPDATE meta_sources SET load_status=?, rows_loaded=?, load_note=?, loaded_at=? WHERE source_id=?",
                [res.status, res.rows, res.note, now, source_id])

def run_steps(con, steps):
    """steps: list of (step_name, source_id, fn(con)->LoadResult). Fail-soft."""
    results = {}
    for name, source_id, fn in steps:
        try:
            res = fn(con)
        except Exception as e:
            res = LoadResult("failed", 0, f"{type(e).__name__}: {e}\n{traceback.format_exc(limit=3)}")
        results[name] = res
        if source_id:
            record_load(con, source_id, res)
        con.execute("INSERT INTO meta_runs VALUES (?,?,?,?,?,?)",
                    [dt.datetime.now(), name, source_id, res.status, res.rows, res.note[:500]])
        print(f"[{res.status:>7}] {name}: {res.rows} rows. {res.note.splitlines()[0] if res.note else ''}")
    return results
```

`run.py` (skeleton; later tasks append imports + STEPS entries — final form shown in Task 14):
```python
from commons import db

STEPS = []  # (name, source_id, fn) appended as loaders land

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    return results

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run tests, verify pass** — `python3 -m pytest tests/test_db.py -v` → 2 PASS
- [ ] **Step 6: Run `python3 run.py`** — Expected: exits 0, creates `commons.duckdb` with meta tables populated (10 sources).
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: duckdb meta schema, lineage registry, fail-soft orchestrator"`

**Exit criteria:**
1. `pytest tests/test_db.py` green; `python3 run.py` exits 0.
2. `duckdb commons.duckdb "SELECT count(*) FROM meta_sources"` → 10; every row has non-empty `measures` and `known_bias`.
3. A raising step yields status `failed` in `meta_runs` without aborting the run (covered by test).

---

### Task 3: Source A staging (downtown counts, blocks, totals)

**Files:**
- Create: `commons/staging/__init__.py`, `commons/staging/src_a.py`, `tests/test_src_a.py`
- Modify: `run.py` (append A steps after C's placeholder position — order in STEPS list is C first once C lands; for now A is first)

**Interfaces:**
- Consumes: `fetch.fetch`, `db` helpers, `registry.register_table`.
- Produces tables: `stg_a_observations(obs_date DATE, obs_month DATE, neighborhood TEXT, entity_type TEXT, geo_block TEXT, lon DOUBLE, lat DOUBLE, h3_r8 TEXT, zip TEXT, is_imputed BOOLEAN, source_file TEXT)`; `stg_a_monthly_totals(obs_month DATE, total INT)`; `stg_a_neighborhood_totals(obs_month DATE, neighborhood TEXT, total INT)`; `dim_blocks(geo_block TEXT PRIMARY KEY, block_name TEXT, neighborhood TEXT, zip TEXT, aland_m2 BIGINT, intpt_lat DOUBLE, intpt_lon DOUBLE, geometry_wkt TEXT)`.
- Produces function: `src_a.load(con) -> LoadResult`.
- Note: `h3_r8` filled here via `h3.latlng_to_cell(lat, lon, 8)`; `zip` = constant `92101` for downtown blocks (documented decision). `dim_blocks.neighborhood` = modal neighborhood of observations falling in that block (blocks file itself has no neighborhood column).

- [ ] **Step 1: Write failing tests**

`tests/test_src_a.py`:
```python
import duckdb
from commons import db
from commons.staging import src_a

def test_src_a_load_real():
    con = duckdb.connect()
    db.ensure_schema(con)
    res = src_a.load(con)   # uses raw/ cache; downloads on first run
    assert res.status == "ok"
    # imputed flag: exactly the 3 documented months
    months = con.execute("""
        SELECT DISTINCT strftime(obs_month, '%Y-%m') FROM stg_a_observations
        WHERE is_imputed ORDER BY 1""").fetchall()
    assert [m[0] for m in months] == ["2014-08", "2014-09", "2015-06"]
    # every observation carries geo_block and h3
    n_bad = con.execute("SELECT count(*) FROM stg_a_observations WHERE geo_block IS NULL OR h3_r8 IS NULL").fetchone()[0]
    assert n_bad == 0
    # blocks dim populated with valid WKT polygons and neighborhoods
    n_blocks, n_hood = con.execute(
        "SELECT count(*), count(neighborhood) FROM dim_blocks").fetchone()
    assert n_blocks > 100 and n_hood > 0
    # monthly totals reach back to 2012 and forward to 2019
    lo, hi = con.execute("SELECT min(obs_month), max(obs_month) FROM stg_a_monthly_totals").fetchone()
    assert str(lo) == "2012-01-01" and str(hi) >= "2019-04-01"
```

- [ ] **Step 2: Run, verify fail** — `python3 -m pytest tests/test_src_a.py -v` → ImportError

- [ ] **Step 3: Implement `commons/staging/src_a.py`**

```python
import pandas as pd
import h3

from commons import fetch
from commons.config import SRC_A_FILES, DOWNTOWN_ZIP
from commons.registry import LoadResult, register_table

register_table("stg_a_observations", grain="one row per counted entity (person/structure/vehicle) per count date",
    signal_type="observation", source_id="A", refresh="static archive",
    measures="Each row is one unit physically counted downtown on the count date.",
    known_bias="Raw counted units; NO occupancy multipliers applied (a structure = 1, not est. occupants). Imputed months flagged is_imputed.")
register_table("stg_a_monthly_totals", grain="month", signal_type="observation", source_id="A",
    measures="Downtown total counted units per month, 2012-2019.",
    known_bias="Pre-2014 rows lack point detail; single-count-per-month.")
register_table("stg_a_neighborhood_totals", grain="month x neighborhood", signal_type="observation", source_id="A",
    measures="Counted units per downtown neighborhood per month (2018-2019 DSDP-era).",
    known_bias="Overlaps DSDP reporting era; may not match sum of point data months.")
register_table("dim_blocks", grain="2010 census block", signal_type="context", source_id="A",
    measures="Downtown block polygons (WKT) with derived neighborhood.",
    known_bias="neighborhood derived as modal neighborhood of source-A observations per block; blocks with no observations have NULL neighborhood.")


def _points(path, is_imputed_file):
    df = pd.read_csv(path)
    df["obs_date"] = pd.to_datetime(df["date"]).dt.date
    df["obs_month"] = pd.to_datetime(df["date"]).dt.to_period("M").dt.to_timestamp().dt.date
    # geometry is 'POINT (lon lat)'
    coords = df["geometry"].str.extract(r"POINT \(([-\d.]+) ([-\d.]+)\)").astype(float)
    df["lon"], df["lat"] = coords[0], coords[1]
    df["h3_r8"] = [h3.latlng_to_cell(la, lo, 8) for la, lo in zip(df["lat"], df["lon"])]
    df = df.rename(columns={"type": "entity_type", "geoid": "geo_block"})
    df["zip"] = DOWNTOWN_ZIP
    df["source_file"] = path.name
    return df[["obs_date", "obs_month", "neighborhood", "entity_type", "geo_block",
               "lon", "lat", "h3_r8", "zip", "source_file"]]


def load(con) -> LoadResult:
    paths, statuses = {}, []
    for rel, url in SRC_A_FILES.items():
        r = fetch.fetch(url, rel)
        statuses.append(r.status)
        if r.status == "failed":
            return LoadResult("failed", 0, f"unreachable: {url}")
        paths[rel.split("/")[-1]] = r.path

    base = _points(paths["homeless_counts.csv"], False)
    imputed_all = _points(paths["imputed_counts.csv"], True)
    # imputed file = full series with gaps filled; keep only months absent from base
    base_months = set(base["obs_month"].unique())
    imputed_only = imputed_all[~imputed_all["obs_month"].isin(base_months)].copy()
    base["is_imputed"] = False
    imputed_only["is_imputed"] = True
    obs = pd.concat([base, imputed_only], ignore_index=True)

    mt = pd.read_csv(paths["monthly_totals.csv"])
    mt["obs_month"] = pd.to_datetime(mt["date"]).dt.date
    mt = mt.rename(columns={"count": "total"})[["obs_month", "total"]]

    nt = pd.read_csv(paths["neighborhood_totals.csv"])
    nt["obs_month"] = pd.to_datetime(nt["date"]).dt.date
    nt = nt.drop(columns=["date"]).melt(id_vars="obs_month", var_name="neighborhood", value_name="total")

    blocks = pd.read_csv(paths["downtown_blocks.csv"], dtype={"geoid10": str})
    hood = (obs.groupby(["geo_block", "neighborhood"]).size().reset_index(name="n")
            .sort_values("n", ascending=False).drop_duplicates("geo_block")
            [["geo_block", "neighborhood"]])
    blocks = blocks.rename(columns={"geoid10": "geo_block", "name10": "block_name",
                                    "aland10": "aland_m2", "intptlat10": "intpt_lat",
                                    "intptlon10": "intpt_lon", "geometry": "geometry_wkt"})
    blocks = blocks.merge(hood, on="geo_block", how="left")
    blocks["zip"] = DOWNTOWN_ZIP
    blocks = blocks[["geo_block", "block_name", "neighborhood", "zip", "aland_m2",
                     "intpt_lat", "intpt_lon", "geometry_wkt"]]

    for name, frame in [("stg_a_observations", obs), ("stg_a_monthly_totals", mt),
                        ("stg_a_neighborhood_totals", nt), ("dim_blocks", blocks)]:
        con.register("_df", frame)
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df")
        con.unregister("_df")
    return LoadResult("ok", len(obs), f"files: {statuses}; imputed rows: {int(obs.is_imputed.sum())}")
```

- [ ] **Step 4: Run tests, verify pass** — `python3 -m pytest tests/test_src_a.py -v` (first run downloads ~real files; allow 2-3 min)
- [ ] **Step 5: Wire into `run.py`** — add `from commons.staging import src_a` and `STEPS.append(("load_src_a", "A", src_a.load))`; run `python3 run.py`; expect `[ok] load_src_a`.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: source A staging - downtown counts, blocks dim, totals"`

**Exit criteria:**
1. Test asserts pass: imputed months exactly {2014-08, 2014-09, 2015-06}; zero NULL geo_block/h3_r8 in observations; >100 blocks; monthly totals span 2012-01→≥2019-04.
2. `python3 run.py` twice in a row: second run uses cache (fetch statuses `cached`) and row counts identical (idempotent).
3. `registry.TABLE_DOCS` documents all 4 tables with multiplier caveat in `known_bias`.

---

### Task 4: Geo enrichment module (`commons/geo.py`)

**Files:**
- Create: `commons/geo.py`, `tests/test_geo.py`

**Interfaces:**
- Consumes: `dim_blocks` table (Task 3).
- Produces: `geo.enrich(con, df, lat_col="lat", lng_col="lng") -> pd.DataFrame` — adds/overwrites `geo_block, neighborhood, h3_r8` columns; points outside downtown blocks get NULL geo_block/neighborhood but always get `h3_r8` when coords present; rows with NULL coords get all-NULL geo. Uses shapely STRtree over `dim_blocks.geometry_wkt`.

- [ ] **Step 1: Write failing test**

`tests/test_geo.py`:
```python
import duckdb
import pandas as pd
from commons import db, geo
from commons.staging import src_a

def _con():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con); return con

def test_enrich_known_points():
    con = _con()
    # centroid of a known block must map to that block
    gb, la, lo = con.execute(
        "SELECT geo_block, intpt_lat, intpt_lon FROM dim_blocks WHERE neighborhood IS NOT NULL LIMIT 1").fetchone()
    df = pd.DataFrame({"lat": [la, 32.9, None], "lng": [lo, -117.2, None]})  # 2nd point: far north SD, not downtown
    out = geo.enrich(con, df)
    assert out.loc[0, "geo_block"] == gb and out.loc[0, "neighborhood"] is not None
    assert pd.isna(out.loc[1, "geo_block"]) and isinstance(out.loc[1, "h3_r8"], str)
    assert pd.isna(out.loc[2, "h3_r8"]) and pd.isna(out.loc[2, "geo_block"])
```

- [ ] **Step 2: Run, verify fail** — `python3 -m pytest tests/test_geo.py -v` → ImportError

- [ ] **Step 3: Implement `commons/geo.py`**

```python
import h3
import numpy as np
import pandas as pd
from shapely import STRtree, points, from_wkt


def enrich(con, df: pd.DataFrame, lat_col="lat", lng_col="lng") -> pd.DataFrame:
    df = df.copy()
    blocks = con.execute(
        "SELECT geo_block, neighborhood, geometry_wkt FROM dim_blocks").fetch_df()
    polys = from_wkt(blocks["geometry_wkt"].values)
    tree = STRtree(polys)
    lat = pd.to_numeric(df[lat_col], errors="coerce")
    lng = pd.to_numeric(df[lng_col], errors="coerce")
    ok = lat.notna() & lng.notna() & (lat != 0) & (lng != 0)
    df["geo_block"] = pd.NA
    df["neighborhood"] = df.get("neighborhood", pd.NA)
    df["h3_r8"] = pd.NA
    if ok.any():
        df.loc[ok, "h3_r8"] = [h3.latlng_to_cell(a, b, 8) for a, b in zip(lat[ok], lng[ok])]
        pts = points(lng[ok].values, lat[ok].values)
        pi, bi = tree.query(pts, predicate="within")
        ok_idx = df.index[ok]
        df.loc[ok_idx[pi], "geo_block"] = blocks["geo_block"].values[bi]
        df.loc[ok_idx[pi], "neighborhood"] = blocks["neighborhood"].values[bi]
    return df
```

- [ ] **Step 4: Run, verify pass** — `python3 -m pytest tests/test_geo.py -v` → PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: geo enrichment - STRtree block assignment + h3 r8"`

**Exit criteria:**
1. Test green: downtown centroid → its own block; non-downtown point → NULL block but valid h3; NULL coords → all NULL.
2. `enrich` handles 0/NULL coordinates without raising (0,0 treated as missing).

---

### Task 5: Source C — 311 Get It Done (priority 1)

**Files:**
- Create: `commons/staging/src_c.py`, `seeds/gid_service_map.csv`, `tests/test_src_c.py`
- Modify: `run.py` (insert C step FIRST in STEPS, before A)

**Interfaces:**
- Consumes: `fetch`, `geo.enrich`, `dim_blocks` (must run after A in run.py despite C's download priority — ordering note below).
- Produces: `stg_gid_requests(service_request_id TEXT, parent_id TEXT, requested_at TIMESTAMP, requested_date DATE, obs_month DATE, closed_date DATE, status TEXT, case_record_type TEXT, service_name TEXT, service_name_detail TEXT, canon_category TEXT, case_origin TEXT, lat DOUBLE, lng DOUBLE, zip TEXT, comm_plan_name TEXT, geo_block TEXT, h3_r8 TEXT, neighborhood TEXT, is_child_duplicate BOOLEAN, source_file TEXT)`; function `src_c.load(con, years=None) -> LoadResult` (years param reused by refresh.py).
- Seed: `seeds/gid_service_map.csv` with header `case_record_type,service_name,service_name_detail,canon_category,include,rationale`.
- **Ordering note:** run.py STEP order is `src_a` (needs blocks for geo) then `src_c` then `src_d`... The C→A *priority* applies to download/effort priority if time-constrained, but A is a hard dependency of geo enrichment, and A is tiny. Document this in run.py comment.

- [ ] **Step 1: Enumerate real category values (exploration, before writing the seed)**

```bash
python3 - <<'EOF'
import duckdb
from commons import fetch
from commons.config import GID_CLOSED_URL, GID_YEARS, GID_OPEN_URL
con = duckdb.connect()
paths = []
for y in GID_YEARS:
    r = fetch.fetch(GID_CLOSED_URL.format(year=y), f"src_c/closed_{y}.csv")
    if r.status != "failed": paths.append(str(r.path))
r = fetch.fetch(GID_OPEN_URL, "src_c/open.csv")
if r.status != "failed": paths.append(str(r.path))
q = con.execute(f"""
  SELECT case_record_type, service_name, service_name_detail, count(*) n,
         min(substr(date_requested,1,4)) y0, max(substr(date_requested,1,4)) y1
  FROM read_csv_auto({paths!r}, union_by_name=true, all_varchar=true)
  WHERE lower(concat_ws(' ', case_record_type, service_name, service_name_detail))
        SIMILAR TO '.*(homeless|encamp|transient|outreach|shelter cart|shopping cart).*'
  GROUP BY 1,2,3 ORDER BY n DESC
""").fetch_df()
print(q.to_string())
EOF
```
Record the printed values — they are the ground truth for the seed. (This also warms the raw/ cache for all 311 files; expect several minutes on first run.)

- [ ] **Step 2: Write `seeds/gid_service_map.csv` from the real values**

Include every (case_record_type, service_name, service_name_detail) combo printed in Step 1, one row each, with `include=true` for clearly homelessness-related categories (e.g. `Encampment`, `Homeless Outreach`, homelessness-detail variants) and `include=false` with rationale for near-misses (e.g. shopping-cart retrieval if judged not a homelessness proxy — keep judgment, write the rationale). Starter shape (real rows come from Step 1 output):
```csv
case_record_type,service_name,service_name_detail,canon_category,include,rationale
Neighborhood Policing,Encampment,,encampment,true,Direct encampment report category (2018+ era)
,Homeless Outreach,,outreach_request,true,Pre-rename outreach request category (2016-2018 era)
```

- [ ] **Step 3: Write failing tests**

`tests/test_src_c.py`:
```python
import duckdb
import pandas as pd
from commons import db
from commons.staging import src_a, src_c

def test_service_map_covers_and_filters():
    m = pd.read_csv("seeds/gid_service_map.csv")
    assert {"case_record_type","service_name","service_name_detail","canon_category","include","rationale"} <= set(m.columns)
    assert (m["include"] == True).any() and m["rationale"].notna().all()

def test_src_c_load_one_year():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_c.load(con, years=[2024])
    assert res.status == "ok"
    df = con.execute("""SELECT count(*) n,
        sum(CASE WHEN canon_category IS NULL THEN 1 ELSE 0 END) uncat,
        sum(CASE WHEN neighborhood IS NOT NULL THEN 1 ELSE 0 END) downtown,
        sum(CASE WHEN is_child_duplicate THEN 1 ELSE 0 END) dupes
        FROM stg_gid_requests""").fetch_df().iloc[0]
    assert df.n > 1000          # 2024 had tens of thousands of encampment reports
    assert df.uncat == 0        # every kept row categorized
    assert df.downtown > 100    # downtown block assignment works
    assert df.dupes >= 0
    cols = {r[0] for r in con.execute("DESCRIBE stg_gid_requests").fetchall()}
    assert "public_description" not in cols and "street_address" not in cols  # PII guard
```

- [ ] **Step 4: Run, verify fail** — `python3 -m pytest tests/test_src_c.py -v` → ImportError

- [ ] **Step 5: Implement `commons/staging/src_c.py`**

```python
import pandas as pd

from commons import fetch, geo
from commons.config import GID_CLOSED_URL, GID_OPEN_URL, GID_YEARS, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_gid_requests",
    grain="one row per 311 service request (homelessness-related categories only)",
    signal_type="complaint", source_id="C", refresh="daily via refresh.py",
    measures="Resident complaint/report volume about homelessness-related conditions. One request != one person; one encampment can generate many requests.",
    known_bias="Reporting propensity varies by neighborhood and app adoption; categories renamed over years (mapped via seeds/gid_service_map.csv); child duplicates flagged is_child_duplicate and excluded from mart counts.")

KEEP = ["service_request_id", "service_request_parent_id", "date_requested", "date_closed",
        "status", "case_record_type", "service_name", "service_name_detail",
        "case_origin", "lat", "lng", "zipcode", "comm_plan_name"]


def _load_map():
    m = pd.read_csv(SEEDS_DIR / "gid_service_map.csv", dtype=str).fillna("")
    m = m[m["include"].str.lower() == "true"]
    return {(r.case_record_type, r.service_name, r.service_name_detail): r.canon_category
            for r in m.itertuples()}


def load(con, years=None) -> LoadResult:
    years = list(years or GID_YEARS)
    cmap = _load_map()
    frames, fails = [], []
    targets = [(GID_CLOSED_URL.format(year=y), f"src_c/closed_{y}.csv") for y in years]
    targets.append((GID_OPEN_URL, "src_c/open.csv"))
    for url, rel in targets:
        r = fetch.fetch(url, rel)
        if r.status == "failed":
            fails.append(rel); continue
        df = pd.read_csv(r.path, usecols=lambda c: c in KEEP, dtype=str)
        key = list(zip(df["case_record_type"].fillna(""), df["service_name"].fillna(""),
                       df["service_name_detail"].fillna("")))
        df["canon_category"] = [cmap.get(k) for k in key]
        df = df[df["canon_category"].notna()].copy()
        df["source_file"] = rel
        frames.append(df)
    if not frames:
        return LoadResult("failed", 0, f"no 311 files reachable: {fails}")
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates("service_request_id", keep="last")  # open+closed overlap
    df["requested_at"] = pd.to_datetime(df["date_requested"], errors="coerce")
    df["requested_date"] = df["requested_at"].dt.date
    df["obs_month"] = df["requested_at"].dt.to_period("M").dt.to_timestamp().dt.date
    df["closed_date"] = pd.to_datetime(df["date_closed"], errors="coerce").dt.date
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
    df["is_child_duplicate"] = df["service_request_parent_id"].notna() & (df["service_request_parent_id"] != "")
    df = df.rename(columns={"service_request_parent_id": "parent_id", "zipcode": "zip"})
    df = geo.enrich(con, df)
    out_cols = ["service_request_id", "parent_id", "requested_at", "requested_date",
                "obs_month", "closed_date", "status", "case_record_type", "service_name",
                "service_name_detail", "canon_category", "case_origin", "lat", "lng",
                "zip", "comm_plan_name", "geo_block", "h3_r8", "neighborhood",
                "is_child_duplicate", "source_file"]
    con.register("_df", df[out_cols])
    con.execute("CREATE OR REPLACE TABLE stg_gid_requests AS SELECT * FROM _df")
    con.unregister("_df")
    status = "partial" if fails else "ok"
    return LoadResult(status, len(df), f"kept categories={sorted(set(df.canon_category))}; failed files={fails}")
```

- [ ] **Step 6: Run tests, verify pass** — `python3 -m pytest tests/test_src_c.py -v`
- [ ] **Step 7: Wire into run.py** (STEPS order now: src_a, src_c) and run `python3 run.py` — expect both `[ok]`. Full C load across all years may take minutes; acceptable.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: 311 staging with service-name mapping across renames, geo enrichment, PII excluded"`

**Exit criteria:**
1. `seeds/gid_service_map.csv` contains ONLY category values that actually appear in the data (from Step 1 enumeration), each with include flag + rationale.
2. Tests green, incl. PII guard (no public_description/street_address columns) and downtown assignment >100 rows for 2024.
3. Full run loads all years 2016→current; `SELECT min(obs_month), max(obs_month) FROM stg_gid_requests` spans 2016 → current year.
4. `load(con, years=[...])` works for a subset (refresh.py contract).

---

### Task 6: Source D — 72-hr violations + parking citations

**Files:**
- Create: `commons/staging/src_d.py`, `seeds/violation_codes.csv`, `tests/test_src_d.py`
- Modify: `run.py` (append D step after C)

**Interfaces:**
- Consumes: `fetch`, `geo.enrich`.
- Produces: `stg_violations_72hr(service_request_id TEXT, requested_at TIMESTAMP, requested_date DATE, obs_month DATE, closed_date DATE, status TEXT, lat DOUBLE, lng DOUBLE, zip TEXT, comm_plan_name TEXT, geo_block TEXT, h3_r8 TEXT, neighborhood TEXT, source_file TEXT)`; `stg_citations(citation_id TEXT, issue_date DATE, obs_month DATE, vio_code TEXT, vio_desc TEXT, fine DOUBLE, code_category TEXT, location_text TEXT, sector TEXT, geo_block TEXT, h3_r8 TEXT, neighborhood TEXT, zip TEXT, source_file TEXT)` — citation geo columns always NULL (no coords in source; keep columns for schema uniformity, document).
- Functions: `src_d.load_72hr(con) -> LoadResult`, `src_d.load_citations(con, years=None) -> LoadResult`.
- Seed: `seeds/violation_codes.csv` header `vio_code,code_category,interpretation,fine_schedule_note,source_url`.

- [ ] **Step 1: Enumerate real citation codes (exploration)**

```bash
python3 - <<'EOF'
import duckdb
from commons import fetch
from commons.config import CITATIONS_URL, CITATION_YEARS
con = duckdb.connect()
paths = []
for y in CITATION_YEARS:
    for p in (1, 2):
        r = fetch.fetch(CITATIONS_URL.format(year=y, part=p), f"src_d/citations_{y}_p{p}.csv")
        if r.status != "failed": paths.append(str(r.path))
df = con.execute(f"""
  SELECT vio_code, vio_desc, count(*) n, min(date_issue) d0, max(date_issue) d1
  FROM read_csv_auto({paths!r}, union_by_name=true, all_varchar=true)
  WHERE lower(vio_desc) SIMILAR TO '.*(oversize|72|habitat|recreational|rv |camper|abandon|living|lodg).*'
  GROUP BY 1,2 ORDER BY n DESC
""").fetch_df()
print(df.to_string())
EOF
```
This warms the citations cache (large; several minutes). Record printed codes.

- [ ] **Step 2: Fetch the fine-schedule PDF citation**

Find the current City of San Diego parking fine schedule PDF (search sandiego.gov for "parking fine schedule PDF"; verify the URL resolves with `curl -sI`). Put that URL in every seed row's `source_url`. If unreachable tonight, use the dataset page `https://data.sandiego.gov/datasets/parking-citations/` as source_url and note it in the seed's `fine_schedule_note`.

- [ ] **Step 3: Write `seeds/violation_codes.csv`**

One row per code found in Step 1 that maps to the three target families (oversize-vehicle, 72-hour, habitation-adjacent). Include your interpretation per code. Expected families (verify codes against Step 1 output; do not invent codes not present in data):
```csv
vio_code,code_category,interpretation,fine_schedule_note,source_url
<real code>,oversize_vehicle,"SDMC 86.0139 oversized/RV vehicle parking restriction (2-6am ban) - proxy for vehicle dwelling",<fine>,<pdf url>
<real code>,72_hour,"CVC/SDMC 72-hour parking limit violation - proxy for stationary/lived-in vehicles",<fine>,<pdf url>
<real code>,habitation_adjacent,"Vehicle habitation / illegal lodging adjacent code",<fine>,<pdf url>
```

- [ ] **Step 4: Write failing tests**

`tests/test_src_d.py`:
```python
import duckdb
import pandas as pd
from commons import db
from commons.staging import src_a, src_d

def test_violation_codes_seed():
    m = pd.read_csv("seeds/violation_codes.csv")
    assert set(m.code_category) <= {"oversize_vehicle", "72_hour", "habitation_adjacent"}
    assert m.vio_code.notna().all() and m.interpretation.notna().all() and m.source_url.notna().all()

def test_72hr_load():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_d.load_72hr(con)
    assert res.status == "ok"
    n, downtown = con.execute(
        "SELECT count(*), count(neighborhood) FROM stg_violations_72hr").fetchone()
    assert n > 10000 and downtown > 0

def test_citations_load_one_year():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_d.load_citations(con, years=[2024])
    assert res.status == "ok"
    df = con.execute("""SELECT count(*) n, count(geo_block) geo,
        count(DISTINCT code_category) cats FROM stg_citations""").fetch_df().iloc[0]
    assert df.n > 0 and df.geo == 0 and df.cats >= 1  # geo intentionally NULL
```

- [ ] **Step 5: Run, verify fail** — `python3 -m pytest tests/test_src_d.py -v` → ImportError

- [ ] **Step 6: Implement `commons/staging/src_d.py`**

```python
import pandas as pd

from commons import fetch, geo
from commons.config import V72_URL, CITATIONS_URL, CITATION_YEARS, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_violations_72hr", grain="one row per 72-hour-violation 311 report",
    signal_type="enforcement", source_id="D", refresh="daily via refresh.py",
    measures="Reports of vehicles parked >72 hours - proxy for stationary/possibly lived-in vehicles AND for neighbor complaint pressure.",
    known_bias="Complaint-driven, not patrol census; most reported vehicles are not dwellings. Never interpret as vehicle-dwelling count.")
register_table("stg_citations", grain="one row per parking citation under selected codes",
    signal_type="enforcement", source_id="D", refresh="annual files via refresh.py",
    measures="Citations under oversize-vehicle/72-hour/habitation-adjacent codes (see seeds/violation_codes.csv). Measures enforcement output.",
    known_bias="No coordinates in source - geo columns NULL, citywide analysis only. Volume tracks enforcement policy as much as underlying behavior.")


def load_72hr(con) -> LoadResult:
    r = fetch.fetch(V72_URL, "src_d/violations_72hr.csv")
    if r.status == "failed":
        return LoadResult("failed", 0, "72hr csv unreachable")
    df = pd.read_csv(r.path, dtype=str)
    df["requested_at"] = pd.to_datetime(df["date_requested"], errors="coerce")
    df["requested_date"] = df["requested_at"].dt.date
    df["obs_month"] = df["requested_at"].dt.to_period("M").dt.to_timestamp().dt.date
    df["closed_date"] = pd.to_datetime(df["date_closed"], errors="coerce").dt.date
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
    df = df.rename(columns={"zipcode": "zip"})
    df["source_file"] = "src_d/violations_72hr.csv"
    df = geo.enrich(con, df)
    cols = ["service_request_id", "requested_at", "requested_date", "obs_month",
            "closed_date", "status", "lat", "lng", "zip", "comm_plan_name",
            "geo_block", "h3_r8", "neighborhood", "source_file"]
    con.register("_df", df[cols])
    con.execute("CREATE OR REPLACE TABLE stg_violations_72hr AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")


def load_citations(con, years=None) -> LoadResult:
    years = list(years or CITATION_YEARS)
    codes = pd.read_csv(SEEDS_DIR / "violation_codes.csv", dtype=str)
    cmap = dict(zip(codes["vio_code"], codes["code_category"]))
    frames, fails = [], []
    for y in years:
        for p in (1, 2):
            rel = f"src_d/citations_{y}_p{p}.csv"
            r = fetch.fetch(CITATIONS_URL.format(year=y, part=p), rel)
            if r.status == "failed":
                fails.append(rel); continue
            df = pd.read_csv(r.path, dtype=str)
            df = df[df["vio_code"].isin(cmap)].copy()
            df["source_file"] = rel
            frames.append(df)
    if not frames:
        return LoadResult("failed", 0, f"no citation files reachable: {fails}")
    df = pd.concat(frames, ignore_index=True).drop_duplicates("citation_id")
    df["issue_date"] = pd.to_datetime(df["date_issue"], errors="coerce").dt.date
    df["obs_month"] = pd.to_datetime(df["date_issue"], errors="coerce").dt.to_period("M").dt.to_timestamp().dt.date
    df["fine"] = pd.to_numeric(df["vio_fine"], errors="coerce")
    df["code_category"] = df["vio_code"].map(cmap)
    df = df.rename(columns={"location": "location_text", "sector1": "sector"})
    for c in ("geo_block", "h3_r8", "neighborhood", "zip"):
        df[c] = pd.NA  # no coordinates in source; documented
    cols = ["citation_id", "issue_date", "obs_month", "vio_code", "vio_desc", "fine",
            "code_category", "location_text", "sector", "geo_block", "h3_r8",
            "neighborhood", "zip", "source_file"]
    con.register("_df", df[cols])
    con.execute("CREATE OR REPLACE TABLE stg_citations AS SELECT * FROM _df")
    con.unregister("_df")
    status = "partial" if fails else "ok"
    return LoadResult(status, len(df), f"failed files={fails}")
```

- [ ] **Step 7: Run tests, verify pass**; wire both steps into run.py after C; `python3 run.py`.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: enforcement staging - 72hr violations + coded parking citations with documented code map"`

**Exit criteria:**
1. `seeds/violation_codes.csv` contains only codes that appear in the real data, each with interpretation + source_url (fine schedule PDF or documented fallback).
2. Tests green: 72hr rows >10k with some downtown assignments; citations rows >0 with geo all-NULL by design.
3. Full run loads citations 2014→current fail-soft (missing years recorded, not fatal).

---

### Task 7: Source B — DSDP monthly totals (PDF parser + manual seed)

**Files:**
- Create: `commons/staging/src_b.py`, `seeds/dsdp_manual.csv`, `tests/test_src_b.py`
- Modify: `run.py`

**Interfaces:**
- Produces: `stg_dsdp_monthly(obs_month DATE, neighborhood TEXT NULL, total INT, source_url TEXT, method TEXT)` where method ∈ {'pdf_parsed','manual_seed'}; `src_b.load(con) -> LoadResult` (status `stubbed` if only seed rows loaded).
- PDF path convention: any PDFs manually dropped in `raw/dsdp_pdfs/*.pdf` get parsed by pdfplumber; absent PDFs → seed only.

- [ ] **Step 1: Research real DSDP monthly numbers (30 min timebox)**

Web-search for Downtown San Diego Partnership monthly homelessness count numbers (their "monthly count" press pages, Inside San Diego articles, Voice of San Diego, Axios San Diego). Collect at least 8 month-total pairs spanning 2019–present, each with the URL it came from. Prefer months that overlap 311 coverage. Record downtown-wide totals (neighborhood empty) unless a source gives per-neighborhood numbers.

- [ ] **Step 2: Write `seeds/dsdp_manual.csv`**

```csv
obs_month,neighborhood,total,source_url,note
2023-05-01,,2210,<url found in step 1>,<quote/context>
...
```
(Real rows from Step 1. If research yields nothing tonight, seed may be small — but the 2018-01→2019-04 bridge already exists in `stg_a_neighborhood_totals`, so correlations still have overlap.)

- [ ] **Step 3: Write failing test**

`tests/test_src_b.py`:
```python
import duckdb
import pandas as pd
from commons import db
from commons.staging import src_b

def test_seed_schema_and_load():
    m = pd.read_csv("seeds/dsdp_manual.csv")
    assert {"obs_month", "neighborhood", "total", "source_url"} <= set(m.columns)
    assert m.source_url.notna().all()
    con = duckdb.connect(); db.ensure_schema(con)
    res = src_b.load(con)
    assert res.status in ("ok", "stubbed")
    n = con.execute("SELECT count(*) FROM stg_dsdp_monthly").fetchone()[0]
    assert n == len(m)  # no PDFs present -> exactly the seed rows
    assert con.execute("SELECT count(*) FROM stg_dsdp_monthly WHERE method='manual_seed'").fetchone()[0] == n
```

- [ ] **Step 4: Run, verify fail**, then implement `commons/staging/src_b.py`:

```python
import re
from pathlib import Path

import pandas as pd
import pdfplumber

from commons.config import RAW_DIR, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_dsdp_monthly", grain="month x (neighborhood|downtown-wide NULL)",
    signal_type="observation", source_id="B", refresh="monthly (manual PDF drop or seed edit)",
    measures="DSDP-reported monthly unsheltered totals for downtown.",
    known_bias="Post-2017 DSDP methodology may apply occupancy multipliers - levels not directly comparable to source A raw counts. Rows collected from press coverage carry transcription risk (source_url per row).")

MONTHS = {m: i for i, m in enumerate(
    ["january","february","march","april","may","june","july","august",
     "september","october","november","december"], start=1)}


def _parse_pdfs():
    rows = []
    for pdf_path in sorted((RAW_DIR / "dsdp_pdfs").glob("*.pdf")):
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        # pattern: "<Month> <YYYY> ... <total>" - DSDP reports state a single monthly total
        m = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d\d)", text)
        t = re.search(r"([\d,]{3,6})\s+(?:total\s+)?(?:unsheltered|individuals)", text, re.I)
        if m and t:
            month = f"{int(m.group(2))}-{MONTHS[m.group(1).lower()]:02d}-01"
            rows.append(dict(obs_month=month, neighborhood=None,
                             total=int(t.group(1).replace(",", "")),
                             source_url=f"file://{pdf_path.name}", method="pdf_parsed"))
    return pd.DataFrame(rows)


def load(con) -> LoadResult:
    seed = pd.read_csv(SEEDS_DIR / "dsdp_manual.csv", dtype={"neighborhood": str})
    seed["method"] = "manual_seed"
    seed = seed[["obs_month", "neighborhood", "total", "source_url", "method"]]
    parsed = _parse_pdfs()
    df = pd.concat([parsed, seed], ignore_index=True)
    df["obs_month"] = pd.to_datetime(df["obs_month"]).dt.date
    df = df.drop_duplicates(["obs_month", "neighborhood"], keep="first")  # pdf wins over seed
    con.register("_df", df)
    con.execute("CREATE OR REPLACE TABLE stg_dsdp_monthly AS SELECT * FROM _df")
    con.unregister("_df")
    status = "ok" if len(parsed) else "stubbed"
    return LoadResult(status, len(df), f"pdf_rows={len(parsed)} seed_rows={len(seed)}")
```

- [ ] **Step 5: Run tests, verify pass**; wire into run.py; commit — `git add -A && git commit -m "feat: DSDP monthly totals - pdfplumber loader + sourced manual seed"`

**Exit criteria:**
1. Seed has ≥1 row (target ≥8), every row has a real, resolving source_url.
2. `src_b.load` returns `stubbed` when no PDFs present (honest status), `ok` when PDFs parse.
3. Dropping a DSDP PDF into `raw/dsdp_pdfs/` and re-running adds `pdf_parsed` rows without duplicating months.

---

### Task 8: Source F — PIT annual seed

**Files:**
- Create: `commons/staging/src_f.py`, `seeds/pit_annual.csv`, `tests/test_src_f.py`
- Modify: `run.py`

**Interfaces:**
- Produces: `stg_pit_annual(year INT, geography TEXT, sheltered INT, unsheltered INT, total INT, source_url TEXT)`; `src_f.load(con) -> LoadResult`.

- [ ] **Step 1: Collect real PIT numbers (20 min timebox)**

Fetch RTFH published totals (rtfhsd.org PIT pages / WeAllCount reports; HUD CoC dashboards CA-601 as fallback). Collect per year 2016→latest, for geography `san_diego_city` and/or `san_diego_region` — whichever the source states; record which in `geography`. Every row's numbers must be read from a fetched page tonight, not from memory; source_url per row.

- [ ] **Step 2: Write the seed + failing test**

`tests/test_src_f.py`:
```python
import duckdb
import pandas as pd
from commons import db
from commons.staging import src_f

def test_pit_seed_and_load():
    m = pd.read_csv("seeds/pit_annual.csv")
    assert {"year","geography","sheltered","unsheltered","source_url"} <= set(m.columns)
    assert m.year.between(2010, 2026).all() and m.source_url.notna().all()
    con = duckdb.connect(); db.ensure_schema(con)
    res = src_f.load(con)
    assert res.status == "ok"
    tot = con.execute("SELECT total, sheltered+unsheltered FROM stg_pit_annual LIMIT 1").fetchone()
    assert tot[0] == tot[1]  # total is derived, consistent
```

- [ ] **Step 3: Implement `commons/staging/src_f.py`**

```python
import pandas as pd

from commons.config import SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_pit_annual", grain="year x geography", signal_type="observation",
    source_id="F", refresh="annual (edit seed)",
    measures="Annual one-night Point-in-Time sheltered/unsheltered counts (RTFH).",
    known_bias="One night per year; methodology varies by year (2021 partial due to COVID); undercounts hidden homelessness. Region vs city geography noted per row.")


def load(con) -> LoadResult:
    df = pd.read_csv(SEEDS_DIR / "pit_annual.csv")
    df["total"] = df["sheltered"].fillna(0).astype(int) + df["unsheltered"].fillna(0).astype(int)
    con.register("_df", df[["year", "geography", "sheltered", "unsheltered", "total", "source_url"]])
    con.execute("CREATE OR REPLACE TABLE stg_pit_annual AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")
```

- [ ] **Step 4: Tests pass; wire into run.py; commit** — `git add -A && git commit -m "feat: PIT annual counts seed with per-row source URLs"`

**Exit criteria:**
1. Seed covers ≥6 years incl. the most recent published count; each row's source_url fetched and value verified this session.
2. Test green; `total == sheltered + unsheltered` enforced.

---

### Task 9: Source E — shelter capacity (stub + seed)

**Files:**
- Create: `commons/staging/src_e.py`, `seeds/capacity_manual.csv`, `tests/test_src_e.py`
- Modify: `run.py`

**Interfaces:**
- Produces: `stg_capacity_monthly(obs_month DATE, program TEXT, site TEXT, beds INT, occupancy_pct DOUBLE, source_url TEXT, method TEXT)`; `src_e.load(con) -> LoadResult` (mirrors src_b pattern: parses `raw/capacity_pdfs/*.pdf` if present via pdfplumber, else seed-only → `stubbed`).

- [ ] **Step 1: Research (20 min timebox)** — check https://www.sandiego.gov/homelessness-strategies-and-solutions/data-reports for parseable monthly shelter report PDFs/CSVs; grab city bridge-shelter capacity figures (e.g., program name, beds, occupancy %) for ≥6 recent months from whatever is fetchable (city reports, SDHC at-a-glance). Seed rows carry source_url.
- [ ] **Step 2: Write seed + failing test** (same shape as Task 7's test: schema check, load, method='manual_seed' when no PDFs, status in ('ok','stubbed')).
- [ ] **Step 3: Implement `src_e.py`** — copy the src_b structure: `_parse_pdfs()` using pdfplumber `extract_tables()` looking for rows with (program/site, beds, occupancy); seed loader; concat; dedupe on (obs_month, program, site); register_table with measures="Shelter beds and occupancy by program/site" and known_bias="Reporting formats vary by month/provider; occupancy definitions differ; months missing where reports unpublished."
- [ ] **Step 4: Tests pass; wire into run.py; commit** — `git commit -m "feat: shelter capacity staging - pdf stub + sourced seed"`

**Exit criteria:**
1. Seed has ≥6 month-rows with real source URLs; loader honest about `stubbed` status.
2. Test green; re-run idempotent.

---

### Task 10: Source G — weather, rents, events

**Files:**
- Create: `commons/staging/src_g.py`, `seeds/events.csv`, `tests/test_src_g.py`
- Modify: `run.py`

**Interfaces:**
- Produces: `stg_weather_daily(obs_date DATE, tmax_c DOUBLE, tmin_c DOUBLE, prcp_mm DOUBLE, station TEXT)`; `stg_zori_monthly(obs_month DATE, zip TEXT, zori DOUBLE)`; `stg_events(event_date DATE, event_type TEXT, title TEXT, description TEXT, date_certainty TEXT, source_url TEXT)`.
- Functions: `src_g.load_weather(con)`, `src_g.load_zori(con)`, `src_g.load_events(con)` — three separate run.py steps so each fails soft independently.

- [ ] **Step 1: Verify NOAA + ZORI URLs live** (`curl -sI` both; if ZORI filename drifted, browse zillow.com/research/data for the current zip-level ZORI CSV URL and update config).
- [ ] **Step 2: Build `seeds/events.csv`** — research tonight, ≥6 rows, e.g.:

```csv
event_date,event_type,title,description,date_certainty,source_url
2023-06-13,policy,Unsafe Camping Ordinance adopted,City Council adopts camping ban on public property,high,<url>
2023-07-31,policy,Camping ban enforcement begins,SDPD begins enforcement of ordinance,verify,<url>
```
Plus shelter openings/closures and sweep milestones found in research; `date_certainty` ∈ {high, verify}.

- [ ] **Step 3: Write failing tests**

`tests/test_src_g.py`:
```python
import duckdb
import pandas as pd
from commons import db
from commons.staging import src_g

def test_events_seed():
    m = pd.read_csv("seeds/events.csv")
    assert len(m) >= 6 and m.source_url.notna().all()
    assert set(m.date_certainty) <= {"high", "verify"}
    assert (m.title.str.contains("Camping|camping")).any()

def test_weather_and_events_load():
    con = duckdb.connect(); db.ensure_schema(con)
    r = src_g.load_weather(con)
    assert r.status == "ok"
    lo, hi, nulls = con.execute("""SELECT min(obs_date), max(obs_date),
        sum(CASE WHEN tmax_c IS NULL THEN 1 ELSE 0 END) FROM stg_weather_daily""").fetchone()
    assert str(lo) <= "2012-01-05" and str(hi) >= "2026-01-01"
    assert src_g.load_events(con).status == "ok"

def test_zori_load():
    con = duckdb.connect(); db.ensure_schema(con)
    r = src_g.load_zori(con)
    assert r.status == "ok"
    n_zips = con.execute("SELECT count(DISTINCT zip) FROM stg_zori_monthly").fetchone()[0]
    assert n_zips >= 20  # San Diego city has ~30 residential zips
```

- [ ] **Step 4: Implement `commons/staging/src_g.py`**

```python
import datetime as dt

import pandas as pd

from commons import fetch
from commons.config import NOAA_URL, NOAA_STATION, ZORI_URL, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_weather_daily", grain="day", signal_type="context", source_id="G_weather",
    measures="Daily max/min temp (C) and precipitation (mm), San Diego Intl Airport.",
    known_bias="Single coastal station; inland microclimates differ.", refresh="daily (re-fetch)")
register_table("stg_zori_monthly", grain="month x zip", signal_type="context", source_id="G_zori",
    measures="Zillow Observed Rent Index (smoothed typical asking rent) for City of San Diego zips.",
    known_bias="Asking rents only; smoothed; some zips missing early years.", refresh="monthly")
register_table("stg_events", grain="event", signal_type="context", source_id="G_events",
    measures="Hand-curated dated policy/shelter/sweep events with sources.",
    known_bias="Curated selection is itself editorial; rows marked date_certainty=verify need human confirmation.", refresh="manual")


def load_weather(con) -> LoadResult:
    url = NOAA_URL.format(end=dt.date.today().isoformat())
    r = fetch.fetch(url, "src_g/ghcn_daily.csv", force=True)  # date-ranged URL; always refetch
    if r.status == "failed":
        return LoadResult("failed", 0, "NOAA unreachable")
    df = pd.read_csv(r.path)
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.rename(columns={"date": "obs_date", "tmax": "tmax_c", "tmin": "tmin_c", "prcp": "prcp_mm"})
    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.date
    df["station"] = NOAA_STATION
    con.register("_df", df[["obs_date", "tmax_c", "tmin_c", "prcp_mm", "station"]])
    con.execute("CREATE OR REPLACE TABLE stg_weather_daily AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")


def load_zori(con) -> LoadResult:
    r = fetch.fetch(ZORI_URL, "src_g/zori_zip.csv")
    if r.status == "failed":
        return LoadResult("failed", 0, "ZORI unreachable")
    df = pd.read_csv(r.path)
    df = df[(df["State"] == "CA") & (df["City"] == "San Diego")]
    id_cols = [c for c in df.columns if not c[:2].isdigit()]
    long = df.melt(id_vars=id_cols, var_name="obs_month", value_name="zori")
    long["obs_month"] = pd.to_datetime(long["obs_month"]).dt.to_period("M").dt.to_timestamp().dt.date
    long = long.rename(columns={"RegionName": "zip"})
    long = long[long["zori"].notna()][["obs_month", "zip", "zori"]]
    long["zip"] = long["zip"].astype(str)
    con.register("_df", long)
    con.execute("CREATE OR REPLACE TABLE stg_zori_monthly AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(long), "")


def load_events(con) -> LoadResult:
    df = pd.read_csv(SEEDS_DIR / "events.csv")
    df["event_date"] = pd.to_datetime(df["event_date"]).dt.date
    con.register("_df", df)
    con.execute("CREATE OR REPLACE TABLE stg_events AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")
```

- [ ] **Step 5: Tests pass; wire 3 steps into run.py; commit** — `git commit -m "feat: context staging - NOAA weather, ZORI rents, curated policy events"`

**Exit criteria:**
1. Weather spans 2012→near-today; ZORI ≥20 SD zips; events seed ≥6 rows incl. both camping-ban rows with certainty flags.
2. Each of the 3 loaders fails soft independently (unplug test: point ZORI_URL at garbage, run.py still completes with `failed` recorded).

---

### Task 11: Marts + exports

**Files:**
- Create: `commons/marts.py`, `tests/test_marts.py`
- Modify: `run.py` (marts step LAST, always runs even after failures)

**Interfaces:**
- Consumes: all staging tables (any may be absent — use `IF EXISTS` guards via `con.execute("SELECT ... FROM information_schema.tables")` checks).
- Produces tables: `mart_monthly_neighborhood(obs_month, neighborhood, signal_type, metric, value, is_imputed, source_id)`; `mart_monthly_block(obs_month, geo_block, neighborhood, signal_type, metric, value, is_imputed, source_id)`; `mart_daily_downtown(obs_date, neighborhood, signal_type, metric, value, source_id)`; `mart_monthly_context(obs_month, geography, signal_type, metric, value, source_id)`.
- Produces files: `marts/monthly_by_neighborhood.csv` (public), `marts/monthly_by_block.csv`, `marts/daily_downtown.csv` (internal), `marts/blocks.geojson`.
- Functions: `marts.build(con) -> LoadResult`, `marts.export(con) -> LoadResult`.
- Metrics inventory (exact strings): observation: `observed_individuals, observed_structures, observed_vehicles, observed_total_units, dsdp_reported_total`; complaint: `gid_requests`; enforcement: `violations_72hr_reports, citations_selected` (context mart only for citations — no downtown geo); capacity: `shelter_beds, shelter_occupancy_pct`; context: `tmax_c, tmin_c, prcp_mm, zori_median_zip, pit_sheltered, pit_unsheltered`.

- [ ] **Step 1: Write failing tests**

`tests/test_marts.py`:
```python
import duckdb
import pandas as pd
from commons import db, marts
from commons.staging import src_a, src_c

def _built_con():
    con = duckdb.connect(); db.ensure_schema(con)
    src_a.load(con); src_c.load(con, years=[2017])
    marts.build(con)
    return con

def test_signal_types_and_dupes_excluded():
    con = _built_con()
    st = {r[0] for r in con.execute("SELECT DISTINCT signal_type FROM mart_monthly_neighborhood").fetchall()}
    assert st <= {"observation", "complaint", "enforcement", "capacity", "context"} and "observation" in st
    # complaint counts exclude child duplicates
    raw, mart = con.execute("""
      SELECT (SELECT count(*) FROM stg_gid_requests WHERE neighborhood='east_village'
              AND strftime(obs_month,'%Y-%m')='2017-06'),
             (SELECT value FROM mart_monthly_neighborhood WHERE neighborhood='east_village'
              AND metric='gid_requests' AND strftime(obs_month,'%Y-%m')='2017-06')""").fetchone()
    dupes = con.execute("""SELECT count(*) FROM stg_gid_requests WHERE neighborhood='east_village'
      AND strftime(obs_month,'%Y-%m')='2017-06' AND is_child_duplicate""").fetchone()[0]
    assert mart == raw - dupes

def test_observed_total_matches_points():
    con = _built_con()
    pts, mart = con.execute("""
      SELECT (SELECT count(*) FROM stg_a_observations WHERE strftime(obs_month,'%Y-%m')='2016-06'),
             (SELECT sum(value) FROM mart_monthly_neighborhood
              WHERE metric='observed_total_units' AND strftime(obs_month,'%Y-%m')='2016-06')""").fetchone()
    assert pts == mart

def test_exports_public_tier(tmp_path, monkeypatch):
    import commons.marts as m
    monkeypatch.setattr(m, "MARTS_DIR", tmp_path)
    con = _built_con()
    m.export(con)
    pub = pd.read_csv(tmp_path / "monthly_by_neighborhood.csv")
    banned = {"geo_block", "lat", "lng", "h3_r8", "location_text", "public_description", "street_address"}
    assert not (banned & set(pub.columns))
    assert (tmp_path / "blocks.geojson").exists()
    import json
    gj = json.loads((tmp_path / "blocks.geojson").read_text())
    assert gj["type"] == "FeatureCollection" and len(gj["features"]) > 100
```

- [ ] **Step 2: Run, verify fail** → ImportError

- [ ] **Step 3: Implement `commons/marts.py`**

```python
import json

import pandas as pd
from shapely import from_wkt
from shapely.geometry import mapping

from commons.config import MARTS_DIR as _MARTS_DIR
from commons.registry import LoadResult, register_table

MARTS_DIR = _MARTS_DIR

for t, g in [("mart_monthly_neighborhood", "month x downtown neighborhood x metric"),
             ("mart_monthly_block", "month x census block x metric"),
             ("mart_daily_downtown", "day x downtown neighborhood x metric"),
             ("mart_monthly_context", "month x geography x metric")]:
    register_table(t, grain=g, signal_type="mixed (tagged per row)", source_id="A",
        measures="Unified long-format signal mart; see signal_type+metric per row and the staging table docs for each source.",
        known_bias="Inherits each source's bias - JOIN meta_sources via source_id. Complaint/enforcement metrics are activity volumes, never people counts.",
        refresh="rebuilt every run")


def _has(con, table):
    return con.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_name=?", [table]
    ).fetchone()[0] > 0


def build(con) -> LoadResult:
    parts_n, parts_b, parts_d, parts_c = [], [], [], []

    if _has(con, "stg_a_observations"):
        parts_n.append("""
          SELECT obs_month, neighborhood, 'observation' signal_type,
                 'observed_' || CASE entity_type WHEN 'individual' THEN 'individuals'
                    WHEN 'structure' THEN 'structures' ELSE 'vehicles' END metric,
                 count(*)::DOUBLE value, bool_or(is_imputed) is_imputed, 'A' source_id
          FROM stg_a_observations GROUP BY 1,2,4""")
        parts_n.append("""
          SELECT obs_month, neighborhood, 'observation', 'observed_total_units',
                 count(*)::DOUBLE, bool_or(is_imputed), 'A'
          FROM stg_a_observations GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month, geo_block, any_value(neighborhood), 'observation',
                 'observed_total_units', count(*)::DOUBLE, bool_or(is_imputed), 'A'
          FROM stg_a_observations GROUP BY 1,2""")
    if _has(con, "stg_a_neighborhood_totals"):
        parts_n.append("""
          SELECT obs_month, neighborhood, 'observation', 'dsdp_reported_total',
                 total::DOUBLE, false, 'A' FROM stg_a_neighborhood_totals""")
    if _has(con, "stg_dsdp_monthly"):
        parts_n.append("""
          SELECT obs_month, coalesce(neighborhood, '_downtown_all'), 'observation',
                 'dsdp_reported_total', total::DOUBLE, false, 'B' FROM stg_dsdp_monthly""")
    if _has(con, "stg_gid_requests"):
        parts_n.append("""
          SELECT obs_month, neighborhood, 'complaint', 'gid_requests',
                 count(*)::DOUBLE, false, 'C'
          FROM stg_gid_requests WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month, geo_block, any_value(neighborhood), 'complaint', 'gid_requests',
                 count(*)::DOUBLE, false, 'C'
          FROM stg_gid_requests WHERE geo_block IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
        parts_d.append("""
          SELECT requested_date obs_date, neighborhood, 'complaint', 'gid_requests',
                 count(*)::DOUBLE, 'C'
          FROM stg_gid_requests WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
    if _has(con, "stg_violations_72hr"):
        parts_n.append("""
          SELECT obs_month, neighborhood, 'enforcement', 'violations_72hr_reports',
                 count(*)::DOUBLE, false, 'D'
          FROM stg_violations_72hr WHERE neighborhood IS NOT NULL GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month, geo_block, any_value(neighborhood), 'enforcement',
                 'violations_72hr_reports', count(*)::DOUBLE, false, 'D'
          FROM stg_violations_72hr WHERE geo_block IS NOT NULL GROUP BY 1,2""")
        parts_d.append("""
          SELECT requested_date, neighborhood, 'enforcement', 'violations_72hr_reports',
                 count(*)::DOUBLE, 'D'
          FROM stg_violations_72hr WHERE neighborhood IS NOT NULL GROUP BY 1,2""")
    if _has(con, "stg_citations"):
        parts_c.append("""
          SELECT obs_month, 'san_diego_city', 'enforcement',
                 'citations_' || code_category, count(*)::DOUBLE, 'D'
          FROM stg_citations GROUP BY 1,4""")
    if _has(con, "stg_capacity_monthly"):
        parts_c.append("""
          SELECT obs_month, 'san_diego_city', 'capacity', 'shelter_beds',
                 sum(beds)::DOUBLE, 'E' FROM stg_capacity_monthly GROUP BY 1""")
        parts_c.append("""
          SELECT obs_month, 'san_diego_city', 'capacity', 'shelter_occupancy_pct',
                 avg(occupancy_pct), 'E' FROM stg_capacity_monthly GROUP BY 1""")
    if _has(con, "stg_pit_annual"):
        parts_c.append("""
          SELECT make_date(year, 1, 1), geography, 'observation', 'pit_' || k, v::DOUBLE, 'F'
          FROM stg_pit_annual, LATERAL (VALUES ('sheltered', sheltered), ('unsheltered', unsheltered)) t(k, v)""")
    if _has(con, "stg_weather_daily"):
        parts_c.append("""
          SELECT date_trunc('month', obs_date)::DATE, 'san_diego_city', 'context', 'tmax_c_avg',
                 avg(tmax_c), 'G_weather' FROM stg_weather_daily GROUP BY 1""")
        parts_c.append("""
          SELECT date_trunc('month', obs_date)::DATE, 'san_diego_city', 'context', 'prcp_mm_total',
                 sum(prcp_mm), 'G_weather' FROM stg_weather_daily GROUP BY 1""")
        parts_d.append("""
          SELECT obs_date, NULL, 'context', 'tmax_c', tmax_c, 'G_weather' FROM stg_weather_daily""")
        parts_d.append("""
          SELECT obs_date, NULL, 'context', 'prcp_mm', prcp_mm, 'G_weather' FROM stg_weather_daily""")
    if _has(con, "stg_zori_monthly"):
        parts_c.append("""
          SELECT obs_month, 'zip_' || zip, 'context', 'zori', zori, 'G_zori' FROM stg_zori_monthly""")

    def _make(table, cols, parts):
        if parts:
            con.execute(f"CREATE OR REPLACE TABLE {table} AS " + " UNION ALL ".join(f"({p})" for p in parts))
            con.execute(f"ALTER TABLE {table} RENAME TO _tmp_m")
            con.execute(f"CREATE TABLE {table} AS SELECT * FROM _tmp_m")  # normalize col names below
            con.execute("DROP TABLE _tmp_m")
        else:
            con.execute(f"CREATE OR REPLACE TABLE {table} ({cols})")

    # simpler: build with explicit aliases in first SELECT of each union; rename via CTE
    _make("mart_monthly_neighborhood",
          "obs_month DATE, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, is_imputed BOOLEAN, source_id TEXT",
          parts_n)
    _make("mart_monthly_block",
          "obs_month DATE, geo_block TEXT, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, is_imputed BOOLEAN, source_id TEXT",
          parts_b)
    _make("mart_daily_downtown",
          "obs_date DATE, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, source_id TEXT",
          parts_d)
    _make("mart_monthly_context",
          "obs_month DATE, geography TEXT, signal_type TEXT, metric TEXT, value DOUBLE, source_id TEXT",
          parts_c)
    n = sum(con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ["mart_monthly_neighborhood", "mart_monthly_block",
                      "mart_daily_downtown", "mart_monthly_context"])
    return LoadResult("ok", n, "")


def export(con) -> LoadResult:
    MARTS_DIR.mkdir(exist_ok=True)
    con.execute(f"COPY (SELECT * FROM mart_monthly_neighborhood ORDER BY obs_month, neighborhood, metric) TO '{MARTS_DIR}/monthly_by_neighborhood.csv' (HEADER)")
    con.execute(f"COPY (SELECT * FROM mart_monthly_block ORDER BY obs_month, geo_block, metric) TO '{MARTS_DIR}/monthly_by_block.csv' (HEADER)")
    con.execute(f"COPY (SELECT * FROM mart_daily_downtown ORDER BY obs_date, neighborhood, metric) TO '{MARTS_DIR}/daily_downtown.csv' (HEADER)")
    blocks = con.execute("SELECT geo_block, block_name, neighborhood, zip, geometry_wkt FROM dim_blocks").fetch_df()
    features = [{"type": "Feature",
                 "properties": {k: (None if pd.isna(v) else v) for k, v in row.items() if k != "geometry_wkt"},
                 "geometry": mapping(from_wkt(row["geometry_wkt"]))}
                for row in blocks.to_dict("records")]
    (MARTS_DIR / "blocks.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    return LoadResult("ok", len(features), "4 files exported")
```

Note on `_make`: the first implementation pass should give the union-branch SELECTs explicit column aliases matching the target schema (DuckDB takes column names from the first branch) and drop the rename dance — the code above shows intent; simplify to a single `CREATE OR REPLACE TABLE {table} AS <union>` once aliases are consistent. The test suite is the arbiter.

- [ ] **Step 4: Run tests, verify pass** — `python3 -m pytest tests/test_marts.py -v`
- [ ] **Step 5: Wire `("build_marts", None, marts.build)` and `("export_marts", None, marts.export)` as the final STEPS; `python3 run.py`; inspect `marts/` outputs by hand (open CSV heads).**
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: unified signal marts + tiered exports (public=neighborhood grain only)"`

**Exit criteria:**
1. Tests green: mart totals reconcile with staging counts; child duplicates excluded; public CSV contains no block/coordinate/free-text columns; blocks.geojson valid FeatureCollection >100 features.
2. All 4 export files exist after `python3 run.py`; `mart_monthly_neighborhood` contains ≥3 distinct signal_types on a full build.
3. Marts build succeeds even when some staging tables are absent (guarded by `_has`).

---

### Task 12: DATA_DICTIONARY.md generator

**Files:**
- Create: `commons/docs_gen.py`, `tests/test_docs_gen.py`
- Modify: `run.py`

**Interfaces:**
- Consumes: `registry.TABLE_DOCS`, `registry.SOURCES`, DB `information_schema.columns`, `meta_sources` load status.
- Produces: `docs_gen.write_data_dictionary(con, path=ROOT/'DATA_DICTIONARY.md') -> LoadResult`; file with: header + bias philosophy paragraph, per-source lineage table (name, url, signal, cadence, last status), then per-table section: grain, source, refresh, **Measures**, **Known bias**, column list (name, type) from information_schema.

- [ ] **Step 1: Write failing test**

`tests/test_docs_gen.py`:
```python
import duckdb
from commons import db, docs_gen
from commons.staging import src_a

def test_dictionary_contents(tmp_path):
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    out = tmp_path / "DATA_DICTIONARY.md"
    res = docs_gen.write_data_dictionary(con, out)
    assert res.status == "ok"
    txt = out.read_text()
    assert "stg_a_observations" in txt and "Known bias" in txt
    assert "does NOT apply multipliers" in txt      # A's multiplier caveat present
    assert "NOT people" in txt or "not people" in txt.lower()  # complaint framing
    for t in ("dim_blocks", "stg_a_monthly_totals"):
        assert f"### `{t}`" in txt
```

- [ ] **Step 2: Implement `commons/docs_gen.py`**

```python
import datetime as dt

from commons.config import ROOT
from commons.registry import LoadResult, TABLE_DOCS, SOURCES

PREAMBLE = """# Data Dictionary - SD Homelessness Data Commons

Auto-generated by the pipeline. Do not edit by hand.

**Read this first:** every table here is a *signal with known biases*, not a census.
Complaint (311) and enforcement tables measure reporting and enforcement activity -
they are NOT counts of people experiencing homelessness and must never be presented
as such. Each table's **Known bias** section is part of the data.
"""

def write_data_dictionary(con, path=ROOT / "DATA_DICTIONARY.md") -> LoadResult:
    lines = [PREAMBLE, f"_Generated {dt.datetime.now():%Y-%m-%d %H:%M}_\n", "## Sources\n",
             "| id | source | signal | cadence | last load |", "|---|---|---|---|---|"]
    for sid, s in SOURCES.items():
        st = con.execute("SELECT load_status FROM meta_sources WHERE source_id=?", [sid]).fetchone()
        lines.append(f"| {sid} | [{s['name']}]({s['url']}) | {s['signal_type']} | {s['refresh_cadence']} | {st[0] if st and st[0] else 'n/a'} |")
    lines.append("\n## Tables\n")
    existing = {r[0] for r in con.execute("SELECT table_name FROM information_schema.tables").fetchall()}
    for t, doc in sorted(TABLE_DOCS.items()):
        if t not in existing:
            continue
        lines += [f"### `{t}`\n",
                  f"- **Grain:** {doc['grain']}",
                  f"- **Signal type:** {doc['signal_type']}  |  **Source:** {doc['source_id']} ({doc['source_url']})",
                  f"- **Refresh:** {doc['refresh']}",
                  f"- **Measures:** {doc['measures']}",
                  f"- **Known bias:** {doc['known_bias']}\n",
                  "| column | type |", "|---|---|"]
        cols = con.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name=? ORDER BY ordinal_position",
            [t]).fetchall()
        lines += [f"| {c} | {ty} |" for c, ty in cols]
        lines.append("")
    path.write_text("\n".join(lines))
    return LoadResult("ok", len([t for t in TABLE_DOCS if t in existing]), str(path))
```

- [ ] **Step 3: Tests pass; wire into run.py after marts; run full `python3 run.py`; read generated DATA_DICTIONARY.md top to bottom once for language quality.**
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: auto-generated data dictionary with lineage + bias language"`

**Exit criteria:**
1. Test green; generated file lists every existing registered table with columns, grain, measures, known_bias.
2. The multiplier caveat (A) and "not people counts" framing (C/D) appear verbatim in the output.

---

### Task 13: QA report + validation correlations

**Files:**
- Create: `commons/qa.py`, `tests/test_qa.py`
- Modify: `run.py` (QA is the very last step; receives the run's results dict)

**Interfaces:**
- Consumes: all tables; `results: dict[str, LoadResult]` from run_steps.
- Produces: `qa.write_qa_report(con, results, path=ROOT/'QA_REPORT.md') -> LoadResult`; helper `qa.pearson(df, xcol, ycol) -> tuple[float, int]` (r, n) using pandas `.corr`.
- Report sections: 1) run summary table (step, status, rows, note); 2) per-table row counts + min/max date; 3) data quality: % NULL lat/lng in 311, % of downtown-plausible 311 rows assigned a block, dedupe stats (child duplicates count/%, cross-file id dupes removed); 4) source gaps (any non-ok statuses, in priority order); 5) validation correlations with r, n, and a one-line honest interpretation each.

- [ ] **Step 1: Write failing tests**

`tests/test_qa.py`:
```python
import duckdb
import pandas as pd
from commons import db, qa
from commons.registry import LoadResult

def test_pearson():
    df = pd.DataFrame({"x": [1, 2, 3, 4], "y": [2, 4, 6, 8]})
    r, n = qa.pearson(df, "x", "y")
    assert abs(r - 1.0) < 1e-9 and n == 4
    r2, n2 = qa.pearson(pd.DataFrame({"x": [1], "y": [2]}), "x", "y")
    assert n2 == 1 and r2 != r2  # nan for insufficient pairs

def test_report_written_with_gaps(tmp_path):
    con = duckdb.connect(); db.ensure_schema(con)
    results = {"load_src_c": LoadResult("failed", 0, "network down")}
    out = tmp_path / "QA_REPORT.md"
    res = qa.write_qa_report(con, results, out)
    assert res.status == "ok"
    txt = out.read_text()
    assert "network down" in txt and "Correlation" in txt
    assert "insufficient overlapping data" in txt  # honest when sources missing
```

- [ ] **Step 2: Implement `commons/qa.py`**

```python
import datetime as dt

import pandas as pd

from commons.config import ROOT
from commons.registry import LoadResult


def pearson(df: pd.DataFrame, xcol: str, ycol: str):
    d = df[[xcol, ycol]].dropna()
    if len(d) < 2:
        return float("nan"), len(d)
    return float(d[xcol].corr(d[ycol])), len(d)


def _has(con, t):
    return con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name=?", [t]).fetchone()[0] > 0


def _corr_311_vs_dsdp(con):
    """(i) monthly downtown 311 volume vs observed/reported downtown totals, overlapping months."""
    if not (_has(con, "stg_gid_requests") and (_has(con, "stg_a_neighborhood_totals") or _has(con, "stg_dsdp_monthly"))):
        return None
    obs_parts = []
    if _has(con, "stg_a_neighborhood_totals"):
        obs_parts.append("SELECT obs_month, sum(total) t FROM stg_a_neighborhood_totals GROUP BY 1")
    if _has(con, "stg_dsdp_monthly"):
        obs_parts.append("SELECT obs_month, sum(total) t FROM stg_dsdp_monthly GROUP BY 1")
    df = con.execute(f"""
      WITH obs AS (SELECT obs_month, max(t) t FROM ({' UNION ALL '.join(obs_parts)}) GROUP BY 1),
      gid AS (SELECT obs_month, count(*) g FROM stg_gid_requests
              WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate GROUP BY 1)
      SELECT obs.t, gid.g FROM obs JOIN gid USING (obs_month)""").fetch_df()
    return pearson(df, "t", "g")


def _corr_311_vs_blocks(con):
    """(ii) block-month grain: 311 vs 2014-18 counted units."""
    if not (_has(con, "stg_gid_requests") and _has(con, "stg_a_observations")):
        return None
    df = con.execute("""
      WITH a AS (SELECT obs_month, geo_block, count(*) units FROM stg_a_observations GROUP BY 1,2),
      g AS (SELECT obs_month, geo_block, count(*) reqs FROM stg_gid_requests
            WHERE geo_block IS NOT NULL AND NOT is_child_duplicate GROUP BY 1,2)
      SELECT units, reqs FROM a JOIN g USING (obs_month, geo_block)""").fetch_df()
    return pearson(df, "units", "reqs")


def _corr_citations(con):
    """(iii) monthly selected-citation volume vs downtown observed AND vs 311."""
    out = {}
    if _has(con, "stg_citations"):
        cit = "SELECT obs_month, count(*) c FROM stg_citations GROUP BY 1"
        if _has(con, "stg_a_monthly_totals"):
            df = con.execute(f"""SELECT t.total, c.c FROM stg_a_monthly_totals t
                JOIN ({cit}) c USING (obs_month)""").fetch_df()
            out["citations_vs_downtown_observed"] = pearson(df, "total", "c")
        if _has(con, "stg_gid_requests"):
            df = con.execute(f"""
              WITH g AS (SELECT obs_month, count(*) g FROM stg_gid_requests
                         WHERE NOT is_child_duplicate GROUP BY 1)
              SELECT g.g, c.c FROM g JOIN ({cit}) c USING (obs_month)""").fetch_df()
            out["citations_vs_311"] = pearson(df, "g", "c")
    return out


def _fmt(name, res, interp):
    if res is None:
        return f"- **{name}**: insufficient overlapping data (a source failed or has no overlap).\n"
    r, n = res
    if n < 3 or r != r:
        return f"- **{name}**: insufficient overlapping data (n={n}).\n"
    return f"- **{name}**: r = {r:.3f} (n={n} pairs). {interp(r)}\n"


def write_qa_report(con, results, path=ROOT / "QA_REPORT.md") -> LoadResult:
    L = [f"# QA Report - generated {dt.datetime.now():%Y-%m-%d %H:%M}\n", "## Run summary\n",
         "| step | status | rows | note |", "|---|---|---|---|"]
    for name, r in results.items():
        L.append(f"| {name} | {r.status} | {r.rows} | {(r.note or '').splitlines()[0][:120]} |")
    gaps = [n for n, r in results.items() if r.status in ("failed", "stubbed", "partial")]
    L.append("\n## Source gaps\n")
    L.append("None - all steps ok.\n" if not gaps else
             "\n".join(f"- `{n}`: {results[n].status} - {(results[n].note or '').splitlines()[0][:200]}" for n in gaps) + "\n")

    L.append("## Table inventory\n\n| table | rows | min date | max date |\n|---|---|---|---|")
    for (t,) in con.execute("""SELECT table_name FROM information_schema.tables
                               WHERE table_name LIKE 'stg%' OR table_name LIKE 'mart%' OR table_name LIKE 'dim%'
                               ORDER BY 1""").fetchall():
        datecol = next((c for c, in con.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=? AND column_name IN ('obs_month','obs_date','requested_date','issue_date','event_date') ORDER BY 1 LIMIT 1",
            [t]).fetchall()), None)
        n = con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        if datecol:
            lo, hi = con.execute(f"SELECT min({datecol}), max({datecol}) FROM {t}").fetchone()
        else:
            lo = hi = ""
        L.append(f"| {t} | {n} | {lo} | {hi} |")

    L.append("\n## Data quality\n")
    if _has(con, "stg_gid_requests"):
        q = con.execute("""SELECT count(*) n,
              round(100.0*sum(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END)/count(*),1) pct_no_coords,
              round(100.0*sum(CASE WHEN is_child_duplicate THEN 1 ELSE 0 END)/count(*),1) pct_child_dupes,
              round(100.0*count(geo_block)/count(*),2) pct_downtown_block
              FROM stg_gid_requests""").fetch_df().iloc[0]
        L.append(f"- 311: {int(q.n)} rows; {q.pct_no_coords}% missing coords (geocode failures); "
                 f"{q.pct_child_dupes}% flagged child duplicates (excluded from marts); "
                 f"{q.pct_downtown_block}% fall in downtown blocks (rest are citywide - expected).")
    if _has(con, "stg_citations"):
        L.append("- Citations: source has no coordinates; geo columns intentionally NULL (citywide analysis only).")
    if _has(con, "stg_a_observations"):
        imp = con.execute("SELECT count(*) FROM stg_a_observations WHERE is_imputed").fetchone()[0]
        L.append(f"- Source A: {imp} rows from imputed months (flagged is_imputed).")

    L.append("\n## Validation: do independent signals agree?\n")
    L.append(_fmt("(i) 311 downtown volume vs DSDP/observed downtown totals (monthly)", _corr_311_vs_dsdp(con),
        lambda r: "Complaints track observed street population direction" + (" strongly" if r > .6 else " only loosely" if r > .3 else " weakly - complaint volume is NOT a proxy for people") + ". Correlation of volumes, not a people count."))
    L.append(_fmt("(ii) 311 vs counted units at block-month grain (2016-2018 overlap)", _corr_311_vs_blocks(con),
        lambda r: "Block-level agreement is " + ("strong" if r > .6 else "moderate" if r > .3 else "weak") + " - fine-grained complaint data locates hotspots" + ("" if r > .3 else " poorly") + "."))
    for name, res in _corr_citations(con).items():
        L.append(_fmt(f"(iii) {name} (monthly, citations are citywide)", res,
            lambda r: "Enforcement volume reflects policy/patrol priorities as much as street population; treat as pressure signal, not headcount."))
    path.write_text("\n".join(L))
    return LoadResult("ok", 0, str(path))
```

- [ ] **Step 3: Tests pass; wire as final run.py step (`("qa_report", None, lambda con: qa.write_qa_report(con, results))` — run.py collects `results` from run_steps then calls QA + docs explicitly after, since QA needs the results dict); run full `python3 run.py`; READ the generated QA_REPORT.md and sanity-check the r values (expect (i) positive, (ii) positive but weaker, (iii) ambiguous).**
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: QA report with coverage, quality metrics, and cross-signal validation correlations"`

**Exit criteria:**
1. Tests green (perfect-corr synthetic → r=1; missing sources → "insufficient overlapping data", not a crash).
2. Full-build QA_REPORT.md shows: every step's status, per-table counts+coverage, 311 null/geocode/dupe rates, and three correlation lines with r and n printed.
3. Interpretation lines never equate complaints/enforcement with people counts.

---

### Task 14: run.py finalization, refresh.py, README, full clean rebuild

**Files:**
- Create: `refresh.py`
- Modify: `run.py` (final form), `README.md` (full)

**Interfaces:**
- Consumes: everything.
- Produces: final `run.py` (below) and `refresh.py` that refreshes ONLY C and D then rebuilds marts/docs/QA.

- [ ] **Step 1: Finalize `run.py`**

```python
"""Full rebuild: python run.py
Step order note: src_a runs before src_c because geo enrichment needs dim_blocks;
the spec's C-first priority governs effort/download importance, and A is small+static.
"""
from commons import db, marts, docs_gen, qa
from commons.staging import src_a, src_b, src_c, src_d, src_e, src_f, src_g

STEPS = [
    ("load_src_a", "A", src_a.load),
    ("load_src_c_311", "C", src_c.load),
    ("load_src_d_72hr", "D", src_d.load_72hr),
    ("load_src_d_citations", "D", src_d.load_citations),
    ("load_src_b_dsdp", "B", src_b.load),
    ("load_src_f_pit", "F", src_f.load),
    ("load_src_e_capacity", "E", src_e.load),
    ("load_src_g_weather", "G_weather", src_g.load_weather),
    ("load_src_g_zori", "G_zori", src_g.load_zori),
    ("load_src_g_events", "G_events", src_g.load_events),
    ("build_marts", None, marts.build),
    ("export_marts", None, marts.export),
]

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    results["data_dictionary"] = docs_gen.write_data_dictionary(con)
    results["qa_report"] = qa.write_qa_report(con, results)
    print("\nDone. See QA_REPORT.md and DATA_DICTIONARY.md")
    return results

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write `refresh.py`**

```python
"""Incremental refresh of auto-updating layers only (311 + enforcement),
then rebuild marts, dictionary, and QA. Other sources keep their last load."""
import datetime as dt

from commons import db, marts, docs_gen, qa
from commons.staging import src_c, src_d

def main():
    con = db.connect()
    db.ensure_schema(con)
    year = dt.date.today().year
    steps = [
        # conditional GET makes unchanged year-files free; current year + open file actually refresh
        ("refresh_311", "C", lambda c: src_c.load(c)),
        ("refresh_72hr", "D", src_d.load_72hr),
        ("refresh_citations", "D", lambda c: src_d.load_citations(c)),
        ("build_marts", None, marts.build),
        ("export_marts", None, marts.export),
    ]
    results = db.run_steps(con, steps)
    results["data_dictionary"] = docs_gen.write_data_dictionary(con)
    results["qa_report"] = qa.write_qa_report(con, results)

if __name__ == "__main__":
    main()
```
(Design note: `src_c.load`/`load_citations` re-scan all year files, but conditional GET returns `cached` for frozen prior years, so only the current-year and `open` files transfer — this is the "incremental" contract, kept simple and correct.)

- [ ] **Step 3: Full clean rebuild test**

```bash
rm -f commons.duckdb && python3 run.py && python3 -m pytest -q && python3 refresh.py
```
Expected: run.py completes with marts + both .md files regenerated; all tests pass; refresh.py completes quickly (all cached except open/current-year files).

- [ ] **Step 4: Finalize README.md** — full run instructions (venv, pip install, run.py, refresh.py), output inventory (commons.duckdb, marts/ files with public/internal tier explanation), the signals-not-census principle paragraph, seeds/ documentation (what each seed is, how to update it), and known limitations (citations not geocoded; DSDP multiplier comparability; imputed months).
- [ ] **Step 5: Final commit** — `git add -A && git commit -m "feat: refresh pipeline, final orchestrator, README"`

**Exit criteria (project-level acceptance):**
1. `rm -f commons.duckdb && python3 run.py` succeeds end-to-end; second consecutive run is fast (cache hits) and produces identical mart row counts.
2. `python3 refresh.py` touches only C/D raw files (verify via `raw/_manifest.json` fetched_at timestamps) and rebuilds marts/docs.
3. `python3 -m pytest -q` fully green.
4. All 5 spec outputs exist: `commons.duckdb`, 4 files in `marts/`, `DATA_DICTIONARY.md`, `QA_REPORT.md`, `refresh.py`.
5. QA_REPORT contains three correlation results (or honest insufficient-data lines) with interpretations.
6. `grep -ri "public_description\|street_address" commons/ --include='*.py'` shows they are only ever excluded, never selected into tables; public CSV has no block/coord columns.
7. `git log --oneline` shows ≥12 commits telling the build story.

---

## Self-review notes (completed at plan time)

- **Spec coverage check:** A→Task 3; B→Task 7; C→Task 5; D→Task 6; E→Task 9; F→Task 8; G→Task 10; harmonization→Tasks 3/4 (grid) + marts (time/layer tags); outputs 1-2→Task 11; output 3→Task 12; output 4→Task 13; output 5→Task 14; engineering reqs→Tasks 0-2 (deps/cache/fail-soft), PII guard→Tasks 5/11 tests; commit cadence→every task.
- **Known simplifications (documented, deliberate):** citations not geocoded (source has no coords); zip for downtown = 92101 constant; H3-r8 columns populated on point tables but marts roll up to block/neighborhood (H3 marts are a stretch goal, not required by spec's outputs); refresh.py incrementality via conditional GET rather than delta parsing.
- **Risk register:** metatab server is http:// and occasionally slow — cache after first fetch mitigates; DSDP/SDHC PDFs may be unfetchable tonight — stub+seed path is first-class; ZORI filename drifts — Task 10 Step 1 verifies before coding against it.
