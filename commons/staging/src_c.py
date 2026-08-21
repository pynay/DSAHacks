import pandas as pd

from commons import fetch, geo
from commons.config import GID_CLOSED_URL, GID_OPEN_URL, GID_YEARS, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_gid_requests",
    grain="one row per 311 service request (homelessness-related categories only)",
    signal_type="complaint", source_id="C", refresh="daily via refresh.py",
    measures="Resident complaint/report volume about homelessness-related conditions. One request != one person; one encampment can generate many requests.",
    known_bias="Reporting propensity varies by neighborhood and app adoption; categories renamed over years (mapped via seeds/gid_service_map.csv); child duplicates flagged is_child_duplicate and excluded from mart counts.")

KEEP = ["service_request_id", "service_request_parent_id", "date_requested", "date_closed",
        "status", "case_record_type", "service_name", "service_name_detail",
        "case_origin", "lat", "lng", "zipcode", "comm_plan_name"]


def _load_map():
    m = pd.read_csv(SEEDS_DIR / "gid_service_map.csv", dtype=str).fillna("")
    m = m[m["include"].str.lower() == "true"]
    return {(r.case_record_type, r.service_name, r.service_name_detail): r.canon_category
            for r in m.itertuples()}


def load(con, years=None) -> LoadResult:
    years = list(years or GID_YEARS)
    cmap = _load_map()
    frames, fails = [], []
    targets = [(GID_CLOSED_URL.format(year=y), f"src_c/closed_{y}.csv") for y in years]
    targets.append((GID_OPEN_URL, "src_c/open.csv"))
    for url, rel in targets:
        r = fetch.fetch(url, rel)
        if r.status == "failed":
            fails.append(rel); continue
        df = pd.read_csv(r.path, usecols=lambda c: c in KEEP, dtype=str)
        df = df.reindex(columns=KEEP)  # R5: tolerate schema drift across year-files
        key = list(zip(df["case_record_type"].fillna(""), df["service_name"].fillna(""),
                       df["service_name_detail"].fillna("")))
        df["canon_category"] = [cmap.get(k) for k in key]
        df = df[df["canon_category"].notna()].copy()
        df["source_file"] = rel
        frames.append(df)
    if not frames:
        return LoadResult("failed", 0, f"no 311 files reachable: {fails}")
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates("service_request_id", keep="last")  # open+closed overlap
    df["requested_at"] = pd.to_datetime(df["date_requested"], errors="coerce")
    df["requested_date"] = df["requested_at"].dt.date
    df["obs_month"] = df["requested_at"].dt.to_period("M").dt.to_timestamp().dt.date
    df["closed_date"] = pd.to_datetime(df["date_closed"], errors="coerce").dt.date
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
    df["is_child_duplicate"] = df["service_request_parent_id"].notna() & (df["service_request_parent_id"] != "")
    df = df.rename(columns={"service_request_parent_id": "parent_id", "zipcode": "zip"})
    df = geo.enrich(con, df)
    out_cols = ["service_request_id", "parent_id", "requested_at", "requested_date",
                "obs_month", "closed_date", "status", "case_record_type", "service_name",
                "service_name_detail", "canon_category", "case_origin", "lat", "lng",
                "zip", "comm_plan_name", "geo_block", "h3_r8", "neighborhood",
                "is_child_duplicate", "source_file"]
    con.register("_df", df[out_cols])
    con.execute("CREATE OR REPLACE TABLE stg_gid_requests AS SELECT * FROM _df")
    con.unregister("_df")
    status = "partial" if fails else "ok"
    return LoadResult(status, len(df), f"kept categories={sorted(set(df.canon_category))}; failed files={fails}")
