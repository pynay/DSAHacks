"""Source J: paid-parking sessions as a downtown activity proxy.

This source deliberately uses the City's transaction count, not payment revenue, as
the primary activity metric.  Neither metric is a count of pedestrians or people.
"""

import pandas as pd

from commons import fetch, geo
from commons.config import (
    PARKING_METER_DAILY_URL,
    PARKING_METER_LOCATIONS_URL,
    PARKING_METER_YEARS,
    SEEDS_DIR,
)
from commons.registry import LoadResult, register_table


register_table(
    "stg_parking_activity",
    grain="day x paid parking meter (six DSDP downtown neighborhoods only)",
    signal_type="activity_proxy",
    source_id="J",
    refresh="annual files via refresh.py; current year changes daily",
    measures="Paid parking transaction count (paid_sessions) and total payment amount (revenue_usd), plus meter/location coverage fields. One transaction is one paid parking session, not one person.",
    known_bias="NOT foot traffic or a people count. Excludes all non-meter travel and activity, and changes with meter inventory, prices, hours, enforcement, events, construction, payment behavior, remote work, and mode choice. spatial_method distinguishes current coordinate/block matches from coarse historic City-area fallbacks; Core-Columbia fallbacks are assigned to city_center at lower confidence.",
)


DAILY_COLUMNS = [
    "pole_id", "year", "month", "day", "sum_trans_amt", "num_trans",
    "zone", "area", "sub_area",
]


def _area_crosswalk() -> dict[str, str]:
    mapping = pd.read_csv(SEEDS_DIR / "parking_area_map.csv", dtype=str).fillna("")
    return dict(zip(mapping["source_area"].str.strip(), mapping["neighborhood"]))


def _location_lookup(con):
    result = fetch.fetch(PARKING_METER_LOCATIONS_URL, "src_j/parking_meters_current.csv")
    if result.status == "failed":
        return pd.DataFrame(columns=[
            "pole_id", "lat", "lng", "geo_block", "h3_r8", "coordinate_neighborhood",
        ]), result.status

    locations = pd.read_csv(
        result.path,
        usecols=lambda c: c in {"zone", "pole", "latitude", "longitude"},
        dtype=str,
    ).rename(columns={"pole": "pole_id", "latitude": "lat", "longitude": "lng"})
    locations = locations[
        locations["zone"].fillna("").str.strip().str.casefold().eq("downtown")
    ].copy()
    locations["lat"] = pd.to_numeric(locations["lat"], errors="coerce")
    locations["lng"] = pd.to_numeric(locations["lng"], errors="coerce")
    locations = locations.drop_duplicates("pole_id", keep="last")
    locations = geo.enrich(con, locations)
    locations = locations.rename(columns={"neighborhood": "coordinate_neighborhood"})
    return locations[[
        "pole_id", "lat", "lng", "geo_block", "h3_r8", "coordinate_neighborhood",
    ]], result.status


def _transform_chunk(chunk, locations, area_map, source_file):
    chunk = chunk.reindex(columns=DAILY_COLUMNS).copy()
    chunk = chunk[
        chunk["zone"].fillna("").str.strip().str.casefold().eq("downtown")
    ].copy()
    if chunk.empty:
        return chunk

    chunk["obs_date"] = pd.to_datetime(
        {c: pd.to_numeric(chunk[c], errors="coerce") for c in ("year", "month", "day")},
        errors="coerce",
    )
    chunk["obs_month"] = chunk["obs_date"].dt.to_period("M").dt.to_timestamp()
    chunk["paid_sessions"] = pd.to_numeric(chunk["num_trans"], errors="coerce").fillna(0).round().astype("int64")
    chunk["revenue_usd"] = pd.to_numeric(chunk["sum_trans_amt"], errors="coerce").fillna(0.0)
    chunk["source_area"] = chunk["area"].fillna("").str.strip()
    chunk["source_sub_area"] = chunk["sub_area"].fillna("").str.strip()
    chunk = chunk.merge(locations, on="pole_id", how="left")

    fallback = chunk["source_area"].map(area_map)
    chunk["neighborhood"] = chunk["coordinate_neighborhood"].fillna(fallback)
    chunk["location_matched"] = chunk["lat"].notna() & chunk["lng"].notna()
    chunk["spatial_method"] = "unmapped"
    chunk.loc[fallback.notna(), "spatial_method"] = "city_area_fallback"
    chunk.loc[chunk["coordinate_neighborhood"].notna(), "spatial_method"] = "coordinate_block"
    chunk["source_file"] = source_file

    keep = [
        "pole_id", "obs_date", "obs_month", "paid_sessions", "revenue_usd",
        "source_area", "source_sub_area", "lat", "lng", "geo_block", "h3_r8",
        "neighborhood", "location_matched", "spatial_method", "source_file",
    ]
    return chunk.loc[chunk["obs_date"].notna() & chunk["neighborhood"].notna(), keep]


def load(con, years=None, chunksize=250_000) -> LoadResult:
    years = list(years or PARKING_METER_YEARS)
    area_map = _area_crosswalk()
    locations, location_status = _location_lookup(con)
    failures = []

    con.execute("""
      CREATE OR REPLACE TABLE stg_parking_activity (
        pole_id TEXT, obs_date DATE, obs_month DATE, paid_sessions BIGINT,
        revenue_usd DOUBLE, source_area TEXT, source_sub_area TEXT,
        lat DOUBLE, lng DOUBLE, geo_block TEXT, h3_r8 TEXT, neighborhood TEXT,
        location_matched BOOLEAN, spatial_method TEXT, source_file TEXT
      )
    """)

    rows = 0
    for year in years:
        rel = f"src_j/parking_transactions_{year}.csv"
        result = fetch.fetch(PARKING_METER_DAILY_URL.format(year=year), rel)
        if result.status == "failed":
            failures.append(rel)
            continue
        for chunk in pd.read_csv(
            result.path,
            usecols=lambda c: c in DAILY_COLUMNS,
            dtype=str,
            chunksize=chunksize,
        ):
            out = _transform_chunk(chunk, locations, area_map, rel)
            if out.empty:
                continue
            con.register("_parking_chunk", out)
            con.execute("INSERT INTO stg_parking_activity SELECT * FROM _parking_chunk")
            con.unregister("_parking_chunk")
            rows += len(out)

    if rows == 0:
        return LoadResult("failed", 0, f"no parking transaction rows reachable; failed files={failures}")

    matched, blocked, first_date, last_date = con.execute("""
      SELECT round(100.0 * avg(location_matched::INT), 1),
             round(100.0 * avg((geo_block IS NOT NULL)::INT), 1),
             min(obs_date), max(obs_date)
      FROM stg_parking_activity
    """).fetchone()
    partial = bool(failures) or location_status == "failed"
    note = (
        f"coverage={first_date}..{last_date}; current-location match={matched}%; "
        f"downtown-block match={blocked}%; location_file={location_status}; failed files={failures}"
    )
    return LoadResult("partial" if partial else "ok", rows, note)
