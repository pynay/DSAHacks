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

V72_KEEP = ["service_request_id", "date_requested", "date_closed", "status",
            "lat", "lng", "zipcode", "comm_plan_name"]


def load_72hr(con) -> LoadResult:
    r = fetch.fetch(V72_URL, "src_d/violations_72hr.csv")
    if r.status == "failed":
        return LoadResult("failed", 0, "72hr csv unreachable")
    df = pd.read_csv(r.path, usecols=lambda c: c in V72_KEEP, dtype=str)
    df = df.reindex(columns=V72_KEEP)  # tolerate schema drift, mirrors src_c pattern
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


CITATION_KEEP = ["citation_id", "date_issue", "vio_code", "vio_desc", "vio_fine",
                  "location", "sector1"]


def load_citations(con, years=None) -> LoadResult:
    years = list(years or CITATION_YEARS)
    codes = pd.read_csv(SEEDS_DIR / "violation_codes.csv", dtype=str)
    cmap = dict(zip(codes["vio_code"], codes["code_category"]))
    frames, fails = [], []
    for y in years:
        for p in (1, 2):
            rel = f"src_d/citations_{y}_p{p}.csv"
            r = fetch.fetch(CITATIONS_URL.format(year=y, part=p), rel, timeout=600)
            if r.status == "failed":
                fails.append(rel); continue
            df = pd.read_csv(r.path, usecols=lambda c: c in CITATION_KEEP, dtype=str)
            df = df.reindex(columns=CITATION_KEEP)  # tolerate schema drift across year-files
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
