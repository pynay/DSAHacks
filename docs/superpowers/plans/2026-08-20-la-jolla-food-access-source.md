# La Jolla Food Access (Source I) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real USDA Food Access Research Atlas (FARA) food-insecurity data for the La Jolla area to the commons pipeline as a new, purely additive, seed-backed Source `I`.

**Architecture:** A one-off builder script extracts La Jolla census-tract rows from the real FARA 2010/2015/2019 files into a committed seed CSV. A new staging module (`src_i.py`, modeled on `src_f.py`) reads the seed, melts it to long form, and precomputes a `la_jolla` rollup. The rows surface into the existing `mart_monthly_context` (free-text `geography` column) — never touching the downtown block grid, `geo.enrich`, or the three downtown marts.

**Tech Stack:** Python 3, pandas, DuckDB, pytest. FARA XLSX read via `openpyxl`. No new runtime services.

## Global Constraints

- **Real data only.** Seed values come from the real FARA files and a real Census tract↔ZIP crosswalk. Never fabricate tract IDs or metric values. Where a FARA field is absent for a vintage, write blank (NULL) + a `note`, never `0`.
- **Additive only.** Do not modify `config.DOWNTOWN_NEIGHBORHOODS`, `geo.py`, `dim_blocks`, `src_a`, or the three downtown marts (`mart_monthly_neighborhood`, `mart_monthly_block`, `mart_daily_downtown`).
- **`source_id = "I"`**, **`signal_type = "food_access"`** (exact strings) everywhere.
- **Canonical metric names** (exact): `pop_total`, `low_access_pop`, `low_access_pop_share`, `low_income_low_access_pop`, `lila_flag`, `snap_housing_units`.
- **Geography keys** (exact): per-tract = `'tract_' || <11-digit GEOID>`; rollup = `'la_jolla'`.
- **`obs_month`** for a vintage = `make_date(vintage_year, 1, 1)`.
- **No Claude commit attribution** — plain author, no Co-Authored-By trailer.
- **Do not push** — this is the shared `pynay/DSAHacks` repo; commit locally only.
- Run all Python from the repo root: `/Users/datnguyen/Desktop/PROJECTS/DSAHacks`.
- Run tests with: `python -m pytest tests/test_src_i.py -v`.

---

### Task 1: Build the La Jolla FARA seed from real data

**Files:**
- Create: `scripts/build_food_access_seed.py` (dev-only one-off builder)
- Create: `seeds/food_access_la_jolla.csv` (its output, committed)
- Modify: `requirements.txt` (add `openpyxl` for XLSX reads)
- Create: `raw/fara/` (manual FARA download drop; git-ignored working dir)

**Interfaces:**
- Produces: `seeds/food_access_la_jolla.csv` with columns
  `vintage_year, census_tract, pop_total, low_access_pop, low_access_pop_share, low_income_low_access_pop, lila_flag, snap_housing_units, source_url, note`.
  Consumed by Task 3 (`src_i.load`).

- [ ] **Step 1: Add openpyxl to requirements and install**

Add one line to `requirements.txt` (after `pdfplumber>=0.11`):

```
openpyxl>=3.1
```

Run: `python -m pip install "openpyxl>=3.1"`
Expected: `Successfully installed openpyxl-...` (or "already satisfied").

- [ ] **Step 2: Manually download the three real FARA files**

FARA files are published on the ERS data-products page (they are not a stable hot-link).
Download all three vintages from
`https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data`
into `raw/fara/`, keeping the ERS file names. You should end up with (names may vary
slightly by ERS revision — the builder auto-detects the sheet, not the file name):

```
raw/fara/FoodAccessResearchAtlasData2010.xlsx
raw/fara/FoodAccessResearchAtlasData2015.xlsx
raw/fara/FoodAccessResearchAtlasData2019.xlsx
```

Run: `ls -la raw/fara/`
Expected: three `.xlsx` files present (each tens of MB).

- [ ] **Step 3: Write the builder script**

Create `scripts/build_food_access_seed.py`:

