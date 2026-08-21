import datetime as dt

import pandas as pd

from commons import fetch
from commons.config import NOAA_URL, NOAA_STATION, ZORI_URL, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_weather_daily", grain="day", signal_type="context", source_id="G_weather",
    measures="Daily max/min temp (C) and precipitation (mm), San Diego Intl Airport.",
    known_bias="Single coastal station; inland microclimates differ.", refresh="daily (re-fetch)")
register_table("stg_zori_monthly", grain="month x zip", signal_type="context", source_id="G_zori",
    measures="Zillow Observed Rent Index (smoothed typical asking rent) for City of San Diego zips.",
    known_bias="Asking rents only; smoothed; some zips missing early years.", refresh="monthly")
register_table("stg_events", grain="event", signal_type="context", source_id="G_events",
    measures="Hand-curated dated policy/shelter/sweep events with sources.",
    known_bias="Curated selection is itself editorial; rows marked date_certainty=verify need human confirmation.", refresh="manual")


def load_weather(con) -> LoadResult:
    url = NOAA_URL.format(end=dt.date.today().isoformat())
    r = fetch.fetch(url, "src_g/ghcn_daily.csv", force=True)  # date-ranged URL; always refetch
    if r.status == "failed":
        return LoadResult("failed", 0, "NOAA unreachable")
    df = pd.read_csv(r.path)
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.rename(columns={"date": "obs_date", "tmax": "tmax_c", "tmin": "tmin_c", "prcp": "prcp_mm"})
    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.date
    df["station"] = NOAA_STATION
    con.register("_df", df[["obs_date", "tmax_c", "tmin_c", "prcp_mm", "station"]])
    con.execute("CREATE OR REPLACE TABLE stg_weather_daily AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")


def load_zori(con) -> LoadResult:
    r = fetch.fetch(ZORI_URL, "src_g/zori_zip.csv")
    if r.status == "failed":
        return LoadResult("failed", 0, "ZORI unreachable")
    df = pd.read_csv(r.path)
    df = df[(df["State"] == "CA") & (df["City"] == "San Diego")]
    id_cols = [c for c in df.columns if not c[:2].isdigit()]
    long = df.melt(id_vars=id_cols, var_name="obs_month", value_name="zori")
    long["obs_month"] = pd.to_datetime(long["obs_month"]).dt.to_period("M").dt.to_timestamp().dt.date
    long = long.rename(columns={"RegionName": "zip"})
    long = long[long["zori"].notna()][["obs_month", "zip", "zori"]]
    long["zip"] = long["zip"].astype(str)
    con.register("_df", long)
    con.execute("CREATE OR REPLACE TABLE stg_zori_monthly AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(long), "")


def load_events(con) -> LoadResult:
    df = pd.read_csv(SEEDS_DIR / "events.csv")
    df["event_date"] = pd.to_datetime(df["event_date"]).dt.date
    con.register("_df", df)
    con.execute("CREATE OR REPLACE TABLE stg_events AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")
