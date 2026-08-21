import duckdb
from commons import db
from commons.registry import SOURCES
from commons.staging import src_a, src_h

def _con():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con); return con

def test_registry_has_h():
    assert SOURCES["H"]["signal_type"] == "observation"
    assert "multiplier" in SOURCES["H"]["known_bias"]

def test_h_monthly():
    con = _con()
    assert src_h.load(con).status == "ok"
    n, lo, hi, nulls, hoods = con.execute("""
        SELECT count(*), min(obs_month), max(obs_month),
               sum(CASE WHEN value IS NULL THEN 1 ELSE 0 END),
               count(DISTINCT neighborhood) FROM stg_h_monthly""").fetchone()
    assert n == 2880 and str(lo) == "2017-01-01" and str(hi) == "2025-12-01"
    assert nulls == 143      # 140 not_reported + 3 not_in_program
    assert hoods == 6        # six core downtown neighborhoods mapped
    comps = {r[0] for r in con.execute("SELECT DISTINCT component FROM stg_h_monthly").fetchall()}
    assert comps == {"total", "individual", "tent", "vehicle"}

def test_h_blocklevel_and_grid():
    con = _con()
    src_h.load(con)
    n, months, panel = con.execute("""
        SELECT count(*), count(DISTINCT obs_month), sum(CASE WHEN in_panel_261 THEN 1 ELSE 0 END)
        FROM stg_h_blocklevel""").fetchone()
    assert n == 3737 and months == 12 and panel == 3132
    orphans = con.execute("""SELECT count(*) FROM stg_h_blocklevel b
        LEFT JOIN dim_h_blockgrid g USING (block_id) WHERE g.block_id IS NULL""").fetchone()[0]
    assert orphans == 0
    rows, uniq, with_geom, with_h3, with_census = con.execute("""
        SELECT count(*), count(DISTINCT block_id), count(geometry_wkt), count(h3_r8), count(geo_block)
        FROM dim_h_blockgrid""").fetchone()
    assert rows == 382 == uniq == with_geom == with_h3
    assert 150 <= with_census < 382   # downtown core maps to census blocks; expansion areas don't
    assert con.execute("SELECT count(*) FROM stg_h_method_periods").fetchone()[0] == 4