```python
"""One-off builder: extract La Jolla census-tract rows from the real USDA FARA
files into seeds/food_access_la_jolla.csv. Real data only - blanks (never 0) where
a vintage lacks a field. Run from repo root: python scripts/build_food_access_seed.py"""
import io
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
FARA_DIR = ROOT / "raw" / "fara"
OUT = ROOT / "seeds" / "food_access_la_jolla.csv"
FARA_PAGE = "https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data"

# Authoritative Census 2010 ZCTA->tract relationship file (national, ~200MB text).
ZCTA_TRACT_REL = "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_tract_rel_10.txt"
LA_JOLLA_ZCTA = "92037"

# vintage -> local FARA file (first existing match wins).
FARA_FILES = {
    2010: ["FoodAccessResearchAtlasData2010.xlsx"],
    2015: ["FoodAccessResearchAtlasData2015.xlsx"],
    2019: ["FoodAccessResearchAtlasData2019.xlsx"],
}

# canonical metric -> candidate FARA column names (first present wins; drift-tolerant).
TRACT_COLS = ["CensusTract", "CensusTractNumber", "GEOID", "GEOID10"]
METRIC_CANDIDATES = {
    "pop_total": ["POP2010", "Pop2010", "POP2010E"],
    "low_access_pop": ["lapop1", "LAPOP1_10", "lapop1_10", "LATractpop1"],
    "low_access_pop_share": ["lapop1share", "LAPOP1_10share"],
    "low_income_low_access_pop": ["lalowi1", "LALOWI1_10", "lalowi1_10"],
    "lila_flag": ["LILATracts_1And10", "LILATracts_1and10", "LILA1_10"],
    "snap_housing_units": ["TractSNAP", "TractSNAP1"],
}


def la_jolla_tracts():
    print(f"Fetching Census ZCTA->tract crosswalk ({ZCTA_TRACT_REL}) ...")
    r = requests.get(ZCTA_TRACT_REL, timeout=120)
    r.raise_for_status()
    rel = pd.read_csv(io.StringIO(r.text), dtype=str, usecols=["ZCTA5", "GEOID"])
    tracts = sorted(rel.loc[rel["ZCTA5"] == LA_JOLLA_ZCTA, "GEOID"].str.zfill(11).unique())
    if not tracts:
        sys.exit(f"No tracts found for ZCTA {LA_JOLLA_ZCTA}")
    print(f"  {len(tracts)} La Jolla tracts: {tracts}")
    return tracts


def _first(cols, candidates):
    for c in candidates:
        if c in cols:
            return c
    return None


def read_vintage(year, tracts):
    path = next((FARA_DIR / n for n in FARA_FILES[year] if (FARA_DIR / n).exists()), None)
    if path is None:
        print(f"  [skip] no FARA file for {year} in {FARA_DIR}")
        return []
    # FARA main sheet is usually named 'Food Access Research Atlas'; fall back to first sheet.
    xls = pd.ExcelFile(path, engine="openpyxl")
    sheet = next((s for s in xls.sheet_names if "Food Access" in s), xls.sheet_names[0])
    df = xls.parse(sheet, dtype={c: str for c in TRACT_COLS})
    tract_col = _first(df.columns, TRACT_COLS)
    if tract_col is None:
        sys.exit(f"{year}: no census-tract column among {TRACT_COLS}")
    df[tract_col] = df[tract_col].str.zfill(11)
    sub = df[df[tract_col].isin(tracts)].copy()
    print(f"  {year}: matched {len(sub)}/{len(tracts)} La Jolla tracts")
    rows = []
    for _, rec in sub.iterrows():
        row = {"vintage_year": year, "census_tract": rec[tract_col],
               "source_url": FARA_PAGE, "note": f"FARA {year} ({path.name})"}
        missing = []
        for metric, cands in METRIC_CANDIDATES.items():
            col = _first(df.columns, cands)
            if col is None:
                row[metric] = ""       # field absent this vintage -> blank, never 0
                missing.append(metric)
            else:
                val = rec[col]
                row[metric] = "" if pd.isna(val) else val
        if missing:
            row["note"] += f"; fields absent this vintage: {','.join(missing)}"
        rows.append(row)
    return rows


def main():
    tracts = la_jolla_tracts()
    all_rows = []
    for year in sorted(FARA_FILES):
        all_rows += read_vintage(year, tracts)
    if not all_rows:
        sys.exit("No FARA rows extracted - did you download the files into raw/fara/?")
    cols = ["vintage_year", "census_tract", "pop_total", "low_access_pop",
            "low_access_pop_share", "low_income_low_access_pop", "lila_flag",
            "snap_housing_units", "source_url", "note"]
    out = pd.DataFrame(all_rows)[cols].sort_values(["vintage_year", "census_tract"])
    OUT.parent.mkdir(exist_ok=True)
    out.to_csv(OUT, index=False)
    print(f"Wrote {len(out)} rows across {out.vintage_year.nunique()} vintages -> {OUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the builder and eyeball the output**

Run: `python scripts/build_food_access_seed.py`
Expected: prints the La Jolla tract list, per-vintage match counts, and
`Wrote N rows across 3 vintages -> .../seeds/food_access_la_jolla.csv`.

Run: `head -3 seeds/food_access_la_jolla.csv && wc -l seeds/food_access_la_jolla.csv`
Expected: header row matches the canonical columns; several dozen data rows (≈ tracts × 3).

- [ ] **Step 5: Validate the seed with a quick assertion**

Run:
```bash
python -c "
import pandas as pd
d = pd.read_csv('seeds/food_access_la_jolla.csv')
need = {'vintage_year','census_tract','pop_total','low_access_pop','low_access_pop_share','low_income_low_access_pop','lila_flag','snap_housing_units','source_url','note'}
assert need <= set(d.columns), d.columns
assert set(d.vintage_year.unique()) <= {2010,2015,2019}
assert d.census_tract.astype(str).str.len().eq(11).all()
assert d.source_url.notna().all()
assert 5 <= d.census_tract.nunique() <= 30, d.census_tract.nunique()
print('seed OK:', len(d), 'rows,', d.census_tract.nunique(), 'tracts,', sorted(d.vintage_year.unique()))
"
```
Expected: `seed OK: ... rows, ... tracts, [2010, 2015, 2019]` (2010 may be absent if that
file was unavailable — acceptable, but 2015 and 2019 must be present).

- [ ] **Step 6: Commit**

```bash
git add requirements.txt scripts/build_food_access_seed.py seeds/food_access_la_jolla.csv
git commit -m "Add La Jolla FARA food-access seed + builder script"
```

---

### Task 2: Register Source I

**Files:**
- Modify: `commons/registry.py` (add `SOURCES["I"]`, after the `"H"` entry, before the closing `}` at line 57)
- Create: `tests/test_src_i.py` (registry check only for now)

**Interfaces:**
- Produces: `SOURCES["I"]` dict with keys `name, url, signal_type, refresh_cadence, measures, known_bias`. `register_table(..., source_id="I", ...)` in Task 3 depends on this existing (else `KeyError`).

- [ ] **Step 1: Write the failing test**

Create `tests/test_src_i.py`:

```python
from commons.registry import SOURCES


