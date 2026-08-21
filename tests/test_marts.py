import json

import duckdb
import pandas as pd

from commons import db, marts
from commons.staging import src_a, src_c, src_h


def _built_con():
    con = duckdb.connect(); db.ensure_schema(con)
    src_a.load(con); src_h.load(con); src_c.load(con, years=[2024])
    marts.build(con)
    return con


def test_signal_types_and_dupes_excluded():
    con = _built_con()
    st = {r[0] for r in con.execute("SELECT DISTINCT signal_type FROM mart_monthly_neighborhood").fetchall()}
    assert st <= {"observation", "complaint", "enforcement", "capacity", "context"} and "observation" in st
    # complaint counts exclude child duplicates (adapted month: 311 data spans 2018-08+, not 2017)
    raw, mart = con.execute("""
      SELECT (SELECT count(*) FROM stg_gid_requests WHERE neighborhood='east_village'
              AND strftime(obs_month,'%Y-%m')='2024-06'),
             (SELECT value FROM mart_monthly_neighborhood WHERE neighborhood='east_village'
              AND metric='gid_requests' AND strftime(obs_month,'%Y-%m')='2024-06')""").fetchone()
    dupes = con.execute("""SELECT count(*) FROM stg_gid_requests WHERE neighborhood='east_village'
      AND strftime(obs_month,'%Y-%m')='2024-06' AND is_child_duplicate""").fetchone()[0]
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
    gj = json.loads((tmp_path / "blocks.geojson").read_text())
    assert gj["type"] == "FeatureCollection" and len(gj["features"]) > 100


def test_h_metrics_in_marts():
    con = _built_con()
    # adjusted totals present for all 6 neighborhoods in a known-good month
    n = con.execute("""SELECT count(*) FROM mart_monthly_neighborhood
        WHERE metric='dsdp_adjusted_total' AND strftime(obs_month,'%Y-%m')='2023-01'""").fetchone()[0]
    assert n == 6
    # adjusted vs raw metrics never share a metric name
    ms = {r[0] for r in con.execute("SELECT DISTINCT metric FROM mart_monthly_neighborhood WHERE source_id='H'").fetchall()}
    assert "observed_total_units" not in ms and "dsdp_adjusted_total" in ms
    # block mart has H units on census-mapped blocks
    nb = con.execute("SELECT count(*) FROM mart_monthly_block WHERE metric='dsdp_units_total'").fetchone()[0]
    assert nb > 500
