from pathlib import Path

import duckdb
import pandas as pd

from commons import db, marts
from commons.fetch import FetchResult
from commons.registry import SOURCES
from commons.staging import src_j


def _fixtures(tmp_path: Path):
    locations = tmp_path / "locations.csv"
    pd.DataFrame([
        {"zone": "Downtown", "pole": "P1", "latitude": "32.711", "longitude": "-117.160"},
        {"zone": "Downtown", "pole": "P2", "latitude": "32.712", "longitude": "-117.161"},
        {"zone": "Uptown", "pole": "PX", "latitude": "32.73", "longitude": "-117.16"},
    ]).to_csv(locations, index=False)
    daily = tmp_path / "daily.csv"
    pd.DataFrame([
        {"pole_id": "P1", "year": 2024, "month": 1, "day": 2, "sum_trans_amt": 12.5, "num_trans": 5, "zone": "Downtown", "area": "East Village", "sub_area": "A"},
        {"pole_id": "P2", "year": 2024, "month": 1, "day": 2, "sum_trans_amt": 7.5, "num_trans": 3, "zone": "Downtown", "area": "Core", "sub_area": "B"},
        {"pole_id": "OLD", "year": 2024, "month": 1, "day": 3, "sum_trans_amt": 4.0, "num_trans": 2, "zone": "Downtown", "area": "Cortez Hill", "sub_area": "C"},
        {"pole_id": "NO", "year": 2024, "month": 1, "day": 3, "sum_trans_amt": 99, "num_trans": 99, "zone": "Uptown", "area": "Bankers Hill", "sub_area": "D"},
    ]).to_csv(daily, index=False)
    return locations, daily


def _load(tmp_path, monkeypatch):
    locations, daily = _fixtures(tmp_path)

    def fake_fetch(url, rel_path, **kwargs):
        path = locations if "locations" in url else daily
        return FetchResult(path, "cached")

    def fake_enrich(con, frame):
        frame = frame.copy()
        frame["geo_block"] = frame["pole_id"].map({"P1": "b1", "P2": "b2"})
        frame["h3_r8"] = frame["pole_id"].map({"P1": "h1", "P2": "h2"})
        frame["neighborhood"] = frame["pole_id"].map({"P1": "east_village", "P2": "city_center"})
        return frame

    monkeypatch.setattr(src_j.fetch, "fetch", fake_fetch)
    monkeypatch.setattr(src_j.geo, "enrich", fake_enrich)
    con = duckdb.connect()
    db.ensure_schema(con)
    result = src_j.load(con, years=[2024], chunksize=2)
    return con, result


def test_registry_frames_parking_as_proxy():
    assert SOURCES["J"]["signal_type"] == "activity_proxy"
    assert "NOT foot traffic" in SOURCES["J"]["known_bias"]


def test_research_catalog_is_machine_readable_and_ranked():
    catalog = pd.read_csv("docs/data_source_catalog.csv")
    assert len(catalog) >= 50
    assert catalog.catalog_id.is_unique
    assert {"P0", "P1", "P2", "P3"} <= set(catalog.priority)
    assert catalog.url.str.startswith("http").all()
    assert catalog.known_bias.notna().all()


def test_load_maps_coordinates_then_falls_back(tmp_path, monkeypatch):
    con, result = _load(tmp_path, monkeypatch)
    assert result.status == "ok" and result.rows == 3
    rows = con.execute("""
      SELECT pole_id, neighborhood, spatial_method, location_matched
      FROM stg_parking_activity ORDER BY pole_id
    """).fetchall()
    assert ("OLD", "cortez", "city_area_fallback", False) in rows
    assert ("P1", "east_village", "coordinate_block", True) in rows
    assert con.execute("SELECT sum(paid_sessions), sum(revenue_usd) FROM stg_parking_activity").fetchone() == (10, 24.0)


def test_parking_metrics_surface_in_marts_and_exports(tmp_path, monkeypatch):
    con, _ = _load(tmp_path, monkeypatch)
    marts.build(con)
    metrics = {r[0] for r in con.execute(
        "SELECT DISTINCT metric FROM mart_monthly_neighborhood WHERE source_id='J'"
    ).fetchall()}
    assert metrics == {"paid_sessions", "parking_revenue_usd", "parking_meters_reporting"}
    sessions = con.execute("""
      SELECT sum(value) FROM mart_monthly_neighborhood
      WHERE source_id='J' AND metric='paid_sessions'
    """).fetchone()[0]
    assert sessions == 10

    con.execute("""
      CREATE TABLE dim_blocks (
        geo_block TEXT, block_name TEXT, neighborhood TEXT, zip TEXT, geometry_wkt TEXT
      )
    """)
    con.execute("""INSERT INTO dim_blocks VALUES
      ('b1', 'block 1', 'east_village', '92101', 'POLYGON ((0 0, 0 1, 1 1, 1 0, 0 0))'),
      ('b2', 'block 2', 'city_center', '92101', 'POLYGON ((1 0, 1 1, 2 1, 2 0, 1 0))')
    """)
    monkeypatch.setattr(marts, "MARTS_DIR", tmp_path / "marts")
    marts.export(con)
    exported = pd.read_csv(tmp_path / "marts" / "parking_activity_daily.csv")
    assert set(exported.source_id) == {"J"}
    assert "pole_id" not in exported.columns