def test_registry_has_i():
    assert "I" in SOURCES
    assert SOURCES["I"]["signal_type"] == "food_access"
    assert "ers.usda.gov" in SOURCES["I"]["url"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_src_i.py -v`
Expected: FAIL — `KeyError: 'I'` / assertion error (`"I"` not in `SOURCES`).

- [ ] **Step 3: Add the registry entry**

In `commons/registry.py`, insert immediately after the `"H": dict(...)` entry (after line 56, before the closing `}`):

```python
    "I": dict(name="USDA Food Access Research Atlas - La Jolla",
        url="https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data",
        signal_type="food_access", refresh_cadence="periodic (USDA FARA release; manual seed)",
        measures="USDA FARA census-tract food-access indicators for La Jolla (ZIP 92037): population, low-access population and share (>1mi urban to nearest supermarket), low-income-and-low-access population, the LILA food-desert flag, and housing units receiving SNAP. Vintages 2010/2015/2019 on 2010 tract boundaries.",
        known_bias="Low access is defined purely by distance to a supermarket, not affordability or actual need. Periodic snapshots, not a continuous series. SNAP figure counts housing units, not people. Field availability varies by vintage (see each row's note). Not comparable to the downtown homelessness signals; provided as area food-insecurity context only."),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_src_i.py -v`
Expected: PASS (`test_registry_has_i`).

- [ ] **Step 5: Commit**

```bash
git add commons/registry.py tests/test_src_i.py
git commit -m "Register FARA food-access Source I"
```

---

### Task 3: Staging module `src_i.py` (melt + rollup)

**Files:**
- Create: `commons/staging/src_i.py`
- Modify: `tests/test_src_i.py` (add load + rollup tests)

**Interfaces:**
- Consumes: `seeds/food_access_la_jolla.csv` (Task 1), `SOURCES["I"]` (Task 2), `commons.config.SEEDS_DIR`, `commons.registry.{LoadResult, register_table}`.
- Produces: `src_i.load(con) -> LoadResult`; DuckDB table `stg_i_food_access(geography TEXT, vintage_year BIGINT, metric TEXT, value DOUBLE, source_url TEXT)` containing per-tract rows (`geography LIKE 'tract_%'`) and `la_jolla` rollup rows. Consumed by Task 4 (marts) and Task 5 (run.py).

- [ ] **Step 1: Write the failing tests**

Replace `tests/test_src_i.py` with:

```python
import duckdb
import pandas as pd

