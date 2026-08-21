import json

import pandas as pd
from shapely.geometry import shape

from commons import geo
from commons.config import HACKATHON_DIR
from commons.registry import LoadResult, register_table

NEIGHBORHOOD_MAP = {
    "East Village": "east_village", "City Center": "city_center", "Columbia": "columbia",
    "Cortez": "cortez", "Gaslamp": "gaslamp", "Marina": "marina",
}

register_table("stg_h_monthly", grain="one row per date x area x component", signal_type="observation",
    source_id="H", refresh="static bundle (2017-2025)",
    measures="Downtown unsheltered totals by area and month, 2017-2025. total is the published, verified series (checked cell-by-cell against source reports); individual/tent/vehicle are secondary component rows.",
    known_bias="Totals are occupancy-multiplier-adjusted (tent x1.75-2.00, vehicle x1.66-2.03) - never compare to raw counted units (source A) or post-2020 RTFH/PIT raw counts, and never sum total with components (double-counts). individual/tent/vehicle components are digitized from block-map images, exist only 2018+, and are secondary reliability vs the published total.")
register_table("stg_h_blocklevel", grain="one row per block x count date (report_month)", signal_type="observation",
    source_id="H", refresh="static bundle (2018-2025, 12 count dates)",
    measures="Digitized block-level unsheltered counts (individuals, tents/structures, vehicles) for downtown blocks across 12 count dates, 2018-2025.",
    known_bias="Block footprint expanded 261->382 in Jan 2022 (Barrio Logan, Golden Hill, Sherman Heights added) - use in_panel_261 for any longitudinal comparison. Zero-inflation is real: 55.5% of rows are all-zero and 116 of 382 blocks are never non-zero, not a data defect.")
register_table("dim_h_blockgrid", grain="one row per downtown block-grid polygon (382 blocks)", signal_type="context",
    source_id="H", refresh="static bundle",
    measures="Block-grid polygons (WKT) for the DSDP block-count footprint, with canonical area/neighborhood and an overlay bridge (geo_block) into the 2010-census-block grid used by source A.",
    known_bias="geo_block is NULL for expansion-area blocks (Barrio Logan/Golden Hill/Sherman Heights) that fall outside the 287-block downtown census footprint - expected, not a join failure. Representative points (not CSV centroids) are used for spatial joins; two CSV centroids are documented to fall outside their own polygon.")
register_table("stg_h_method_periods", grain="one row per methodology period", signal_type="context",
    source_id="H", refresh="static bundle",
    measures="The four occupancy-multiplier methodology periods (PRE2017, APR2017, MAY2018, POST2020) governing how tents/vehicles were converted to estimated persons.",
    known_bias="PRE2017 multipliers (2.00/2.00) cannot be unwound from the 18 total-only rows. POST2020 is not a multiplier change - RTFH stopped using multipliers in Jan 2020 but DSDP continued, so post-2020 DSDP totals remain adjusted while RTFH/PIT figures are not.")
register_table("stg_h_area_crosswalk", grain="one row per source-file x source-label area mapping", signal_type="context",
    source_id="H", refresh="static bundle",
    measures="Crosswalk from raw source labels/files to canonical area names, parent areas, and hierarchy level (neighborhood, ev_subarea, block_neighborhood, supplemental).",
    known_bias="Curated mapping; canonical renames (e.g. Core -> City Center, Jan 2019) are applied retroactively here but source_label preserves the original as published.")


def _load_monthly(path):
    df = pd.read_csv(path)
    df["obs_month"] = pd.to_datetime(df["date"]).dt.date
    df["value"] = pd.to_numeric(df["count"], errors="coerce")
    df["fellowship_month"] = df["fellowship_month"].astype(bool)
    df["neighborhood"] = df["area"].map(NEIGHBORHOOD_MAP)
    return df[["obs_month", "area", "area_source_label", "area_type", "parent_area",
               "component", "value", "method", "tent_multiplier", "vehicle_multiplier",
               "fellowship_month", "flag", "neighborhood"]]


def _load_blocklevel(path):
    df = pd.read_csv(path)
    df["obs_month"] = pd.to_datetime(df["report_month"]).dt.date
    df["count_date"] = pd.to_datetime(df["count_date"]).dt.date
    df["tents_structures"] = pd.to_numeric(df["tents_structures"], errors="coerce").astype("Int64")
    df["neighborhood"] = df["area"].map(NEIGHBORHOOD_MAP)
    return df[["block_id", "area", "neighborhood", "count_date", "obs_month",
               "individuals", "tents_structures", "vehicles", "in_panel_261"]]


def _load_grid(con, geojson_path, csv_path):
    area_by_block = pd.read_csv(csv_path)[["block_id", "area"]]
    with open(geojson_path) as f:
        gj = json.load(f)

    rows = []
    for feat in gj["features"]:
        block_id = feat["properties"]["block_id"]
        poly = shape(feat["geometry"])
        rp = poly.representative_point()
        rows.append({"block_id": block_id, "geometry_wkt": poly.wkt, "lat": rp.y, "lng": rp.x})
    grid = pd.DataFrame(rows).merge(area_by_block, on="block_id", how="left")
    grid["neighborhood"] = grid["area"].map(NEIGHBORHOOD_MAP)

    # pass a bare lat/lng frame so geo.enrich's own 'neighborhood' output doesn't
    # clobber the canonical hackathon-area neighborhood mapping above
    pts = grid[["block_id", "lat", "lng"]].copy()
    enriched = geo.enrich(con, pts, lat_col="lat", lng_col="lng")
    grid["geo_block"] = enriched["geo_block"].values
    grid["h3_r8"] = enriched["h3_r8"].values
    grid = grid.rename(columns={"lng": "lon"})
    return grid[["block_id", "area", "neighborhood", "lon", "lat", "geometry_wkt", "geo_block", "h3_r8"]]


def load(con) -> LoadResult:
    if not HACKATHON_DIR.exists():
        return LoadResult("failed", 0, f"missing data dir: {HACKATHON_DIR}")

    monthly = _load_monthly(HACKATHON_DIR / "DowntownCounts_Monthly.csv")
    blocklevel = _load_blocklevel(HACKATHON_DIR / "BlockLevel_Counts.csv")
    grid = _load_grid(con, HACKATHON_DIR / "Downtown_BlockGrid.geojson", HACKATHON_DIR / "Downtown_BlockGrid.csv")
    methods = pd.read_csv(HACKATHON_DIR / "Methodology_Periods.csv")
    crosswalk = pd.read_csv(HACKATHON_DIR / "Area_Crosswalk.csv")

    for name, frame in [
        ("stg_h_monthly", monthly),
        ("stg_h_blocklevel", blocklevel),
        ("dim_h_blockgrid", grid),
        ("stg_h_method_periods", methods),
        ("stg_h_area_crosswalk", crosswalk),
    ]:
        con.register("_df", frame)
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df")
        con.unregister("_df")

    total_rows = len(monthly) + len(blocklevel) + len(grid) + len(methods) + len(crosswalk)
    return LoadResult("ok", total_rows,
                       f"monthly={len(monthly)} blocklevel={len(blocklevel)} grid={len(grid)} "
                       f"methods={len(methods)} crosswalk={len(crosswalk)}")
