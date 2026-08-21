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