from commons import db
from commons.registry import SOURCES
from commons.staging import src_i


def test_registry_has_i():
    assert "I" in SOURCES
    assert SOURCES["I"]["signal_type"] == "food_access"
    assert "ers.usda.gov" in SOURCES["I"]["url"]


def test_seed_columns():
    d = pd.read_csv("seeds/food_access_la_jolla.csv")
    need = {"vintage_year", "census_tract", "pop_total", "low_access_pop",
            "low_access_pop_share", "low_income_low_access_pop", "lila_flag",
            "snap_housing_units", "source_url", "note"}
    assert need <= set(d.columns)
    assert d.source_url.notna().all()


def _con():
    con = duckdb.connect()
    db.ensure_schema(con)
    return con


def test_load_ok_and_geographies():
    con = _con()
    assert src_i.load(con).status == "ok"
    geos = {r[0] for r in con.execute("SELECT DISTINCT geography FROM stg_i_food_access").fetchall()}
    assert "la_jolla" in geos
    assert any(g.startswith("tract_") for g in geos)
    metrics = {r[0] for r in con.execute("SELECT DISTINCT metric FROM stg_i_food_access").fetchall()}
    assert {"pop_total", "low_access_pop", "lila_flag", "snap_housing_units"} <= metrics


def test_rollup_pop_is_sum_of_tracts():
    con = _con()
    src_i.load(con)
    # pick any vintage present; rollup pop_total must equal the sum over its tracts.
    yr = con.execute("SELECT min(vintage_year) FROM stg_i_food_access").fetchone()[0]
    roll = con.execute(
        "SELECT value FROM stg_i_food_access WHERE geography='la_jolla' AND metric='pop_total' AND vintage_year=?",
        [yr]).fetchone()[0]
    tract_sum = con.execute(
        "SELECT sum(value) FROM stg_i_food_access WHERE geography LIKE 'tract_%' AND metric='pop_total' AND vintage_year=?",
        [yr]).fetchone()[0]
    assert abs(roll - tract_sum) < 1e-6
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_src_i.py -v`
Expected: `test_load_ok_and_geographies` and `test_rollup_pop_is_sum_of_tracts` FAIL
with `ModuleNotFoundError: commons.staging.src_i` (registry/seed tests still pass).

- [ ] **Step 3: Write the staging module**

Create `commons/staging/src_i.py`:

```python
import pandas as pd

from commons.config import SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_i_food_access", grain="census tract x vintage (+ la_jolla rollup)",
    signal_type="food_access", source_id="I", refresh="periodic (USDA FARA release; edit seed)",
    measures="Long-format USDA FARA food-access metrics for La Jolla tracts, plus a population-weighted la_jolla rollup.",
    known_bias="Distance-based low-access definition; periodic snapshots on 2010 tract boundaries; SNAP counts housing units; at geography='la_jolla' lila_flag is the SHARE of La Jolla tracts flagged (0-1) and low_access_pop_share is recomputed from summed counts.")

