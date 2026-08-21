import duckdb
import pandas as pd
from commons import db
from commons.staging import src_g

def test_events_seed():
    m = pd.read_csv("seeds/events.csv")
    assert len(m) >= 6 and m.source_url.notna().all()
    assert set(m.date_certainty) <= {"high", "verify"}
    assert (m.title.str.contains("Camping|camping")).any()

def test_weather_and_events_load():
    con = duckdb.connect(); db.ensure_schema(con)
    r = src_g.load_weather(con)
    assert r.status == "ok"
    lo, hi, nulls = con.execute("""SELECT min(obs_date), max(obs_date),
        sum(CASE WHEN tmax_c IS NULL THEN 1 ELSE 0 END) FROM stg_weather_daily""").fetchone()
    assert str(lo) <= "2012-01-05" and str(hi) >= "2026-01-01"
    assert src_g.load_events(con).status == "ok"

def test_zori_load():
    con = duckdb.connect(); db.ensure_schema(con)
    r = src_g.load_zori(con)
    assert r.status == "ok"
    n_zips = con.execute("SELECT count(DISTINCT zip) FROM stg_zori_monthly").fetchone()[0]
    assert n_zips >= 20  # San Diego city has ~30 residential zips
