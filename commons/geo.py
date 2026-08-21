import h3
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
    df["neighborhood"] = pd.NA
    df["h3_r8"] = pd.NA
    if ok.any():
        df.loc[ok, "h3_r8"] = [h3.latlng_to_cell(a, b, 8) for a, b in zip(lat[ok], lng[ok])]
        pts = points(lng[ok].values, lat[ok].values)
        pi, bi = tree.query(pts, predicate="within")
        ok_idx = df.index[ok]
        df.loc[ok_idx[pi], "geo_block"] = blocks["geo_block"].values[bi]
        df.loc[ok_idx[pi], "neighborhood"] = blocks["neighborhood"].values[bi]
    return df