_METRICS = ["pop_total", "low_access_pop", "low_access_pop_share",
            "low_income_low_access_pop", "lila_flag", "snap_housing_units"]
_SUMMABLE = ["pop_total", "low_access_pop", "low_income_low_access_pop", "snap_housing_units"]


def load(con) -> LoadResult:
    seed = pd.read_csv(SEEDS_DIR / "food_access_la_jolla.csv")
    seed["census_tract"] = seed["census_tract"].astype(str).str.zfill(11)
    for m in _METRICS:
        seed[m] = pd.to_numeric(seed[m], errors="coerce")
    src_url = seed["source_url"].iloc[0]

    # per-tract long rows
    per = seed.melt(id_vars=["vintage_year", "census_tract", "source_url"],
                    value_vars=_METRICS, var_name="metric", value_name="value").dropna(subset=["value"])
    per["geography"] = "tract_" + per["census_tract"]
    per = per[["geography", "vintage_year", "metric", "value", "source_url"]]

    # la_jolla rollup per vintage
    roll_rows = []
    for yr, g in seed.groupby("vintage_year"):
        n_tracts = len(g)
        pop_sum = g["pop_total"].sum()
        vals = {m: g[m].sum() for m in _SUMMABLE}
        vals["low_access_pop_share"] = (100.0 * vals["low_access_pop"] / pop_sum) if pop_sum else None
        vals["lila_flag"] = g["lila_flag"].mean() if g["lila_flag"].notna().any() else None  # share of tracts flagged
        for m in _METRICS:
            v = vals.get(m)
            if v is not None and not pd.isna(v):
                roll_rows.append({"geography": "la_jolla", "vintage_year": int(yr),
                                  "metric": m, "value": float(v), "source_url": src_url})
    roll = pd.DataFrame(roll_rows, columns=["geography", "vintage_year", "metric", "value", "source_url"])

    out = pd.concat([per, roll], ignore_index=True)
    con.register("_df", out)
    con.execute("CREATE OR REPLACE TABLE stg_i_food_access AS SELECT * FROM _df")
    con.unregister("_df")
    note = f"{seed['census_tract'].nunique()} tracts x {seed['vintage_year'].nunique()} vintages; {len(roll)} rollup rows"
    return LoadResult("ok", len(out), note)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_src_i.py -v`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add commons/staging/src_i.py tests/test_src_i.py
git commit -m "Add src_i staging: FARA food-access long table + la_jolla rollup"
```

---

### Task 4: Surface Source I into the context mart

**Files:**
- Modify: `commons/marts.py` (add a `_has(con, "stg_i_food_access")` branch appending to `parts_c`, placed after the `stg_zori_monthly` block ~line 154, before the `def _make` at line 156)
- Modify: `tests/test_src_i.py` (add mart-surfacing test)

