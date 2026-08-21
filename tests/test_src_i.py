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


def test_rollup_drops_fully_missing_metric():
    # FARA 2010 has no SNAP field, so every 2010 tract is blank for snap_housing_units.
    # The la_jolla rollup must OMIT that metric-vintage, never report it as 0.
    con = _con()
    src_i.load(con)
    n = con.execute(
        "SELECT count(*) FROM stg_i_food_access WHERE geography='la_jolla' "
        "AND vintage_year=2010 AND metric='snap_housing_units'").fetchone()[0]
    assert n == 0


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