**Interfaces:**
- Consumes: `stg_i_food_access` (Task 3).
- Produces: rows in `mart_monthly_context` with `source_id='I'`, columns `obs_month, geography, signal_type, metric, value, source_id`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_src_i.py`:

```python
def test_surfaces_in_context_mart():
    from commons import marts
    con = _con()
    src_i.load(con)
    marts.build(con)
    n = con.execute("SELECT count(*) FROM mart_monthly_context WHERE source_id='I'").fetchone()[0]
    assert n > 0
    # obs_month is Jan 1 of the vintage year
    months = {str(r[0]) for r in con.execute(
        "SELECT DISTINCT obs_month FROM mart_monthly_context WHERE source_id='I'").fetchall()}
    assert all(mth.endswith("-01-01") for mth in months)
    la = con.execute(
        "SELECT count(*) FROM mart_monthly_context WHERE source_id='I' AND geography='la_jolla'").fetchone()[0]
    assert la > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_src_i.py::test_surfaces_in_context_mart -v`
Expected: FAIL — `n == 0` (mart has no Source I rows yet).

- [ ] **Step 3: Add the mart branch**

In `commons/marts.py`, immediately after the `stg_zori_monthly` block (after line 154) and before `def _make(...)`:

```python
    if _has(con, "stg_i_food_access"):
        parts_c.append("""
          SELECT make_date(vintage_year, 1, 1) AS obs_month, geography AS geography,
                 'food_access' AS signal_type, metric AS metric, value::DOUBLE AS value, 'I' AS source_id
          FROM stg_i_food_access""")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_src_i.py -v`
Expected: all tests PASS (5 total).

- [ ] **Step 5: Regression-check the marts test suite**

Run: `python -m pytest tests/test_marts.py -v`
Expected: PASS (existing mart tests unaffected — the new branch is guarded by `_has`).

- [ ] **Step 6: Commit**

```bash
git add commons/marts.py tests/test_src_i.py
git commit -m "Surface Source I food-access rows into the context mart"
```

---

### Task 5: Wire into pipeline, export CSV, regenerate docs

**Files:**
- Modify: `commons/marts.py` (add a focused CSV export in `export()`, after the `daily_downtown.csv` COPY at line 184)
- Modify: `run.py` (append the `load_src_i` step + import `src_i`)
- Modify: `commons/docs_gen.py` (add `src_i` to the import tuple at line 13)

**Interfaces:**
- Consumes: `src_i.load` (Task 3), `mart_monthly_context` Source I rows (Task 4).
- Produces: `marts/food_access_la_jolla.csv`; `DATA_DICTIONARY.md` includes Source `I` + `stg_i_food_access`.

- [ ] **Step 1: Add the export**

In `commons/marts.py`, inside `export()`, immediately after the `daily_downtown.csv` COPY line (line 184), add:

```python
    con.execute(f"COPY (SELECT * FROM mart_monthly_context WHERE source_id='I' ORDER BY obs_month, geography, metric) TO '{MARTS_DIR}/food_access_la_jolla.csv' (HEADER)")
```

Also update the return note on the last line of `export()` from `"4 files exported"` to `"5 files exported"`.

- [ ] **Step 2: Wire the step into run.py**

In `run.py` line 2, add `src_i` to the staging import:

```python
from commons.staging import src_a, src_b, src_c, src_d, src_e, src_f, src_g, src_h, src_i
```

Then add this line immediately after the `load_src_g_events` append (after line 18), before the `build_marts` append (line 19):

```python
STEPS.append(("load_src_i", "I", src_i.load))
```

- [ ] **Step 3: Add src_i to docs_gen imports**

In `commons/docs_gen.py`, update the staging import tuple (lines 12-14) to include `src_i`:

```python
from commons.staging import (  # noqa: F401 - register_table side effects
    src_a, src_b, src_c, src_d, src_e, src_f, src_g, src_h, src_i,
)
```

- [ ] **Step 4: Run the full pipeline**

Run: `python run.py`
Expected: the run log includes a line `[     ok] load_src_i: <N> rows. <tracts> tracts x <v> vintages; ...`.
With network available, `src_a` loads `dim_blocks` and you also see `[     ok] export_marts: ... 5 files exported`.
Offline, other live-download sources (`src_a`, `src_c`, etc.) log `failed` (pre-existing fail-soft
behavior); `export_marts` may then log `failed` at the `blocks.geojson` step because `dim_blocks`
is absent — but `marts/food_access_la_jolla.csv` is still written, because its COPY runs *before*
the `dim_blocks` read in `export()`. Either way, Source I and its CSV are unaffected. If you have
network, prefer running online so the full export succeeds.

- [ ] **Step 5: Verify the export and data dictionary**

Run:
```bash
head -3 marts/food_access_la_jolla.csv
grep -c "^" marts/food_access_la_jolla.csv
grep -n "food_access\|stg_i_food_access\|USDA Food Access" DATA_DICTIONARY.md | head
```
Expected: CSV has the header `obs_month,geography,signal_type,metric,value,source_id` and
data rows including `la_jolla` and `tract_...` geographies; `DATA_DICTIONARY.md` now lists
Source `I` and the `stg_i_food_access` table.

- [ ] **Step 6: Full test sweep**

Run: `python -m pytest -q`
Expected: the suite passes (Source I tests green; no regressions).

- [ ] **Step 7: Commit**

```bash
git add commons/marts.py run.py commons/docs_gen.py DATA_DICTIONARY.md marts/food_access_la_jolla.csv
git commit -m "Wire Source I into run.py, export food_access_la_jolla.csv, regen data dictionary"
```

---

### Task 6: Document dataset usage in the README

**Files:**
- Modify: `README.md` (new subsection under `## Sources` ~line 145; a line under `## Outputs` ~line 185; a line under `## seeds/` ~line 216)

**Interfaces:**
- Consumes: everything above. No code; documentation only.

- [ ] **Step 1: Add the Source I subsection under `## Sources`**

In `README.md`, under the `## Sources` section (after the Source H subsection ends, before `## Outputs`), add:

```markdown
### Source I — La Jolla food access (USDA FARA)

Food-insecurity context for the **La Jolla** area (ZIP 92037), from the USDA ERS
[Food Access Research Atlas](https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data),
census-tract grain, vintages **2010 / 2015 / 2019** (2010 tract boundaries). This is the
only non-downtown source; it lands in the context mart keyed by `geography`, and does not
touch the downtown block grid.

Metrics (per tract and as a `la_jolla` rollup):

| metric | meaning |
|---|---|
| `pop_total` | tract population (FARA `POP2010`) |
| `low_access_pop` | people >1mi (urban) from a supermarket (`lapop1`) |
| `low_access_pop_share` | % of population with low access (`lapop1share`) |
| `low_income_low_access_pop` | low-income **and** low-access population (`lalowi1`) |
| `lila_flag` | 1 = tract flagged low-income & low-access food desert (`LILATracts_1And10`) |
| `snap_housing_units` | housing units receiving SNAP (`TractSNAP`) |

At `geography = 'la_jolla'`, count metrics are summed across La Jolla tracts,
`low_access_pop_share` is recomputed from the summed counts, and `lila_flag` becomes the
**share of La Jolla tracts flagged** (0–1). Per-tract rows use `geography = 'tract_<GEOID>'`.

**Rebuild the seed** (one-off, after downloading the FARA files into `raw/fara/`):
`python scripts/build_food_access_seed.py`. Known limits: low access is distance-based
(not affordability/need); snapshots only; SNAP counts housing units, not people; some fields
are absent in the 2010 vintage (noted per row).
```

- [ ] **Step 2: Note the output CSV under `## Outputs`**

Under `## Outputs`, add a bullet listing the new file:

```markdown
- `marts/food_access_la_jolla.csv` — La Jolla FARA food-access metrics (per-tract + `la_jolla` rollup), annual snapshots. Same rows live in the context mart (`source_id='I'`).
```

- [ ] **Step 3: Note the seed under `## seeds/`**

Under `## seeds/`, add:

```markdown
- `food_access_la_jolla.csv` — USDA FARA food-access rows for La Jolla tracts (Source I); rebuilt by `scripts/build_food_access_seed.py`.
```

- [ ] **Step 4: Verify the README edits**

Run: `grep -n "Source I\|food_access_la_jolla\|FARA" README.md`
Expected: matches in the Sources subsection, the Outputs bullet, and the seeds bullet.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Document La Jolla food-access dataset (Source I) usage in README"
```

---

## Self-Review Notes

- **Spec coverage:** identity/vocabulary → Task 2; metrics + FARA fields → Task 1 (extraction) + Task 3 (`_METRICS`); seed schema → Task 1; staging melt + rollup → Task 3; marts branch → Task 4; export → Task 5; run.py/docs_gen wiring → Task 5; tests → Tasks 2–4; README → Task 6; area definition (tract resolution) → Task 1 Step 3. All spec sections map to a task.
- **Real-data integrity:** no tract IDs or metric values are hardcoded anywhere; they come from the Census crosswalk + real FARA files at build time, with blank+note (never 0) for absent fields.
- **Type consistency:** `stg_i_food_access` columns `(geography, vintage_year, metric, value, source_url)` are produced in Task 3 and consumed identically in Task 4/5; canonical metric names and geography-key formats are fixed in Global Constraints and reused verbatim.
- **Additive guarantee:** every mart/staging change is guarded by `_has(con, "stg_i_food_access")`; no downtown file is modified.
